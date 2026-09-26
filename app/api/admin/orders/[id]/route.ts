import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pushText } from "@/lib/line";
import type { OrderStatus } from "@/lib/menu";
import { ORDER_COLUMNS, earnPoints, pointsBalance, queueAhead, revokeEarned, rowWhen, type OrderRow } from "@/lib/orders";
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
    const earned = await earnPoints(current);
    const [ahead, balance] = await Promise.all([
      queueAhead(current.pickup_date, current.pickup_time, no),
      pointsBalance(current.line_user_id),
    ]);
    await pushText(
      current.line_user_id,
      [
        `✅ ร้านได้รับชำระเงิน ฿${current.total} แล้ว ออเดอร์ #${no} เข้าคิวเรียบร้อย`,
        ...current.items.map((i) => `• ${i.qty}× ${i.name}${i.detail ? ` (${i.detail})` : ""}`),
        current.discount > 0 && `ใช้แต้มลด ฿${current.discount}`,
        rowWhen(current),
        ahead ? `ตอนนี้มีคิวก่อนหน้า ${ahead} คิว` : "ตอนนี้ไม่มีคิวก่อนหน้า",
        earned > 0 ? `🎁 ได้รับ ${earned} แต้ม (รวม ${balance} แต้ม)` : `แต้มสะสม ${balance} แต้ม`,
        "ออเดอร์เสร็จเมื่อไรจะแจ้งทาง LINE อีกครั้ง 🍵",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (to === "ready")
    await pushText(
      current.line_user_id,
      current.service === "dine_in"
        ? `🍵 ออเดอร์ #${no} พร้อมแล้ว${current.table_no ? ` ร้านจะนำไปเสิร์ฟที่โต๊ะ ${current.table_no}` : "\nแจ้งเลข #" + no + " ที่เคาน์เตอร์ได้เลย"}`
        : `🍵 ออเดอร์ #${no} พร้อมรับแล้ว\nแจ้งเลข #${no} ที่เคาน์เตอร์ได้เลย`,
    );
  if (to === "cancelled") {
    // แต้มที่ใช้คืนอัตโนมัติ (ออเดอร์ cancelled ไม่นับ) ส่วนแต้มที่ได้จากออเดอร์นี้ดึงคืน
    const paid = current.status !== "payment_review";
    if (paid) await revokeEarned(current.id);
    const refundPoints = current.discount > 0 ? `\nคืน ${current.discount} แต้มที่ใช้เข้าบัญชีแล้ว` : "";
    await pushText(
      current.line_user_id,
      !paid
        ? `ร้านตรวจไม่พบยอดโอน ฿${current.total} สำหรับออเดอร์ #${no} จึงยกเลิกออเดอร์นี้\nหากโอนแล้วจริง ส่งสลิปในแชทนี้ ร้านจะตรวจสอบให้อีกครั้ง${refundPoints}`
        : `ขออภัย ร้านต้องยกเลิกออเดอร์ #${no} (${rowWhen(current)})${
            current.total > 0 ? `\nร้านจะติดต่อคืนเงิน ฿${current.total} ให้ทางแชทนี้` : ""
          }${refundPoints}`,
    );
  }

  return NextResponse.json({ ok: true });
}
