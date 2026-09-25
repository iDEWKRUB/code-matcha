import "server-only";
import QRCode from "qrcode";
import { SHOP } from "./config";
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

export async function paymentFor(r: Pick<OrderRow, "id" | "daily_no" | "total" | "pickup_time" | "expires_at">): Promise<Payment> {
  const id = process.env.PROMPTPAY_ID;
  if (!id) throw new Error("Missing environment variable PROMPTPAY_ID");
  const qr = await QRCode.toDataURL(promptPayPayload(id, r.total), { margin: 1, width: 480, errorCorrectionLevel: "M" });
  return { id: r.id, no: r.daily_no, total: r.total, pickupTime: r.pickup_time, expiresAt: r.expires_at ?? "", qr };
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
  cups: number;
  note: string;
  status: Order["status"];
  created_at: string;
  expires_at: string | null;
  slip_path: string | null;
};

export const ORDER_COLUMNS =
  "id,daily_no,pickup_date,pickup_time,line_user_id,customer_name,items,total,cups,note,status,created_at,expires_at,slip_path";

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
  };
}

export type { OrderRow };
