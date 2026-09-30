import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import type { Card } from "@/lib/flex";
import { pushCard } from "@/lib/line";
import type { OrderStatus } from "@/lib/menu";
import { ORDER_COLUMNS, earnPoints, itemLines, pointsBalance, revokeEarned, rowWhen, type OrderRow } from "@/lib/orders";
import { applySale } from "@/lib/barServer";
import { afterMatchaPaid } from "@/lib/paid";
import { rewardReferral } from "@/lib/referral";
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
  // มาม่าบาร์: ลูกค้าต้มเอง ยืนยันจ่ายแล้วจบออเดอร์เลย ไม่ต้องเข้าคิวทำ
  const bar = current.source === "bar";
  const status = bar && to === "pending" ? "completed" : to;
  // อัปเดตเฉพาะเมื่อสถานะยังเหมือนเดิม กันสองเครื่องกดพร้อมกัน
  const { data: updated, error } = await db()
    .from("orders")
    .update({ status, updated_at: now, ...(to === "pending" ? { paid_at: now } : {}) })
    .eq("id", id)
    .eq("status", current.status)
    .select("id");
  if (error) throw error;
  if (!updated?.length) return NextResponse.json({ error: "ออเดอร์ถูกอัปเดตไปแล้ว" }, { status: 409 });

  const no = current.daily_no;
  const notify = (c: Card) => pushCard(current.line_user_id, c, { name: current.customer_name, orderNo: no });
  if (to === "pending" && bar) {
    await applySale(current.id);
    const earned = await earnPoints(current);
    await rewardReferral(current);
    await notify({
      tone: "matcha",
      title: "ร้านยืนยันการชำระแล้ว",
      subtitle: "มาม่าบาร์ ไปต้มได้เลย",
      rows: [
        ["ออเดอร์", `#${no}`, true],
        ["ยอดชำระ", `฿${current.total}`],
        ["แต้มสะสม", `+${earned} (รวม ${await pointsBalance(current.line_user_id)})`],
      ],
      items: itemLines(current.items),
    });
  } else if (to === "pending") {
    await afterMatchaPaid(current);
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
      note: "ขอบคุณที่อุดหนุน CODE-MATCHA",
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
