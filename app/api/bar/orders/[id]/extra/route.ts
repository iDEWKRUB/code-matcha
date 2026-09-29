import QRCode from "qrcode";
import { NextResponse } from "next/server";
import type { ExtraItem, ExtraStatus } from "@/lib/bar";
import { checkSlip, notifyExtraPaid, trayUrls } from "@/lib/barServer";
import { adminUri } from "@/lib/flex";
import { pushCard, verifyIdToken } from "@/lib/line";
import type { OrderItem } from "@/lib/menu";
import { promptPayPayload } from "@/lib/promptpay";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function mine(req: Request, id: number, cols: string) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return { user: null, order: null };
  const { data, error } = await db().from("orders").select(cols).eq("id", id).eq("line_user_id", user.userId).eq("source", "bar").maybeSingle();
  if (error) throw error;
  return { user, order: data as Record<string, unknown> | null };
}

// รายละเอียดเรียกเก็บเพิ่มของบิลฉัน (รูปถาด รายการที่จ่ายแล้ว รายการที่ยังไม่จ่าย QR ยอดเพิ่ม)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, order: o } = await mine(
    req,
    Number((await params).id),
    "id,daily_no,created_at,items,total,tray_path,bar_extra,bar_extra_note,bar_extra_items,bar_extra_status",
  );
  if (!user) return fail("เซสชัน LINE หมดอายุ", 401);
  if (!o || o.bar_extra_status === "none") return fail("ไม่พบรายการเรียกเก็บเพิ่มของบิลนี้", 404);
  const photo = o.tray_path ? ((await trayUrls([o.tray_path as string])).get(o.tray_path as string) ?? null) : null;
  const amount = o.bar_extra as number;
  const due = o.bar_extra_status === "due" || o.bar_extra_status === "review";
  const id = process.env.PROMPTPAY_ID;
  return NextResponse.json({
    id: o.id,
    no: o.daily_no,
    at: o.created_at,
    items: o.items as OrderItem[],
    total: o.total,
    photo,
    extra: amount,
    extraItems: o.bar_extra_items as ExtraItem[],
    note: o.bar_extra_note,
    status: o.bar_extra_status as ExtraStatus,
    qr: due && id ? await QRCode.toDataURL(promptPayPayload(id, amount), { margin: 1, width: 480, errorCorrectionLevel: "M" }) : null,
  });
}

// ลูกค้าแนบสลิปชำระเพิ่ม → SlipOK ผ่าน = จ่ายแล้ว, ไม่ผ่าน/ยังไม่ตั้งค่า = รอร้านตรวจ
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { user, order: o } = await mine(req, id, "id,daily_no,pickup_date,customer_name,bar_extra,bar_extra_status,bar_extra_slip_path");
  if (!user) return fail("เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);
  if (!o) return fail("ไม่พบบิล", 404);
  if (o.bar_extra_status !== "due" && o.bar_extra_status !== "review") return fail("บิลนี้ไม่มียอดค้างชำระเพิ่มแล้ว", 409);

  const form = await req.formData().catch(() => null);
  const file = form?.get("slip");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return fail("กรุณาแนบรูปสลิป");
  if (file.size > MAX_BYTES) return fail("รูปใหญ่เกินไป");

  const bytes = await file.arrayBuffer();
  const path = `${o.pickup_date}/${id}-extra-${Date.now()}.jpg`;
  const up = await db().storage.from("slips").upload(path, bytes, { contentType: file.type });
  if (up.error) {
    console.error("extra slip upload failed", up.error);
    return fail("อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }
  const old = o.bar_extra_slip_path as string | null;
  const amount = o.bar_extra as number;
  const check = await checkSlip(new Blob([bytes], { type: file.type }), amount);
  const now = new Date().toISOString();
  let reason = check && !check.ok ? check.reason : "";

  if (check?.ok) {
    const { data, error } = await db()
      .from("orders")
      .update({ bar_extra_status: "paid", bar_extra_slip_path: path, bar_extra_slip_ref: check.ref, bar_extra_paid_at: now })
      .eq("id", id)
      .in("bar_extra_status", ["due", "review"])
      .select("id");
    if (error?.code === "23505") reason = "สลิปนี้เคยใช้แล้ว";
    else if (error) throw error;
    else if (!data.length) return fail("บิลนี้ไม่มียอดค้างชำระเพิ่มแล้ว", 409);
    else {
      if (old) await db().storage.from("slips").remove([old]);
      await notifyExtraPaid(id);
      return NextResponse.json({ status: "paid" });
    }
  }

  const { error } = await db().from("orders").update({ bar_extra_status: "review", bar_extra_slip_path: path }).eq("id", id).in("bar_extra_status", ["due", "review"]);
  if (error) throw error;
  if (old) await db().storage.from("slips").remove([old]);
  if (o.bar_extra_status === "due")
    await pushCard(process.env.LINE_STAFF_GROUP_ID, {
      tone: "amber",
      title: "มาม่าบาร์: สลิปชำระเพิ่มรอตรวจ",
      subtitle: reason ? `ตรวจอัตโนมัติไม่ผ่าน: ${reason}` : "เช็กยอดในแอปธนาคารก่อนกดยืนยัน",
      rows: [
        ["บิล", `#${o.daily_no}`, true],
        ["ลูกค้า", o.customer_name as string],
        ["ยอดชำระเพิ่ม", `฿${amount}`, true],
      ],
      button: { label: "เปิดหน้ามาม่าบาร์", uri: `${adminUri()}/bar` },
    }, { orderNo: o.daily_no as number });
  return NextResponse.json({ status: "review", reason });
}
