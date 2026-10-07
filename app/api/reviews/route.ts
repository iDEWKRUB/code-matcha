import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/line";
import { MAX_REVIEW, REVIEW_DAYS, REVIEW_STATUSES, type ReviewSummary } from "@/lib/reviews";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const itemNames = (items: { name: string; qty: number }[] | null) => (items ?? []).map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(", ").slice(0, 200);

// สรุปรีวิวสาธารณะ (หน้าสั่ง): คะแนนเฉลี่ย + รีวิวล่าสุดที่ลูกค้ายอมให้แสดงและร้านไม่ได้ซ่อน · ไม่มีชื่อผู้รีวิว
export async function GET() {
  const { data, error } = await db().from("reviews").select("id,rating,comment,items,created_at,is_public,hidden,reply,replied_at").order("created_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ count: 0, avg: 0, dist: [0, 0, 0, 0, 0], latest: [] } satisfies ReviewSummary);
  const shown = data.filter((r) => r.is_public && !r.hidden);
  const dist = [0, 0, 0, 0, 0];
  for (const r of shown) dist[r.rating - 1]++;
  const body: ReviewSummary = {
    count: shown.length,
    avg: shown.length ? Math.round((shown.reduce((n, r) => n + r.rating, 0) / shown.length) * 10) / 10 : 0,
    dist,
    // รีวิวที่มีข้อความ หรือร้านตอบกลับแล้ว
    latest: shown
      .filter((r) => r.comment.trim() || r.reply.trim())
      .slice(0, 8)
      .map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, items: r.items, at: r.created_at, reply: r.reply, repliedAt: r.replied_at })),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=60" } });
}

type Target = { key: "order_id" | "pos_bill_id"; id: number; ref: string; items: string };

// บิลหน้าร้านจากรหัสรีวิวบนใบเสร็จ (ไม่ต้องล็อกอิน: รหัสสุ่มเดาไม่ได้ ใช้ได้ 1 รีวิวต่อบิล)
async function billTarget(token: unknown): Promise<{ target: Target } | { error: NextResponse }> {
  if (typeof token !== "string" || !/^[\w-]{8,40}$/.test(token)) return { error: fail("QR ไม่ถูกต้อง") };
  const { data: b, error } = await db().from("pos_bills").select("id,status,paid_at,bill_date").eq("review_token", token).maybeSingle();
  if (error) throw error;
  if (!b || b.status !== "paid") return { error: fail("ไม่พบบิลนี้", 404) };
  if (b.paid_at && Date.now() - new Date(b.paid_at).getTime() > REVIEW_DAYS * 86400000) return { error: fail(`รีวิวได้ภายใน ${REVIEW_DAYS} วันหลังซื้อ`, 409) };
  const { data: os } = await db().from("orders").select("items,status").eq("pos_bill_id", b.id);
  const items = itemNames((os ?? []).filter((o) => o.status !== "cancelled").flatMap((o) => o.items ?? []));
  const day = new Date(`${b.bill_date}T12:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
  return { target: { key: "pos_bill_id", id: b.id, ref: `บิลหน้าร้าน ${day}`, items } };
}

async function target(req: Request, body: { orderId?: unknown; billToken?: unknown } | null): Promise<{ target: Target } | { error: NextResponse }> {
  if (body?.billToken !== undefined) return billTarget(body.billToken);
  const r = await ownOrder(req, Number(body?.orderId));
  if (r.error) return { error: r.error };
  return { target: { key: "order_id", id: r.order.id, ref: `ออเดอร์ #${r.order.daily_no}`, items: itemNames(r.order.items) } };
}

async function ownOrder(req: Request, orderId: number) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return { error: fail("เซสชัน LINE หมดอายุ กรุณาเปิดลิงก์จาก LINE อีกครั้ง", 401) };
  const { data: o, error } = await db().from("orders").select("id,daily_no,line_user_id,status,items,created_at").eq("id", orderId).maybeSingle();
  if (error) throw error;
  if (!o || o.line_user_id !== user.userId) return { error: fail("ไม่พบออเดอร์นี้", 404) };
  if (!REVIEW_STATUSES.includes(o.status)) return { error: fail("รีวิวได้หลังร้านทำเครื่องดื่มเสร็จแล้ว", 409) };
  if (Date.now() - new Date(o.created_at).getTime() > REVIEW_DAYS * 86400000) return { error: fail(`รีวิวได้ภายใน ${REVIEW_DAYS} วันหลังสั่ง`, 409) };
  return { order: o };
}

// ลูกค้าเปิดหน้ารีวิว: ดูออเดอร์ของตัวเอง + รีวิวเดิม (ถ้าเคยรีวิว)
export async function PUT(req: Request) {
  const b = (await req.json().catch(() => null)) as { orderId?: unknown; billToken?: unknown } | null;
  const r = await target(req, b);
  if ("error" in r) return r.error;
  const t = r.target;
  const { data: rv } = await db().from("reviews").select("rating,comment,is_public").eq(t.key, t.id).maybeSingle();
  return NextResponse.json({ ref: t.ref, items: t.items, review: rv ? { rating: rv.rating, comment: rv.comment, isPublic: rv.is_public } : null });
}

// ส่ง/แก้รีวิว
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { orderId?: unknown; billToken?: unknown; rating?: unknown; comment?: unknown; isPublic?: unknown } | null;
  const rating = Number(b?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail("กรุณาให้คะแนน 1–5 ดาว");
  const comment = typeof b?.comment === "string" ? b.comment.replace(/\s+/g, " ").trim().slice(0, MAX_REVIEW) : "";
  const r = await target(req, b);
  if ("error" in r) return r.error;
  const t = r.target;
  const { error } = await db()
    .from("reviews")
    .upsert({ [t.key]: t.id, rating, comment, items: t.items, is_public: b?.isPublic !== false, updated_at: new Date().toISOString() }, { onConflict: t.key });
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
