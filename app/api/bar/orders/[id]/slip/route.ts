import { NextResponse } from "next/server";
import { checkSlip } from "@/lib/barServer";
import { adminUri } from "@/lib/flex";
import { pushCard, verifyIdToken } from "@/lib/line";
import { earnPoints, itemLines, pointsBalance } from "@/lib/orders";
import { rewardReferral } from "@/lib/referral";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// แนบสลิปมาม่าบาร์ → ตรวจกับ SlipOK ถ้าผ่าน ปิดออเดอร์ให้ลูกค้าไปต้มได้เลย ไม่ผ่าน/ยังไม่ตั้งค่า → ร้านตรวจเอง
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
    .select("id,daily_no,pickup_date,total,status,customer_name,line_user_id,slip_path,items")
    .eq("id", id)
    .eq("line_user_id", user.userId)
    .eq("source", "bar")
    .maybeSingle();
  if (error) throw error;
  if (!order) return fail("ไม่พบออเดอร์", 404);
  if (order.status !== "awaiting_payment" && order.status !== "payment_review") return fail("ออเดอร์นี้ไม่ได้รอชำระเงินแล้ว", 409);

  const bytes = await file.arrayBuffer();
  const path = `${order.pickup_date}/${order.id}-${Date.now()}.jpg`;
  const up = await db().storage.from("slips").upload(path, bytes, { contentType: file.type });
  if (up.error) {
    console.error("bar slip upload failed", up.error);
    return fail("อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }

  const check = await checkSlip(new Blob([bytes], { type: file.type }), order.total);
  const now = new Date().toISOString();
  let reason = check && !check.ok ? check.reason : "";

  if (check?.ok) {
    const { data: done, error: paidErr } = await db()
      .from("orders")
      .update({ status: "completed", slip_path: path, slip_ref: check.ref, paid_at: now, updated_at: now })
      .eq("id", id)
      .in("status", ["awaiting_payment", "payment_review"])
      .select("id");
    if (paidErr?.code === "23505") reason = "สลิปนี้เคยใช้แล้ว";
    else if (paidErr) throw paidErr;
    else if (!done?.length) return fail("ออเดอร์นี้ไม่ได้รอชำระเงินแล้ว", 409);
    else {
      if (order.slip_path) await db().storage.from("slips").remove([order.slip_path]);
      const earned = await earnPoints(order);
      await rewardReferral(order);
      return NextResponse.json({ status: "paid", no: order.daily_no, total: order.total, earned, points: await pointsBalance(user.userId) });
    }
  }

  // ร้านตรวจเอง
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
    title: "มาม่าบาร์: สลิปรอตรวจ",
    subtitle: reason ? `ตรวจอัตโนมัติไม่ผ่าน: ${reason}` : "เช็กยอดในแอปธนาคารก่อนกดยืนยัน",
    rows: [
      ["ออเดอร์", `#${order.daily_no}`, true],
      ["ลูกค้า", order.customer_name],
      ["ยอดที่ต้องได้รับ", `฿${order.total}`, true],
    ],
    items: itemLines(order.items),
    button: { label: "เปิดหน้าบาริสต้า", uri: adminUri() },
  }, { orderNo: order.daily_no });

  return NextResponse.json({ status: "review", no: order.daily_no, total: order.total, reason });
}
