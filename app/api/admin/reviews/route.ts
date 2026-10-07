import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { MAX_REPLY, type AdminReview } from "@/lib/reviews";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// รีวิวทั้งหมดสำหรับร้าน (ไม่มีชื่อลูกค้า) · มีเลขออเดอร์และวันที่ไว้ย้อนดูว่าแก้วไหน
export async function GET() {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const { data, error } = await db()
    .from("reviews")
    .select("id,rating,comment,items,created_at,is_public,hidden,reply,replied_at,pos_bill_id,orders(daily_no,pickup_date),pos_bills(bill_date)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return fail("ยังไม่ได้รัน migration-033 (ตารางรีวิว)", 503);
  const rows = data as unknown as { id: number; rating: number; comment: string; items: string; created_at: string; is_public: boolean; hidden: boolean; reply: string; replied_at: string | null; pos_bill_id: number | null; orders: { daily_no: number; pickup_date: string } | null; pos_bills: { bill_date: string } | null }[];
  const reviews: AdminReview[] = rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    items: r.items,
    at: r.created_at,
    orderNo: r.orders?.daily_no ?? 0,
    date: r.orders?.pickup_date ?? r.pos_bills?.bill_date ?? "",
    source: r.pos_bill_id ? "pos" : "line",
    isPublic: r.is_public,
    hidden: r.hidden,
    reply: r.reply ?? "",
    repliedAt: r.replied_at,
  }));
  return NextResponse.json({ reviews });
}

// ซ่อน/แสดงรีวิวในหน้าลูกค้า หรือ ตอบกลับรีวิว (แก้ข้อความหรือคะแนนของลูกค้าไม่ได้)
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const b = (await req.json().catch(() => null)) as { id?: unknown; hidden?: unknown; reply?: unknown } | null;
  if (!Number.isInteger(b?.id)) return fail("ข้อมูลไม่ถูกต้อง");
  const row: Record<string, unknown> = {};
  if (typeof b?.hidden === "boolean") row.hidden = b.hidden;
  if (typeof b?.reply === "string") {
    const reply = b.reply.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_REPLY);
    row.reply = reply;
    row.replied_at = reply ? new Date().toISOString() : null;
  }
  if (!Object.keys(row).length) return fail("ข้อมูลไม่ถูกต้อง");
  const { data, error } = await db().from("reviews").update(row).eq("id", b!.id as number).select("reply,replied_at").maybeSingle();
  if (error) throw error;
  return NextResponse.json({ ok: true, reply: data?.reply ?? "", repliedAt: data?.replied_at ?? null });
}
