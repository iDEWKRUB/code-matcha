import "server-only";
import crypto from "crypto";
import type { BtReceipt } from "./btPrinter";
import { SHOP } from "./config";
import { env } from "./env";
import { ORDER_COLUMNS, rowWhen, type OrderRow } from "./orders";
import { baht, receiptWhen, type Wifi } from "./receipt";
import { db } from "./supabase";

// ใบเสร็จออนไลน์ของออเดอร์ที่สั่งผ่าน LINE · ลิงก์มีลายเซ็น (เดาเลขออเดอร์คนอื่นไม่ได้) ไม่ต้องเก็บอะไรเพิ่มในฐานข้อมูล
const PAID = new Set(["pending", "preparing", "ready", "completed"]);

const sig = (id: number) => crypto.createHmac("sha256", env("ADMIN_SESSION_SECRET")).update(`receipt:${id}`).digest("base64url").slice(0, 16);

export const orderReceiptUrl = (id: number) => `${SHOP.siteUrl}/r/${id}-${sig(id)}`;

export function receiptIdFromKey(key: string): number | null {
  const m = /^(\d{1,12})-([A-Za-z0-9_-]{16})$/.exec(key);
  if (!m) return null;
  const id = Number(m[1]);
  const a = Buffer.from(sig(id)), b = Buffer.from(m[2]);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? id : null;
}

// ออเดอร์ LINE ที่ชำระแล้ว (ยังไม่จ่าย / ยกเลิก / หน้าร้าน = ไม่มีใบเสร็จแบบนี้)
export async function receiptOrder(id: number): Promise<OrderRow | null> {
  const { data, error } = await db().from("orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  const o = data as OrderRow | null;
  return o && o.channel === "line" && PAID.has(o.status) ? o : null;
}

export const orderReceiptNo = (o: Pick<OrderRow, "pickup_date" | "daily_no">) => `LINE-${o.pickup_date.slice(5).replace("-", "")}-${String(o.daily_no).padStart(3, "0")}`;

// ข้อมูลใบเสร็จชุดเดียวกับหน้าร้าน (ใช้ทั้งหน้าใบเสร็จออนไลน์และพิมพ์ Bluetooth ในหลังร้าน)
export function orderBtReceipt(o: OrderRow, wifi: Wifi | null): BtReceipt {
  const subtotal = o.total + (o.promo_discount ?? 0) + (o.discount ?? 0);
  return {
    no: orderReceiptNo(o),
    when: receiptWhen(o.paid_at ?? o.created_at),
    label: `ออเดอร์ #${o.daily_no} · ${o.source === "bar" ? "มาม่าบาร์" : rowWhen(o)}`,
    items: o.items.map((i) => ({ name: i.name, qty: i.qty, price: baht(i.price), detail: i.detail ?? "" })),
    subtotal: baht(subtotal),
    promo: o.promo_discount > 0 ? { code: o.promo_code ?? "", amount: baht(o.promo_discount) } : null,
    adjust: o.discount > 0 ? [{ label: "ใช้แต้ม", amount: baht(o.discount) }] : [],
    total: baht(o.total),
    pay: "พร้อมเพย์ · สั่งผ่าน LINE",
    cash: null,
    claim: null,
    wifi,
  };
}
