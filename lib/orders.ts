import "server-only";
import QRCode from "qrcode";
import { SHOP, pointsEarned } from "./config";
import type { MenuItem, Order, Payment, Slot } from "./menu";
import { promptPayPayload } from "./promptpay";
import { db } from "./supabase";
import { isBookable, nowInShop, slotTimes } from "./time";

export async function getMenu(): Promise<MenuItem[]> {
  const { data, error } = await db()
    .from("menu_items")
    .select("id,name,jp,description,price,temps,milk,available")
    .order("sort");
  if (error) throw error;
  return data as MenuItem[];
}

// ออเดอร์ที่ยังใช้ที่ในช่องเวลา: ไม่ถูกยกเลิก และไม่ใช่รอชำระที่หมดเวลาแล้ว
const holdsSlot = (o: { status: string; expires_at: string | null }) =>
  o.status !== "cancelled" && !(o.status === "awaiting_payment" && o.expires_at && new Date(o.expires_at) < new Date());

export async function getTodaySlots(): Promise<Slot[]> {
  const now = nowInShop();
  const { data, error } = await db()
    .from("orders")
    .select("pickup_time,cups,status,expires_at")
    .eq("pickup_date", now.date)
    .neq("status", "cancelled");
  if (error) throw error;
  const used = new Map<string, number>();
  for (const r of data.filter(holdsSlot)) used.set(r.pickup_time, (used.get(r.pickup_time) ?? 0) + r.cups);
  return slotTimes()
    .filter((t) => isBookable(t, now.minutes))
    .map((time) => ({ time, remaining: Math.max(0, SHOP.slotCapacity - (used.get(time) ?? 0)) }));
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
  r: Pick<OrderRow, "id" | "daily_no" | "total" | "discount" | "pickup_time" | "expires_at">,
): Promise<Payment> {
  const id = process.env.PROMPTPAY_ID;
  if (!id) throw new Error("Missing environment variable PROMPTPAY_ID");
  const qr = await QRCode.toDataURL(promptPayPayload(id, r.total), { margin: 1, width: 480, errorCorrectionLevel: "M" });
  return { id: r.id, no: r.daily_no, total: r.total, discount: r.discount, pickupTime: r.pickup_time, expiresAt: r.expires_at ?? "", qr };
}

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
};

export const ORDER_COLUMNS =
  "id,daily_no,pickup_date,pickup_time,line_user_id,customer_name,items,total,discount,cups,note,status,created_at,expires_at,slip_path";

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
  };
}

export type { OrderRow };
