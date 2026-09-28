import { NextResponse } from "next/server";
import { BAR_MAX_QTY, type BarLine } from "@/lib/bar";
import { getBarItems } from "@/lib/barServer";
import { SHOP } from "@/lib/config";
import { isFriend, verifyIdToken } from "@/lib/line";
import type { OrderItem } from "@/lib/menu";
import { getSettings, openNow, paymentFor, pointsBalance } from "@/lib/orders";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

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

  const body = (await req.json().catch(() => null)) as { lines?: unknown } | null;
  const lines = body?.lines;
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 30) return fail("ถาดว่างอยู่ สแกนของก่อนนะ");

  const catalog = new Map((await getBarItems()).map((i) => [i.id, i]));
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

  const shop = await getSettings();
  if (!openNow(shop)) return fail(`ตอนนี้ร้านยังไม่เปิด (เปิด ${shop.openTime}–${shop.closeTime} น.)`, 409);
  if (!process.env.PROMPTPAY_ID) return fail("ร้านยังไม่ได้ตั้งค่าการรับเงิน กรุณาติดต่อร้าน", 503);

  const now = nowInShop();
  const time = `${String(Math.floor(now.minutes / 60)).padStart(2, "0")}:${String(now.minutes % 60).padStart(2, "0")}`;
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
    console.error("bar place_order failed", error);
    return fail("บันทึกออเดอร์ไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }
  const row = (Array.isArray(data) ? data[0] : data) as { order_id: number; order_no: number; order_expires: string };
  const { error: srcErr } = await db().from("orders").update({ source: "bar", service: "dine_in" }).eq("id", row.order_id);
  if (srcErr) {
    // ติดป้ายไม่ได้ = จะไปปนกับออเดอร์ปกติ ยกเลิกทิ้งดีกว่า
    await db().from("orders").update({ status: "cancelled" }).eq("id", row.order_id);
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
