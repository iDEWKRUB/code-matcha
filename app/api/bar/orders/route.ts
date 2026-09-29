import { NextResponse } from "next/server";
import { BAR_MAX_QTY, TERMS_VERSION, barHoursText, type BarLine, type BarScan } from "@/lib/bar";
import { getBarHours, getBarItems } from "@/lib/barServer";
import { SHOP } from "@/lib/config";
import { isFriend, verifyIdToken } from "@/lib/line";
import type { OrderItem } from "@/lib/menu";
import { paymentFor, pointsBalance } from "@/lib/orders";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const MAX_PHOTO = 4 * 1024 * 1024;

async function user(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return token ? verifyIdToken(token) : null;
}

// ลูกค้าส่งรายการในถาด → สร้างออเดอร์รอชำระ (ราคาคิดใหม่ที่เซิร์ฟเวอร์)
export async function POST(req: Request) {
  const u = await user(req);
  if (!u) return fail("เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);
  if (SHOP.requireFriend && u.userId !== "dev" && !(await isFriend(u.userId)))
    return fail("กรุณาเพิ่ม Code-matcha เป็นเพื่อนใน LINE ก่อนสั่ง", 403);

  // ส่งมาเป็น form: รายการ + ผลสแกน + จำนวนที่ลูกค้านับ + ยอมรับเงื่อนไข + รูปถาด (หลักฐาน)
  const form = await req.formData().catch(() => null);
  if (!form) return fail("ข้อมูลไม่ถูกต้อง");
  const parse = (k: string) => {
    try {
      return JSON.parse(String(form.get(k) ?? "null"));
    } catch {
      return null;
    }
  };
  const lines = parse("lines");
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 30) return fail("ถาดว่างอยู่ สแกนของก่อนนะ");
  if (form.get("accept") !== String(TERMS_VERSION)) return fail("กรุณาติ๊กยอมรับเงื่อนไขทั้ง 2 ข้อก่อนชำระเงิน");
  const declared = Number(form.get("declared"));
  if (!Number.isInteger(declared) || declared < 1 || declared > 200) return fail("กรุณาบอกจำนวนชิ้นในถาด");
  const photo = form.get("photo");
  if (!(photo instanceof File) || !photo.type.startsWith("image/")) return fail("กรุณาถ่ายรูปถาดก่อนชำระเงิน");
  if (photo.size > MAX_PHOTO) return fail("รูปใหญ่เกินไป ลองถ่ายใหม่");

  const catalog = new Map((await getBarItems()).map((i) => [i.id, i]));
  const rawScan = (parse("scan") ?? {}) as { detected?: Record<string, unknown>; unknown?: unknown; unreadable?: unknown };
  const detected: Record<string, number> = {};
  for (const [id, n] of Object.entries(rawScan.detected ?? {}))
    if (catalog.has(id) && Number.isInteger(n) && (n as number) > 0) detected[id] = Math.min(n as number, 200);
  const unknownQr = Number.isInteger(rawScan.unknown) ? Math.min(Math.max(rawScan.unknown as number, 0), 200) : 0;
  const unreadable = Number.isInteger(rawScan.unreadable) ? Math.min(Math.max(rawScan.unreadable as number, 0), 200) : 0;
  const qtyById = new Map<string, number>();
  for (const raw of lines as Partial<BarLine>[]) {
    const id = String(raw?.id ?? "");
    const qty = Number(raw?.qty);
    if (!catalog.has(id)) return fail("มีของบางชิ้นที่ร้านไม่ได้ขายแล้ว กรุณาสแกนใหม่");
    if (!Number.isInteger(qty) || qty < 1 || qty > BAR_MAX_QTY) return fail("จำนวนไม่ถูกต้อง");
    qtyById.set(id, (qtyById.get(id) ?? 0) + qty);
  }
  const items: OrderItem[] = [];
  let total = 0;
  let count = 0;
  for (const [id, qty] of qtyById) {
    const it = catalog.get(id)!;
    if (qty > BAR_MAX_QTY) return fail("จำนวนไม่ถูกต้อง");
    items.push({ name: it.name, qty, detail: "มาม่าบาร์", price: it.price * qty });
    total += it.price * qty;
    count += qty;
  }
  if (total <= 0) return fail("ยอดรวมไม่ถูกต้อง");

  const hours = await getBarHours();
  if (!hours.openNow) return fail(`ตอนนี้มาม่าบาร์ยังไม่เปิด (${barHoursText(hours)})`, 409);
  if (!process.env.PROMPTPAY_ID) return fail("ร้านยังไม่ได้ตั้งค่าการรับเงิน กรุณาติดต่อร้าน", 503);

  const now = nowInShop();
  const time = `${String(Math.floor(now.minutes / 60)).padStart(2, "0")}:${String(now.minutes % 60).padStart(2, "0")}`;

  // เก็บรูปก่อนสร้างบิล: ไม่มีรูป = ไม่มีหลักฐาน ไม่ให้สร้างบิล
  const trayPath = `${now.date}/${crypto.randomUUID()}.jpg`;
  const up = await db().storage.from("trays").upload(trayPath, await photo.arrayBuffer(), { contentType: photo.type });
  if (up.error) {
    console.error("tray upload failed", up.error);
    return fail("อัปโหลดรูปถาดไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }
  const dropPhoto = () => db().storage.from("trays").remove([trayPath]);

  const { data, error } = await db().rpc("place_order", {
    p_date: now.date,
    p_time: time,
    p_capacity: 100000,
    p_user: u.userId,
    p_name: u.name,
    p_items: items,
    p_total: total,
    p_cups: count,
    p_note: "",
    p_hold_minutes: SHOP.holdMinutes,
    p_points: 0,
  });
  if (error) {
    await dropPhoto();
    console.error("bar place_order failed", error);
    return fail("บันทึกออเดอร์ไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }
  const row = (Array.isArray(data) ? data[0] : data) as { order_id: number; order_no: number; order_expires: string };
  const scan: BarScan = { detected, unknown: unknownQr, unreadable, declared, final: Object.fromEntries(qtyById) };
  const { error: srcErr } = await db()
    .from("orders")
    .update({
      source: "bar",
      service: "dine_in",
      tray_path: trayPath,
      bar_scan: scan,
      terms_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
    })
    .eq("id", row.order_id);
  if (srcErr) {
    // ติดป้าย/หลักฐานไม่ได้ = จะไปปนกับออเดอร์ปกติ ยกเลิกทิ้งดีกว่า
    await db().from("orders").update({ status: "cancelled" }).eq("id", row.order_id);
    await dropPhoto();
    console.error("bar set source failed", srcErr);
    return fail("บันทึกออเดอร์ไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }
  return NextResponse.json(
    await paymentFor({
      id: row.order_id,
      daily_no: row.order_no,
      total,
      discount: 0,
      pickup_time: time,
      expires_at: row.order_expires,
      service: "dine_in",
      table_no: "",
      promo_code: null,
      promo_discount: 0,
    }),
  );
}

// ออเดอร์มาม่าบาร์ล่าสุดของฉันวันนี้ที่ยังไม่จบ (กลับมาหน้าจ่าย/รอตรวจต่อได้) + แต้มคงเหลือ
export async function GET(req: Request) {
  const u = await user(req);
  if (!u) return fail("เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);
  const { data, error } = await db()
    .from("orders")
    .select("id,daily_no,total,discount,pickup_time,expires_at,service,table_no,promo_code,promo_discount,status")
    .eq("line_user_id", u.userId)
    .eq("pickup_date", nowInShop().date)
    .eq("source", "bar")
    .in("status", ["awaiting_payment", "payment_review"])
    .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw error;
  const o = data[0];
  const [pending, points] = await Promise.all([o ? paymentFor(o) : null, pointsBalance(u.userId)]);
  return NextResponse.json({ pending: pending && { ...pending, status: o.status }, points });
}
