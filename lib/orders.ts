import "server-only";
import { SHOP } from "./config";
import type { MenuItem, Order, Slot } from "./menu";
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

export async function getTodaySlots(): Promise<Slot[]> {
  const now = nowInShop();
  const { data, error } = await db()
    .from("orders")
    .select("pickup_time,cups")
    .eq("pickup_date", now.date)
    .neq("status", "cancelled");
  if (error) throw error;
  const used = new Map<string, number>();
  for (const r of data) used.set(r.pickup_time, (used.get(r.pickup_time) ?? 0) + r.cups);
  return slotTimes()
    .filter((t) => isBookable(t, now.minutes))
    .map((time) => ({ time, remaining: Math.max(0, SHOP.slotCapacity - (used.get(time) ?? 0)) }));
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
};

export const ORDER_COLUMNS =
  "id,daily_no,pickup_date,pickup_time,line_user_id,customer_name,items,total,cups,note,status,created_at";

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
  };
}

export type { OrderRow };
