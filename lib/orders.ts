import "server-only";
import QRCode from "qrcode";
import { pointsEarned } from "./config";
import { whenText, type Delivery, type MenuItem, type Order, type Payment, type Powder, type Service, type ShopSettings, type Slot } from "./menu";
import { promptPayPayload } from "./promptpay";
import { db } from "./supabase";
import { parseClosedDates, parseWeekly, scheduleFor } from "./schedule";
import { isBookable, nowInShop, slotTimes, toMinutes } from "./time";

export const MENU_COLUMNS =
  "id,name,jp,description,price,temps,milk,available,promoPrice:promo_price,recommended,look,sort,kind,toppings,grams:matcha_grams,addons,sweetChoice:sweet_choice,photoUrl:photo_url,hidden";

export async function getMenu(): Promise<MenuItem[]> {
  const { data, error } = await db().from("menu_items").select(MENU_COLUMNS).order("sort");
  if (error) throw error;
  // ราคาโปรต้องถูกกว่าราคาปกติ ไม่งั้นถือว่าไม่มีโปร (กันลูกค้าจ่ายแพงกว่าปกติ)
  return (data as unknown as MenuItem[]).map((m) => (m.promoPrice !== null && m.promoPrice >= m.price ? { ...m, promoPrice: null } : m));
}

// ผงมัทฉะให้ลูกค้าเลือก (activeOnly = เฉพาะที่เปิดขาย) เรียงตาม sort
export async function getPowders(activeOnly = true): Promise<Powder[]> {
  let q = db().from("matcha_powders").select("id,name,note,extra_per_gram,cost_item_id,active,sort,image_url,cost_items(image_url)").order("sort").order("id");
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((p) => ({
    id: String(p.id),
    name: p.name,
    note: p.note,
    extraPerGram: Number(p.extra_per_gram) || 0,
    costItemId: p.cost_item_id,
    active: p.active,
    sort: p.sort,
    ownImage: p.image_url,
    imageUrl: p.image_url ?? (p.cost_items as unknown as { image_url: string | null } | null)?.image_url ?? null,
  }));
}

export async function getSettings(): Promise<ShopSettings> {
  const { data, error } = await db()
    .from("shop_settings")
    .select("banner,banner_active,notice,notice_active,notice_until,open_time,close_time,weekly_hours,closed_dates,slot_minutes,slot_capacity,accepting,order_no_start,delivery_enabled,delivery_km,delivery_min,shop_lat,shop_lng,preorder_enabled,preorder_from,preorder_cutoff")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  // ตารางเวลารายสัปดาห์: วันนี้ปิดตามตาราง = ไม่รับออเดอร์ (เวลาเปิด/ปิดที่ส่งออกไปคือของ "วันนี้")
  const baseOpen = data?.open_time ?? "10:30";
  const baseClose = data?.close_time ?? "17:00";
  const weekly = parseWeekly(data?.weekly_hours, baseOpen, baseClose);
  const closedDates = parseClosedDates(data?.closed_dates);
  const today = scheduleFor(weekly, closedDates, nowInShop().date);
  const manual = data?.accepting ?? true;
  return {
    banner: data?.banner ?? "",
    bannerActive: data?.banner_active ?? false,
    notice: data?.notice ?? "",
    noticeActive: data?.notice_active ?? false,
    noticeUntil: data?.notice_until ?? null,
    openTime: today.closed ? baseOpen : today.open,
    closeTime: today.closed ? baseClose : today.close,
    weekly,
    closedDates,
    closedReason: today.reason,
    manualAccepting: manual,
    slotMinutes: data?.slot_minutes ?? 15,
    slotCapacity: data?.slot_capacity ?? 8,
    accepting: manual && !today.closed,
    orderNoStart: data?.order_no_start ?? 1,
    deliveryEnabled: data?.delivery_enabled ?? false,
    deliveryKm: Number(data?.delivery_km ?? 5),
    deliveryMin: data?.delivery_min ?? 150,
    shopLat: data?.shop_lat ?? null,
    shopLng: data?.shop_lng ?? null,
    preorderEnabled: data?.preorder_enabled ?? false,
    preorderFrom: data?.preorder_from ?? "06:00",
    preorderCutoff: data?.preorder_cutoff ?? "20:00",
  };
}

// ออเดอร์ที่ยังใช้ที่ในช่องเวลา: ไม่ถูกยกเลิก และไม่ใช่รอชำระที่หมดเวลาแล้ว
const holdsSlot = (o: { status: string; expires_at: string | null }) =>
  o.status !== "cancelled" && !(o.status === "awaiting_payment" && o.expires_at && new Date(o.expires_at) < new Date());

export async function getTodaySlots(s: ShopSettings): Promise<Slot[]> {
  if (!s.accepting) return [];
  const now = nowInShop();
  const { data, error } = await db()
    .from("orders")
    .select("pickup_time,cups,status,expires_at")
    .eq("pickup_date", now.date)
    .neq("status", "cancelled");
  if (error) throw error;
  const used = new Map<string, number>();
  for (const r of data.filter(holdsSlot)) used.set(r.pickup_time, (used.get(r.pickup_time) ?? 0) + r.cups);
  return slotTimes(s)
    .filter((t) => isBookable(t, now.minutes, s))
    .map((time) => ({ time, remaining: Math.max(0, s.slotCapacity - (used.get(time) ?? 0)) }));
}

// รอบรับของพรุ่งนี้ (สั่งล่วงหน้า): ตั้งแต่ preorderFrom ถึงก่อนปิดร้าน · ปิดรับเมื่อเลยเวลา preorderCutoff ของวันนี้
export function tomorrowDate() {
  const { date } = nowInShop();
  return new Date(new Date(date + "T12:00:00+07:00").getTime() + 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}
export const tomorrowSchedule = (s: ShopSettings) => scheduleFor(s.weekly, s.closedDates, tomorrowDate());
export function preorderOpen(s: ShopSettings) {
  // สั่งล่วงหน้าของพรุ่งนี้ได้แม้วันนี้ร้านหยุดตามตาราง (ถ้ายังไม่ปิดรับออเดอร์เอง) แต่ไม่ได้ถ้าพรุ่งนี้ร้านหยุด
  return s.manualAccepting && s.preorderEnabled && !tomorrowSchedule(s).closed && nowInShop().minutes < toMinutes(s.preorderCutoff);
}
export function tomorrowTimes(s: ShopSettings) {
  const t = tomorrowSchedule(s);
  const from = Math.min(toMinutes(s.preorderFrom), toMinutes(t.open));
  return slotTimes({ ...s, openTime: `${String(Math.floor(from / 60)).padStart(2, "0")}:${String(from % 60).padStart(2, "0")}`, closeTime: t.close });
}
export async function getTomorrowSlots(s: ShopSettings): Promise<Slot[]> {
  if (!preorderOpen(s)) return [];
  const { data, error } = await db().from("orders").select("pickup_time,cups,status,expires_at").eq("pickup_date", tomorrowDate()).neq("status", "cancelled");
  if (error) throw error;
  const used = new Map<string, number>();
  for (const r of data.filter(holdsSlot)) used.set(r.pickup_time, (used.get(r.pickup_time) ?? 0) + r.cups);
  return tomorrowTimes(s).map((time) => ({ time, remaining: Math.max(0, s.slotCapacity - (used.get(time) ?? 0)) }));
}

// ออเดอร์ที่จ่ายแล้วและยังไม่เสร็จ ที่ต้องทำก่อน (เวลารับเร็วกว่า หรือเวลาเดียวกันแต่สั่งก่อน)
export async function queueAhead(date: string, pickupTime: string, no: number) {
  const { data, error } = await db()
    .from("orders")
    .select("pickup_time,daily_no")
    .eq("pickup_date", date)
    .in("status", ["pending", "preparing"])
    .lte("pickup_time", pickupTime);
  if (error) {
    console.error("queueAhead failed", error);
    return 0;
  }
  return data.filter((o) => o.pickup_time < pickupTime || o.daily_no < no).length;
}

export async function paymentFor(
  r: Pick<OrderRow, "id" | "daily_no" | "total" | "discount" | "pickup_time" | "expires_at" | "service" | "table_no" | "promo_code" | "promo_discount"> & { pickup_date?: string },
): Promise<Payment> {
  const id = process.env.PROMPTPAY_ID;
  if (!id) throw new Error("Missing environment variable PROMPTPAY_ID");
  const qr = await QRCode.toDataURL(promptPayPayload(id, r.total), { margin: 1, width: 480, errorCorrectionLevel: "M" });
  return {
    id: r.id,
    no: r.daily_no,
    total: r.total,
    discount: r.discount,
    pickupTime: r.pickup_time,
    pickupDate: r.pickup_date,
    service: r.service,
    tableNo: r.table_no,
    promoCode: r.promo_code,
    promoDiscount: r.promo_discount ?? 0,
    expiresAt: r.expires_at ?? "",
    qr,
  };
}

// ร้านเปิดอยู่ตอนนี้ไหม (สำหรับลูกค้าที่อยู่หน้าร้าน สั่งแล้วทำเลย)
export function openNow(s: ShopSettings) {
  const m = nowInShop().minutes;
  return s.accepting && m >= toMinutes(s.openTime) && m < toMinutes(s.closeTime);
}

// แถวที่อยู่จัดส่งในการ์ดแจ้งร้าน
export const deliveryRows = (d: Delivery | null | undefined): [string, string][] =>
  d ? [["ส่งที่", `${d.address} (${d.km} กม.)`], ["โทร", d.phone]] : [];

// บรรทัดรายการในการ์ด LINE
export const itemLines = (items: Order["items"]) => items.map((i) => `${i.qty}× ${i.name}${i.detail ? ` · ${i.detail}` : ""}`);

// ข้อความเวลารับ สำหรับ LINE (จากแถวในฐานข้อมูล)
export const rowWhen = (r: Pick<OrderRow, "service" | "pickup_time" | "table_no"> & { pickup_date?: string }) =>
  whenText({ service: r.service, pickupTime: r.pickup_time, tableNo: r.table_no, pickupDate: r.pickup_date, today: nowInShop().date });

export async function pointsBalance(userId: string) {
  const { data, error } = await db().rpc("points_balance", { p_user: userId });
  if (error) throw error;
  return Math.max(0, Number(data) || 0);
}

// ให้แต้มเมื่อร้านยืนยันการชำระ (unique order_id+kind กันให้ซ้ำ)
export async function earnPoints(o: Pick<OrderRow, "id" | "line_user_id" | "total">) {
  const earned = pointsEarned(o.total);
  if (earned > 0) {
    const { error } = await db()
      .from("points_ledger")
      .upsert({ line_user_id: o.line_user_id, order_id: o.id, delta: earned, kind: "earn" }, { onConflict: "order_id,kind", ignoreDuplicates: true });
    if (error) console.error("earnPoints failed", error);
  }
  return earned;
}

export async function revokeEarned(orderId: number) {
  const { error } = await db().from("points_ledger").delete().eq("order_id", orderId).eq("kind", "earn");
  if (error) console.error("revokeEarned failed", error);
}

type OrderRow = {
  id: number;
  daily_no: number;
  pickup_date: string;
  pickup_time: string;
  line_user_id: string;
  customer_name: string;
  items: Order["items"];
  total: number;
  discount: number;
  cups: number;
  note: string;
  status: Order["status"];
  created_at: string;
  expires_at: string | null;
  slip_path: string | null;
  service: Service;
  table_no: string;
  promo_code: string | null;
  promo_discount: number;
  source: "menu" | "bar";
  channel: "line" | "pos";
  paid_at: string | null;
  pos_bill_id: number | null;
  cup_msg: string | null;
  cup_to: string | null; // โน้ต "ติดที่แก้วไหน" (ไม่เข้ารหัส)
  delivery: Delivery | null;
};

export const ORDER_COLUMNS =
  "id,daily_no,pickup_date,pickup_time,line_user_id,customer_name,items,total,discount,cups,note,status,created_at,expires_at,slip_path,service,table_no,promo_code,promo_discount,source,channel,paid_at,pos_bill_id,cup_msg,cup_to,delivery";

export function toOrder(r: OrderRow): Order {
  return {
    id: r.id,
    no: r.daily_no,
    pickupDate: r.pickup_date,
    pickupTime: r.pickup_time,
    delivery: r.delivery ?? null,
    customerName: r.customer_name,
    items: r.items,
    total: r.total,
    cups: r.cups,
    note: r.note,
    status: r.status,
    createdAt: r.created_at,
    hasSlip: !!r.slip_path,
    discount: r.discount,
    service: r.service ?? "pickup",
    tableNo: r.table_no ?? "",
    promoCode: r.promo_code ?? null,
    promoDiscount: r.promo_discount ?? 0,
    source: r.source ?? "menu",
    channel: r.channel ?? "line",
    unpaid: r.channel === "pos" && !r.paid_at,
    hasCupMsg: !!r.cup_msg,
    cupFor: r.cup_msg ? (r.cup_to ?? "") : "",
  };
}

export type { OrderRow };
