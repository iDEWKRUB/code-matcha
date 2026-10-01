import { NextResponse } from "next/server";
import { checkSlip } from "@/lib/barServer";
import { adminUri } from "@/lib/flex";
import { pushCard, verifyIdToken } from "@/lib/line";
import { ORDER_COLUMNS, itemLines, rowWhen, type OrderRow } from "@/lib/orders";
import { afterMatchaPaid } from "@/lib/paid";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// ลูกค้าแนบสลิป → ตรวจกับ SlipOK ถ้าผ่าน ออเดอร์เข้าคิวทันที · ไม่ผ่าน/ยังไม่ตั้งค่า → รอบาริสต้าตรวจ (แนบซ้ำได้จนกว่าร้านจะยืนยัน)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return fail("เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);

  const form = await req.formData().catch(() => null);
  const file = form?.get("slip");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return fail("กรุณาแนบรูปสลิป");
  if (file.size > MAX_BYTES) return fail("รูปใหญ่เกินไป");

  const id = Number((await params).id);
  const { data: order, error } = await db()
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", id)
    .eq("line_user_id", user.userId)
    .maybeSingle<OrderRow>();
  if (error) throw error;
  if (!order) return fail("ไม่พบออเดอร์", 404);
  if (order.status !== "awaiting_payment" && order.status !== "payment_review")
    return fail("ออเดอร์นี้ไม่ได้รอชำระเงินแล้ว", 409);

  const bytes = await file.arrayBuffer();
  const path = `${order.pickup_date}/${order.id}-${Date.now()}.jpg`;
  const up = await db().storage.from("slips").upload(path, bytes, { contentType: file.type });
  if (up.error) {
    console.error("slip upload failed", up.error);
    return fail("อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }

  const check = await checkSlip(new Blob([bytes], { type: file.type }), order.total);
  const now = new Date().toISOString();
  let reason = check && !check.ok ? check.reason : "";

  if (check?.ok) {
    const { data: paid, error: paidErr } = await db()
      .from("orders")
      .update({ status: "pending", slip_path: path, slip_ref: check.ref, paid_at: now, updated_at: now })
      .eq("id", id)
      .in("status", ["awaiting_payment", "payment_review"])
      .select("id");
    if (paidErr?.code === "23505") reason = "สลิปนี้เคยใช้แล้ว";
    else if (paidErr) throw paidErr;
    else if (!paid?.length) return fail("ออเดอร์นี้ไม่ได้รอชำระเงินแล้ว", 409);
    else {
      if (order.slip_path) await db().storage.from("slips").remove([order.slip_path]);
      const [r] = await Promise.all([
        afterMatchaPaid(order, true),
        pushCard(process.env.LINE_STAFF_GROUP_ID, {
          tone: "amber",
          title: "ออเดอร์ใหม่ (ตรวจสลิปอัตโนมัติแล้ว)",
          subtitle: "ยอดเข้าแล้ว เริ่มทำได้เลย",
          rows: [
            ["ออเดอร์", `#${order.daily_no}`, true],
            ["ลูกค้า", order.customer_name],
            ["ยอด", `฿${order.total}`],
            ["วิธีรับ", rowWhen(order)],
          ],
          items: itemLines(order.items),
          note: [order.note && `หมายเหตุ: ${order.note}`, order.cup_msg && "มีข้อความบนแก้ว: พิมพ์สติ๊กเกอร์จากหน้าบาริสต้า"].filter(Boolean).join(" · ") || undefined,
          button: { label: "เปิดหน้าบาริสต้า", uri: adminUri() },
        }, { orderNo: order.daily_no }),
      ]);
      return NextResponse.json({ ok: true, status: "paid", no: order.daily_no, pickupTime: order.pickup_time, total: order.total, ...r });
    }
  }

  const { data: updated, error: updErr } = await db()
    .from("orders")
    .update({ status: "payment_review", slip_path: path, updated_at: now })
    .eq("id", id)
    .in("status", ["awaiting_payment", "payment_review"])
    .select("id");
  if (updErr) throw updErr;
  if (!updated?.length) return fail("ออเดอร์นี้ไม่ได้รอชำระเงินแล้ว", 409);
  if (order.slip_path) await db().storage.from("slips").remove([order.slip_path]);

  if (order.status === "awaiting_payment")
    await pushCard(process.env.LINE_STAFF_GROUP_ID, {
      tone: "amber",
      title: "สลิปใหม่รอตรวจ",
      subtitle: reason ? `ตรวจอัตโนมัติไม่ผ่าน: ${reason}` : "เช็กยอดในแอปธนาคารก่อนกดยืนยัน",
      rows: [
        ["ออเดอร์", `#${order.daily_no}`, true],
        ["ลูกค้า", order.customer_name],
        ["ยอดที่ต้องได้รับ", `฿${order.total}`, true],
        ["วิธีรับ", rowWhen(order)],
      ],
      button: { label: "เปิดหน้าบาริสต้า", uri: adminUri() },
    }, { orderNo: order.daily_no });

  return NextResponse.json({ ok: true, status: "review", reason, no: order.daily_no, pickupTime: order.pickup_time, total: order.total });
}
