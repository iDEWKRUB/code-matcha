import "server-only";
import crypto from "crypto";
import QRCode from "qrcode";
import type { BarScan } from "./bar";
import { applySale } from "./barServer";
import { pointsEarned } from "./config";
import type { OrderItem } from "./menu";
import { earnPoints } from "./orders";
import { promoDiscount } from "./promo";
import { checkPromo } from "./promoServer";
import { promptPayPayload } from "./promptpay";
import { db } from "./supabase";
import { nowInShop } from "./time";

// หน้าร้าน (POS): ลูกค้าเดินเข้าร้าน พนักงานคิดเงินให้ · ออเดอร์ของบิลใช้ line_user_id นี้จนกว่าจะมีคนสแกนรับแต้ม
export const POS_USER = "pos";
export const CLAIM_DAYS = 7;

export type PosOrder = { id: number; no: number; source: "menu" | "bar"; status: string; items: OrderItem[]; total: number; createdAt: string };
export type PosBill = {
  id: number;
  date: string;
  label: string;
  status: "open" | "paid" | "void";
  openedAt: string;
  paidAt: string | null;
  subtotal: number;
  promoCode: string | null;
  promoDiscount: number;
  total: number;
  payMethod: "qr" | "cash" | null;
  cashReceived: number | null;
  claimToken: string | null;
  claimedAt: string | null;
  cashier: string;
  orders: PosOrder[];
};

const BILL_COLS =
  "id,bill_date,label,status,opened_at,paid_at,subtotal,promo_code,promo_discount,total,pay_method,cash_received,claim_token,claimed_at,cashier";

type BillRow = {
  id: number;
  bill_date: string;
  label: string;
  status: PosBill["status"];
  opened_at: string;
  paid_at: string | null;
  subtotal: number;
  promo_code: string | null;
  promo_discount: number;
  total: number;
  pay_method: PosBill["payMethod"];
  cash_received: number | null;
  claim_token: string | null;
  claimed_at: string | null;
  cashier: string;
};

type OrderRowLite = { id: number; daily_no: number; source: "menu" | "bar"; status: string; items: OrderItem[]; total: number; created_at: string; pos_bill_id: number };

const liveOrder = (o: { status: string }) => o.status !== "cancelled";

async function withOrders(rows: BillRow[]): Promise<PosBill[]> {
  if (!rows.length) return [];
  const { data, error } = await db()
    .from("orders")
    .select("id,daily_no,source,status,items,total,created_at,pos_bill_id")
    .in(
      "pos_bill_id",
      rows.map((r) => r.id),
    )
    .order("id");
  if (error) throw error;
  const by = new Map<number, PosOrder[]>();
  for (const o of data as OrderRowLite[])
    by.set(o.pos_bill_id, [...(by.get(o.pos_bill_id) ?? []), { id: o.id, no: o.daily_no, source: o.source, status: o.status, items: o.items, total: o.total, createdAt: o.created_at }]);
  return rows.map((r) => {
    const orders = by.get(r.id) ?? [];
    const subtotal = r.status === "open" ? orders.filter(liveOrder).reduce((n, o) => n + o.total, 0) : r.subtotal;
    return {
      id: r.id,
      date: r.bill_date,
      label: r.label,
      status: r.status,
      openedAt: r.opened_at,
      paidAt: r.paid_at,
      subtotal,
      promoCode: r.promo_code,
      promoDiscount: r.promo_discount,
      total: r.status === "open" ? subtotal : r.total,
      payMethod: r.pay_method,
      cashReceived: r.cash_received,
      claimToken: r.claim_token,
      claimedAt: r.claimed_at,
      cashier: r.cashier,
      orders,
    };
  });
}

export async function openBills() {
  const { data, error } = await db().from("pos_bills").select(BILL_COLS).eq("status", "open").order("opened_at");
  if (error) throw error;
  return withOrders(data as BillRow[]);
}

export async function getBill(id: number) {
  const { data, error } = await db().from("pos_bills").select(BILL_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? (await withOrders([data as BillRow]))[0] : null;
}

export async function recentPaidBills(limit = 30) {
  const { data, error } = await db().from("pos_bills").select(BILL_COLS).eq("status", "paid").order("paid_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return withOrders(data as BillRow[]);
}

export async function createBill(label: string, cashier: string) {
  const { data, error } = await db()
    .from("pos_bills")
    .insert({ bill_date: nowInShop().date, label: label.trim().slice(0, 30), cashier })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

export async function posQr(amount: number) {
  const id = process.env.PROMPTPAY_ID;
  if (!id) throw new Error("Missing environment variable PROMPTPAY_ID");
  return QRCode.toDataURL(promptPayPayload(id, amount), { margin: 1, width: 520, errorCorrectionLevel: "M" });
}

// เพิ่มออเดอร์เข้าบิล: มัทฉะ = เข้าคิวทำทันที (ยังไม่จ่าย), มาม่าบาร์ = ลูกค้าต้มเอง (จบออเดอร์ รอจ่ายพร้อมบิล)
export async function addOrder(
  billId: number,
  label: string,
  o: { source: "menu" | "bar"; items: OrderItem[]; total: number; cups: number; note?: string; scan?: BarScan; trayPath?: string | null },
) {
  const now = nowInShop();
  const time = `${String(Math.floor(now.minutes / 60)).padStart(2, "0")}:${String(now.minutes % 60).padStart(2, "0")}`;
  const { data, error } = await db().rpc("place_order", {
    p_date: now.date,
    p_time: time,
    p_capacity: 100000,
    p_user: POS_USER,
    p_name: label ? `${label} (หน้าร้าน)` : "หน้าร้าน",
    p_items: o.items,
    p_total: o.total,
    p_cups: o.cups,
    p_note: o.note ?? "",
    p_hold_minutes: 1,
    p_points: 0,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { order_id: number; order_no: number };
  const { error: e2 } = await db()
    .from("orders")
    .update({
      status: o.source === "bar" ? "completed" : "pending",
      expires_at: null,
      paid_at: null,
      channel: "pos",
      pos_bill_id: billId,
      source: o.source,
      service: "dine_in",
      table_no: label.slice(0, 10),
      ...(o.source === "bar" ? { bar_scan: o.scan ?? null, tray_path: o.trayPath ?? null } : {}),
    })
    .eq("id", row.order_id);
  if (e2) {
    await db().from("orders").update({ status: "cancelled" }).eq("id", row.order_id);
    throw e2;
  }
  return row.order_no;
}

// เช็คบิล: หักโค้ด (ถ้ามี) → ปิดบิล → ออเดอร์ทุกใบถือว่าจ่ายแล้ว (เข้ายอดขาย) → มาม่าบาร์ตัดสต๊อก
export async function payBill(
  billId: number,
  p: { method: "qr" | "cash"; cashReceived?: number | null; promoCode?: string },
): Promise<{ bill: PosBill } | { error: string }> {
  const bill = await getBill(billId);
  if (!bill || bill.status !== "open") return { error: "บิลนี้ปิดไปแล้ว" };
  const orders = bill.orders.filter(liveOrder);
  if (!orders.length) return { error: "บิลนี้ยังไม่มีรายการ" };
  const subtotal = orders.reduce((n, o) => n + o.total, 0);

  let promoCode: string | null = null;
  let promoOff = 0;
  if (p.promoCode?.trim()) {
    const r = await checkPromo(p.promoCode, `${POS_USER}:${billId}`, subtotal);
    if ("error" in r) return { error: r.error };
    promoCode = r.rule.code;
    promoOff = Math.min(subtotal, promoDiscount(r.rule, subtotal));
  }
  const total = subtotal - promoOff;
  if (p.method === "cash" && p.cashReceived != null && (!Number.isInteger(p.cashReceived) || p.cashReceived < total))
    return { error: "รับเงินสดน้อยกว่ายอดที่ต้องจ่าย" };

  const now = new Date().toISOString();
  // ปิดบิลก่อน (กันกดซ้ำสองเครื่อง)
  const { data: closed, error } = await db()
    .from("pos_bills")
    .update({
      status: "paid",
      paid_at: now,
      subtotal,
      promo_code: promoCode,
      promo_discount: promoOff,
      total,
      pay_method: p.method,
      cash_received: p.method === "cash" ? (p.cashReceived ?? total) : null,
      claim_token: pointsEarned(total) > 0 ? crypto.randomBytes(9).toString("base64url") : null,
    })
    .eq("id", billId)
    .eq("status", "open")
    .select("id");
  if (error) throw error;
  if (!closed?.length) return { error: "บิลนี้ปิดไปแล้ว" };

  // กระจายส่วนลดลงออเดอร์ (ยอดขายรายวันต้องตรงกับเงินที่รับจริง)
  let left = promoOff;
  for (const o of orders) {
    const cut = Math.min(left, o.total);
    left -= cut;
    const first = o === orders[0];
    const { error: e } = await db()
      .from("orders")
      .update({
        paid_at: now,
        total: o.total - cut,
        ...(first && promoCode ? { promo_code: promoCode, promo_discount: promoOff } : {}),
      })
      .eq("id", o.id);
    if (e) console.error("pos pay order failed", o.id, e);
    if (o.source === "bar") await applySale(o.id);
  }
  return { bill: (await getBill(billId))! };
}

// ลูกค้าสแกน QR บนใบเสร็จ → แต้มของบิลนี้เข้าบัตรสมาชิก (ครั้งเดียว ภายใน CLAIM_DAYS วัน)
export async function claimBill(token: string, userId: string, name: string): Promise<{ earned: number } | { error: string }> {
  const { data, error } = await db().from("pos_bills").select("id,status,paid_at,claimed_at,total").eq("claim_token", token).maybeSingle();
  if (error) throw error;
  if (!data || data.status !== "paid") return { error: "ไม่พบใบเสร็จนี้" };
  if (data.claimed_at) return { error: "ใบเสร็จนี้รับแต้มไปแล้ว" };
  if (data.paid_at && Date.now() - new Date(data.paid_at).getTime() > CLAIM_DAYS * 864e5) return { error: `ใบเสร็จนี้เกิน ${CLAIM_DAYS} วันแล้ว` };
  const { data: took, error: e1 } = await db()
    .from("pos_bills")
    .update({ claimed_by: userId, claimed_at: new Date().toISOString(), member_id: userId })
    .eq("id", data.id)
    .is("claimed_at", null)
    .select("id");
  if (e1) throw e1;
  if (!took?.length) return { error: "ใบเสร็จนี้รับแต้มไปแล้ว" };
  // ย้ายออเดอร์ของบิลมาเป็นของสมาชิก แล้วให้แต้มตามยอดที่จ่ายจริงของแต่ละออเดอร์
  const { data: orders, error: e2 } = await db()
    .from("orders")
    .update({ line_user_id: userId, customer_name: name })
    .eq("pos_bill_id", data.id)
    .neq("status", "cancelled")
    .select("id,line_user_id,total");
  if (e2) throw e2;
  let earned = 0;
  for (const o of orders ?? []) earned += await earnPoints(o);
  return { earned };
}
