import { NextResponse } from "next/server";
import { SHOP } from "@/lib/config";
import { verifyIdToken } from "@/lib/line";
import { MAX_QTY, MILKS, POWDERS, SWEET, hasPowder, lineDetail, linePrice, type CartLine, type OrderItem } from "@/lib/menu";
import { getMenu, paymentFor } from "@/lib/orders";
import { db } from "@/lib/supabase";
import { isBookable, nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return fail("เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);

  let body: { lines?: unknown; pickupTime?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("ข้อมูลไม่ถูกต้อง");
  }

  const { lines, pickupTime, note } = body;
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 20) return fail("ตะกร้าไม่ถูกต้อง");

  // คำนวณราคาใหม่ที่เซิร์ฟเวอร์ทุกครั้ง ไม่เชื่อราคาจากหน้าเว็บ
  const menu = new Map((await getMenu()).map((m) => [m.id, m]));
  const items: OrderItem[] = [];
  let total = 0;
  let cups = 0;
  for (const raw of lines as Partial<CartLine>[]) {
    const item = menu.get(String(raw?.itemId));
    if (!item) return fail("ไม่พบเมนูนี้");
    if (!item.available) return fail(`${item.name} หมดแล้ว`);
    const line: CartLine = {
      itemId: item.id,
      temp: raw.temp as CartLine["temp"],
      sweet: Number(raw.sweet),
      milk: item.milk ? String(raw.milk) : null,
      powder: hasPowder(item) ? String(raw.powder) : null,
      extraShot: raw.extraShot === true,
      softCream: raw.softCream === true,
      qty: Number(raw.qty),
    };
    if (!item.temps.includes(line.temp)) return fail("อุณหภูมิไม่ถูกต้อง");
    if (!SWEET.includes(line.sweet)) return fail("ระดับความหวานไม่ถูกต้อง");
    if (item.milk && !MILKS.some((m) => m.id === line.milk)) return fail("ชนิดนมไม่ถูกต้อง");
    if (line.powder !== null && !POWDERS.some((p) => p.id === line.powder)) return fail("ผงมัทฉะไม่ถูกต้อง");
    if (line.softCream && line.temp !== "iced") return fail("ท็อปซอฟต์ครีมได้เฉพาะเครื่องดื่มเย็น");
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > MAX_QTY) return fail("จำนวนไม่ถูกต้อง");
    const price = linePrice(item, line);
    items.push({ name: item.name, qty: line.qty, detail: lineDetail(line), price });
    total += price;
    cups += line.qty;
  }
  if (cups > SHOP.slotCapacity) return fail(`สั่งได้สูงสุด ${SHOP.slotCapacity} แก้วต่อรอบรับ`);

  const now = nowInShop();
  if (typeof pickupTime !== "string" || !isBookable(pickupTime, now.minutes))
    return fail("เวลารับนี้ไม่ว่างแล้ว เลือกเวลาอื่น", 409);

  const cleanNote = typeof note === "string" ? note.trim().slice(0, 200) : "";
  if (!process.env.PROMPTPAY_ID) return fail("ร้านยังไม่ได้ตั้งค่าการรับเงิน กรุณาติดต่อร้าน", 503);

  const { data, error } = await db().rpc("place_order", {
    p_date: now.date,
    p_time: pickupTime,
    p_capacity: SHOP.slotCapacity,
    p_user: user.userId,
    p_name: user.name,
    p_items: items,
    p_total: total,
    p_cups: cups,
    p_note: cleanNote,
    p_hold_minutes: SHOP.holdMinutes,
  });
  if (error) {
    if (error.message.includes("SLOT_FULL")) return fail("เวลารับนี้เต็มแล้ว เลือกเวลาอื่น", 409);
    console.error("place_order failed", error);
    return fail("บันทึกออเดอร์ไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }
  const row = (Array.isArray(data) ? data[0] : data) as { order_id: number; order_no: number; order_expires: string };

  // ยังไม่แจ้งร้าน: ออเดอร์จะเข้าคิวหลังร้านยืนยันสลิป
  return NextResponse.json(
    await paymentFor({ id: row.order_id, daily_no: row.order_no, total, pickup_time: pickupTime, expires_at: row.order_expires }),
  );
}

// ออเดอร์ของฉันที่ยังรอชำระ (กลับมาจ่ายต่อหลังปิดหน้า)
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return fail("เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);
  const { data, error } = await db()
    .from("orders")
    .select("id,daily_no,total,pickup_time,expires_at")
    .eq("line_user_id", user.userId)
    .eq("pickup_date", nowInShop().date)
    .eq("status", "awaiting_payment")
    .gt("expires_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw error;
  return NextResponse.json({ pending: data[0] ? await paymentFor(data[0]) : null });
}
