import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { orderUri, type Card } from "@/lib/flex";
import { pushCard } from "@/lib/line";
import type { OrderStatus } from "@/lib/menu";
import { ORDER_COLUMNS, earnPoints, itemLines, pointsBalance, queueAhead, revokeEarned, rowWhen, type OrderRow } from "@/lib/orders";
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
  const notify = (c: Card) => pushCard(current.line_user_id, c, { name: current.customer_name, orderNo: no });
  if (to === "pending") {
    const earned = await earnPoints(current);
    const [ahead, balance] = await Promise.all([
      queueAhead(current.pickup_date, current.pickup_time, no),
      pointsBalance(current.line_user_id),
    ]);
    await notify({
      tone: "matcha",
      title: "ร้านได้รับชำระเงินแล้ว",
      subtitle: `ออเดอร์ #${no} เข้าคิวเรียบร้อย`,
      rows: [
        ["ออเดอร์", `#${no}`, true],
        ["วิธีรับ", rowWhen(current)],
        ...(current.promo_discount > 0 ? ([[`โค้ด ${current.promo_code}`, `−฿${current.promo_discount}`]] as [string, string][]) : []),
        ...(current.discount > 0 ? ([["ส่วนลดแต้ม", `−฿${current.discount}`]] as [string, string][]) : []),
        ["ยอดชำระ", `฿${current.total}`],
        ["คิวก่อนหน้า", ahead ? `${ahead} คิว` : "ไม่มี ทำต่อเลย"],
        ["แต้มสะสม", earned > 0 ? `+${earned} (รวม ${balance})` : `${balance} แต้ม`],
      ],
      items: itemLines(current.items),
      note: "ออเดอร์เสร็จเมื่อไรจะแจ้งทาง LINE อีกครั้ง",
      button: { label: "สั่งเพิ่ม", uri: orderUri() },
    });
  }
  if (to === "ready") {
    const served = current.service === "dine_in" && current.table_no;
    await notify({
      tone: "ready",
      title: current.service === "dine_in" ? "ออเดอร์พร้อมแล้ว!" : "ออเดอร์พร้อมรับแล้ว!",
      subtitle: served ? `ร้านจะนำไปเสิร์ฟที่โต๊ะ ${current.table_no}` : `แจ้งเลข #${no} ที่เคาน์เตอร์ได้เลย`,
      rows: [
        ["ออเดอร์", `#${no}`, true],
        ["วิธีรับ", rowWhen(current)],
      ],
      items: itemLines(current.items),
      note: "ขอบคุณที่อุดหนุน CODE-MACHA",
    });
  }
  if (to === "cancelled") {
    // แต้มที่ใช้คืนอัตโนมัติ (ออเดอร์ cancelled ไม่นับ) ส่วนแต้มที่ได้จากออเดอร์นี้ดึงคืน
    const paid = current.status !== "payment_review";
    if (paid) await revokeEarned(current.id);
    await notify({
      tone: "danger",
      title: paid ? "ร้านต้องยกเลิกออเดอร์" : "ตรวจไม่พบยอดโอน",
      subtitle: paid ? "ขออภัยในความไม่สะดวก" : "ออเดอร์นี้จึงถูกยกเลิก",
      rows: [
        ["ออเดอร์", `#${no}`, true],
        ["ยอด", `฿${current.total}`],
        ...(current.discount > 0 ? ([["แต้มที่ใช้", `คืน ${current.discount} แต้มแล้ว`]] as [string, string][]) : []),
      ],
      note: paid
        ? current.total > 0
          ? `ร้านจะติดต่อคืนเงิน ฿${current.total} ให้ทางแชทนี้`
          : "สอบถามเพิ่มเติมตอบกลับในแชทนี้ได้เลย"
        : "หากโอนแล้วจริง ส่งรูปสลิปในแชทนี้ ร้านจะตรวจสอบให้อีกครั้ง",
    });
  }

  return NextResponse.json({ ok: true });
}
