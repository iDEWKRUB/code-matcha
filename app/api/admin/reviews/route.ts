import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import type { AdminReview } from "@/lib/reviews";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// รีวิวทั้งหมดสำหรับร้าน (ไม่มีชื่อลูกค้า) · มีเลขออเดอร์และวันที่ไว้ย้อนดูว่าแก้วไหน
export async function GET() {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const { data, error } = await db()
    .from("reviews")
    .select("id,rating,comment,items,created_at,is_public,hidden,pos_bill_id,orders(daily_no,pickup_date),pos_bills(bill_date)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return fail("ยังไม่ได้รัน migration-033 (ตารางรีวิว)", 503);
  const rows = data as unknown as { id: number; rating: number; comment: string; items: string; created_at: string; is_public: boolean; hidden: boolean; pos_bill_id: number | null; orders: { daily_no: number; pickup_date: string } | null; pos_bills: { bill_date: string } | null }[];
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
  }));
  return NextResponse.json({ reviews });
}

// ซ่อน/แสดงรีวิวในหน้าลูกค้า (แก้ข้อความหรือคะแนนไม่ได้)
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const b = (await req.json().catch(() => null)) as { id?: unknown; hidden?: unknown } | null;
  if (!Number.isInteger(b?.id) || typeof b?.hidden !== "boolean") return fail("ข้อมูลไม่ถูกต้อง");
  const { error } = await db().from("reviews").update({ hidden: b.hidden }).eq("id", b.id as number);
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
