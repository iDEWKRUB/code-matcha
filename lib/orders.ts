import "server-only";
import QRCode from "qrcode";
import { pointsEarned } from "./config";
import { whenText, type MenuItem, type Order, type Payment, type Service, type ShopSettings, type Slot } from "./menu";
import { promptPayPayload } from "./promptpay";
import { db } from "./supabase";
import { isBookable, nowInShop, slotTimes, toMinutes } from "./time";

export const MENU_COLUMNS =
  "id,name,jp,description,price,temps,milk,available,promoPrice:promo_price,recommended,look,sort,kind,toppings";

export async function getMenu(): Promise<MenuItem[]> {
  const { data, error } = await db().from("menu_items").select(MENU_COLUMNS).order("sort");
  if (error) throw error;
  return data as unknown as MenuItem[];
}

export async function getSettings(): Promise<ShopSettings> {
  const { data, error } = await db()
    .from("shop_settings")
    .select("banner,banner_active,open_time,close_time,slot_minutes,slot_capacity,accepting")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return {
    banner: data?.banner ?? "",
    bannerActive: data?.banner_active ?? false,
    openTime: data?.open_time ?? "10:30",
    closeTime: data?.close_time ?? "17:00",
    slotMinutes: data?.slot_minutes ?? 15,
    slotCapacity: data?.slot_capacity ?? 8,
    accepting: data?.accepting ?? true,
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
  r: Pick<OrderRow, "id" | "daily_no" | "total" | "discount" | "pickup_time" | "expires_at" | "service" | "table_no" | "promo_code" | "promo_discount">,
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

// บรรทัดรายการในการ์ด LINE
export const itemLines = (items: Order["items"]) => items.map((i) => `${i.qty}× ${i.name}${i.detail ? ` · ${i.detail}` : ""}`);

// ข้อความเวลารับ สำหรับ LINE (จากแถวในฐานข้อมูล)
export const rowWhen = (r: Pick<OrderRow, "service" | "pickup_time" | "table_no">) =>
  whenText({ service: r.service, pickupTime: r.pickup_time, tableNo: r.table_no });

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
};

export const ORDER_COLUMNS =
  "id,daily_no,pickup_date,pickup_time,line_user_id,customer_name,items,total,discount,cups,note,status,created_at,expires_at,slip_path,service,table_no,promo_code,promo_discount";

export function toOrder(r: OrderRow): Order {
  return {
    id: r.id,
    no: r.daily_no,
    pickupDate: r.pickup_date,
    pickupTime: r.pickup_time,
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
  };
}

export type { OrderRow };
