import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pushText } from "@/lib/line";
import type { OrderStatus } from "@/lib/menu";
import { ORDER_COLUMNS, queueAhead, type OrderRow } from "@/lib/orders";
import { db } from "@/lib/supabase";

const NEXT: Record<string, OrderStatus[]> = {
  payment_review: ["pending", "cancelled"],
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed"],
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  const { to } = (await req.json().catch(() => ({}))) as { to?: OrderStatus };

  const { data: current, error: readErr } = await db()
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", id)
    .maybeSingle<OrderRow>();
  if (readErr) throw readErr;
  if (!current) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
  if (!to || !NEXT[current.status]?.includes(to))
    return NextResponse.json({ error: "เปลี่ยนสถานะนี้ไม่ได้" }, { status: 409 });

  const now = new Date().toISOString();
  // อัปเดตเฉพาะเมื่อสถานะยังเหมือนเดิม กันสองเครื่องกดพร้อมกัน
  const { data: updated, error } = await db()
    .from("orders")
    .update({ status: to, updated_at: now, ...(to === "pending" ? { paid_at: now } : {}) })
    .eq("id", id)
    .eq("status", current.status)
    .select("id");
  if (error) throw error;
  if (!updated?.length) return NextResponse.json({ error: "ออเดอร์ถูกอัปเดตไปแล้ว" }, { status: 409 });

  const no = current.daily_no;
  if (to === "pending") {
    const ahead = await queueAhead(current.pickup_date, current.pickup_time, no);
    await pushText(
      current.line_user_id,
      [
        `✅ ร้านได้รับชำระเงิน ฿${current.total} แล้ว ออเดอร์ #${no} เข้าคิวเรียบร้อย`,
        ...current.items.map((i) => `• ${i.qty}× ${i.name} (${i.detail})`),
        `เวลารับ ${current.pickup_time} น.`,
        ahead ? `ตอนนี้มีคิวก่อนหน้า ${ahead} คิว` : "ตอนนี้ไม่มีคิวก่อนหน้า",
        "เครื่องดื่มเสร็จเมื่อไรจะแจ้งทาง LINE อีกครั้ง 🍵",
      ].join("\n"),
    );
  }
  if (to === "ready")
    await pushText(current.line_user_id, `🍵 เครื่องดื่มออเดอร์ #${no} พร้อมรับแล้ว\nแจ้งเลข #${no} ที่เคาน์เตอร์ได้เลย`);
  if (to === "cancelled")
    await pushText(
      current.line_user_id,
      current.status === "payment_review"
        ? `ร้านตรวจไม่พบยอดโอน ฿${current.total} สำหรับออเดอร์ #${no} จึงยกเลิกออเดอร์นี้\nหากโอนแล้วจริง ส่งสลิปในแชทนี้ ร้านจะตรวจสอบให้อีกครั้ง`
        : `ขออภัย ร้านต้องยกเลิกออเดอร์ #${no} (รับ ${current.pickup_time} น.)\nร้านจะติดต่อคืนเงิน ฿${current.total} ให้ทางแชทนี้`,
    );

  return NextResponse.json({ ok: true });
}
