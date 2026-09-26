import { NextResponse } from "next/server";
import { adminUri } from "@/lib/flex";
import { pushCard, verifyIdToken } from "@/lib/line";
import { rowWhen } from "@/lib/orders";
import { db } from "@/lib/supabase";

const MAX_BYTES = 4 * 1024 * 1024;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// ลูกค้าแนบสลิป → ออเดอร์ไปรอบาริสต้าตรวจ (แนบซ้ำได้จนกว่าร้านจะยืนยัน)
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
    .select("id,daily_no,pickup_date,pickup_time,total,status,customer_name,slip_path,service,table_no")
    .eq("id", id)
    .eq("line_user_id", user.userId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return fail("ไม่พบออเดอร์", 404);
  if (order.status !== "awaiting_payment" && order.status !== "payment_review")
    return fail("ออเดอร์นี้ไม่ได้รอชำระเงินแล้ว", 409);

  const path = `${order.pickup_date}/${order.id}-${Date.now()}.jpg`;
  const up = await db().storage.from("slips").upload(path, await file.arrayBuffer(), { contentType: file.type });
  if (up.error) {
    console.error("slip upload failed", up.error);
    return fail("อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }

  const { data: updated, error: updErr } = await db()
    .from("orders")
    .update({ status: "payment_review", slip_path: path, updated_at: new Date().toISOString() })
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
      subtitle: "เช็กยอดในแอปธนาคารก่อนกดยืนยัน",
      rows: [
        ["ออเดอร์", `#${order.daily_no}`, true],
        ["ลูกค้า", order.customer_name],
        ["ยอดที่ต้องได้รับ", `฿${order.total}`, true],
        ["วิธีรับ", rowWhen(order)],
      ],
      button: { label: "เปิดหน้าบาริสต้า", uri: adminUri() },
    });

  return NextResponse.json({ ok: true, no: order.daily_no, pickupTime: order.pickup_time, total: order.total });
}
