import { NextResponse } from "next/server";
import { POINTS, SHOP } from "@/lib/config";
import { adminUri } from "@/lib/flex";
import { promoDiscount } from "@/lib/promo";
import { checkPromo } from "@/lib/promoServer";
import { pushCard, verifyIdToken } from "@/lib/line";
import {
  MAX_QTY,
  MILKS,
  POWDERS,
  SWEET,
  hasPowder,
  lineDetail,
  linePrice,
  optionGroups,
  whenText,
  type CartLine,
  type OrderItem,
  type Service,
} from "@/lib/menu";
import { getMenu, getSettings, itemLines, openNow, paymentFor, pointsBalance, queueAhead } from "@/lib/orders";
import { db } from "@/lib/supabase";
import { isBookable, nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return fail("เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);

  let body: {
    lines?: unknown;
    pickupTime?: unknown;
    note?: unknown;
    points?: unknown;
    service?: unknown;
    tableNo?: unknown;
    promoCode?: unknown;
  };
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
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return fail("จำนวนไม่ถูกต้อง");
    let line: CartLine;
    if (item.kind === "food") {
      // อาหาร: ใช้แค่ท็อปปิ้ง (ต้องเป็นของเมนูนี้ ไม่ซ้ำ)
      const tops = Array.isArray(raw.toppings) ? [...new Set(raw.toppings.map(String))] : [];
      if (tops.some((id) => !item.toppings.some((t) => t.id === id))) return fail("ท็อปปิ้งไม่ถูกต้อง");
      // ตัวเลือกแบบกลุ่ม ต้องเลือกกลุ่มละ 1 อย่างพอดี
      for (const g of optionGroups(item))
        if (g.options.filter((o) => tops.includes(o.id)).length !== 1) return fail(`กรุณาเลือก${g.name}`);
      line = { itemId: item.id, temp: item.temps[0] ?? "hot", sweet: 0, milk: null, powder: null, extraShot: false, softCream: false, toppings: tops, qty };
    } else {
      line = {
        itemId: item.id,
        temp: raw.temp as CartLine["temp"],
        sweet: Number(raw.sweet),
        milk: item.milk ? String(raw.milk) : null,
        powder: hasPowder(item) ? String(raw.powder) : null,
        extraShot: raw.extraShot === true,
        softCream: raw.softCream === true,
        toppings: [],
        qty,
      };
      if (!item.temps.includes(line.temp)) return fail("อุณหภูมิไม่ถูกต้อง");
      if (!SWEET.includes(line.sweet)) return fail("ระดับความหวานไม่ถูกต้อง");
      if (item.milk && !MILKS.some((m) => m.id === line.milk)) return fail("ชนิดนมไม่ถูกต้อง");
      if (line.powder !== null && !POWDERS.some((p) => p.id === line.powder)) return fail("ผงมัทฉะไม่ถูกต้อง");
      if (line.softCream && line.temp !== "iced") return fail("ท็อปซอฟต์ครีมได้เฉพาะเครื่องดื่มเย็น");
    }
    const price = linePrice(item, line);
    items.push({ name: item.name, qty: line.qty, detail: lineDetail(item, line), price });
    total += price;
    cups += line.qty;
  }
  const shop = await getSettings();
  if (!shop.accepting) return fail("ร้านปิดรับออเดอร์ชั่วคราว", 409);

  // วิธีรับ: สั่งล่วงหน้าต้องเลือกรอบ / อยู่ที่ร้านแล้ว (ทานที่ร้าน, กลับบ้าน) ทำให้เลยตอนร้านเปิด
  const service: Service = body.service === "dine_in" || body.service === "takeaway" ? body.service : "pickup";
  const tableNo = service === "dine_in" && typeof body.tableNo === "string" ? body.tableNo.trim().slice(0, 10) : "";
  const now = nowInShop();
  let time: string;
  if (service === "pickup") {
    if (cups > shop.slotCapacity) return fail(`สั่งได้สูงสุด ${shop.slotCapacity} รายการต่อรอบรับ`);
    if (typeof pickupTime !== "string" || !isBookable(pickupTime, now.minutes, shop))
      return fail("เวลารับนี้ไม่ว่างแล้ว เลือกเวลาอื่น", 409);
    time = pickupTime;
  } else {
    if (!openNow(shop)) return fail(`ตอนนี้ร้านยังไม่เปิด (เปิด ${shop.openTime}–${shop.closeTime} น.)`, 409);
    time = `${String(Math.floor(now.minutes / 60)).padStart(2, "0")}:${String(now.minutes % 60).padStart(2, "0")}`;
  }

  const cleanNote = typeof note === "string" ? note.trim().slice(0, 200) : "";
  if (!process.env.PROMPTPAY_ID) return fail("ร้านยังไม่ได้ตั้งค่าการรับเงิน กรุณาติดต่อร้าน", 503);

  // โค้ดส่วนลด (ตรวจสิทธิ์ใหม่ที่เซิร์ฟเวอร์ทุกครั้ง) หักก่อนแต้ม
  let promoCode: string | null = null;
  let promoOff = 0;
  if (typeof body.promoCode === "string" && body.promoCode.trim()) {
    const r = await checkPromo(body.promoCode, user.userId, total);
    if ("error" in r) return fail(r.error, 409);
    promoCode = r.rule.code;
    promoOff = promoDiscount(r.rule, total);
  }
  const afterPromo = total - promoOff;

  // แต้มที่ใช้ (1 แต้ม = 1 บาท) ห้ามเกินยอดหลังหักโค้ด; ยอดคงเหลือตรวจอีกครั้งใน place_order
  const points = Number(body.points ?? 0);
  if (!Number.isInteger(points) || points < 0 || points > afterPromo) return fail("จำนวนแต้มไม่ถูกต้อง");
  if (points > 0 && points < POINTS.minRedeem) return fail(`ใช้แต้มได้ครั้งละอย่างน้อย ${POINTS.minRedeem} แต้ม`);
  const pay = afterPromo - points;

  const { data, error } = await db().rpc("place_order", {
    p_date: now.date,
    p_time: time,
    // ลูกค้าหน้าร้านไม่นับโควตารอบรับ
    p_capacity: service === "pickup" ? shop.slotCapacity : 100000,
    p_user: user.userId,
    p_name: user.name,
    p_items: items,
    p_total: pay,
    p_cups: cups,
    p_note: cleanNote,
    p_hold_minutes: SHOP.holdMinutes,
    p_points: points,
  });
  if (error) {
    if (error.message.includes("SLOT_FULL")) return fail("เวลารับนี้เต็มแล้ว เลือกเวลาอื่น", 409);
    if (error.message.includes("POINTS_LOW")) return fail("แต้มสะสมไม่พอ", 409);
    console.error("place_order failed", error);
    return fail("บันทึกออเดอร์ไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }
  const row = (Array.isArray(data) ? data[0] : data) as { order_id: number; order_no: number; order_expires: string; order_status: string };
  if (service !== "pickup" || promoCode) {
    const { error: svcErr } = await db()
      .from("orders")
      .update({ service, table_no: tableNo, promo_code: promoCode, promo_discount: promoOff })
      .eq("id", row.order_id);
    if (svcErr) console.error("set service/promo failed", svcErr);
  }
  const when = whenText({ service, pickupTime: time, tableNo });

  // ใช้แต้มจ่ายครบ: เข้าคิวทันที แจ้งร้านและลูกค้าเลย
  if (row.order_status === "pending") {
    const lines = itemLines(items);
    const [ahead, balance] = await Promise.all([queueAhead(now.date, time, row.order_no), pointsBalance(user.userId)]);
    await Promise.all([
      pushCard(process.env.LINE_STAFF_GROUP_ID, {
        tone: "amber",
        title: "ออเดอร์ใหม่ (ไม่ต้องชำระเงิน)",
        subtitle: "ไม่ต้องตรวจสลิป เริ่มทำได้เลย",
        rows: [
          ["ออเดอร์", `#${row.order_no}`, true],
          ["ลูกค้า", user.name],
          ["วิธีรับ", when],
        ],
        items: lines,
        note: cleanNote ? `หมายเหตุ: ${cleanNote}` : undefined,
        button: { label: "เปิดหน้าบาริสต้า", uri: adminUri() },
      }, { orderNo: row.order_no }),
      pushCard(user.userId, {
        tone: "matcha",
        title: points > 0 ? "แลกแต้มสำเร็จ เข้าคิวแล้ว" : "ใช้โค้ดสำเร็จ เข้าคิวแล้ว",
        subtitle: [points > 0 && `ใช้ ${points} แต้ม`, promoCode && `โค้ด ${promoCode} −฿${promoOff}`, "ไม่ต้องชำระเงิน"].filter(Boolean).join(" · "),
        rows: [
          ["ออเดอร์", `#${row.order_no}`, true],
          ["วิธีรับ", when],
          ["คิวก่อนหน้า", ahead ? `${ahead} คิว` : "ไม่มี ทำต่อเลย"],
          ["แต้มคงเหลือ", `${balance} แต้ม`],
        ],
        items: lines,
        note: "ออเดอร์เสร็จเมื่อไรจะแจ้งทาง LINE อีกครั้ง",
      }, { name: user.name, orderNo: row.order_no }),
    ]);
    return NextResponse.json({ free: true, no: row.order_no, pickupTime: time, service, tableNo, total: 0, discount: points, promoCode, promoDiscount: promoOff });
  }

  // ยังไม่แจ้งร้าน: ออเดอร์จะเข้าคิวหลังร้านยืนยันสลิป
  return NextResponse.json(
    await paymentFor({
      id: row.order_id,
      daily_no: row.order_no,
      total: pay,
      discount: points,
      pickup_time: time,
      expires_at: row.order_expires,
      service,
      table_no: tableNo,
      promo_code: promoCode,
      promo_discount: promoOff,
    }),
  );
}

// ออเดอร์ของฉันที่ยังรอชำระ (กลับมาจ่ายต่อหลังปิดหน้า)
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return fail("เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);
  const { data, error } = await db()
    .from("orders")
    .select("id,daily_no,total,discount,pickup_time,expires_at,service,table_no,promo_code,promo_discount")
    .eq("line_user_id", user.userId)
    .eq("pickup_date", nowInShop().date)
    .eq("status", "awaiting_payment")
    .gt("expires_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw error;
  const [pending, points] = await Promise.all([data[0] ? paymentFor(data[0]) : null, pointsBalance(user.userId)]);
  return NextResponse.json({ pending, points });
}
