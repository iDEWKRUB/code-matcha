import "server-only";
import type { BtReceipt } from "./btPrinter";
import { SHOP, pointsEarned } from "./config";
import { CLAIM_DAYS, type PosBill } from "./pos";
import { db } from "./supabase";

export type Wifi = { ssid: string; pass: string };

// Wi-Fi ท้ายใบเสร็จ (ตั้งในหน้าแอดมิน) · ยังไม่ได้ตั้ง หรืออ่านไม่ได้ = null แล้วใบเสร็จจะไม่พิมพ์ส่วน Wi-Fi
export async function getWifi(): Promise<Wifi | null> {
  const { data, error } = await db().from("shop_settings").select("wifi_ssid,wifi_pass").eq("id", 1).maybeSingle();
  if (error || !data?.wifi_ssid) return null;
  return { ssid: data.wifi_ssid, pass: data.wifi_pass ?? "" };
}

export const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const receiptWhen = (s: string) =>
  new Date(s).toLocaleString("th-TH", { timeZone: SHOP.timeZone, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
export const receiptNo = (bill: Pick<PosBill, "id" | "date">) => `POS-${bill.date.slice(5).replace("-", "")}-${String(bill.id).padStart(4, "0")}`;

// ลิงก์รับแต้มของบิล (ว่าง = ไม่มี/รับไปแล้ว)
export function claimLink(bill: PosBill) {
  if (!bill.claimToken || bill.claimedAt) return "";
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  return liffId ? `https://liff.line.me/${liffId}/claim?t=${bill.claimToken}` : `${SHOP.siteUrl}/claim?t=${bill.claimToken}`;
}

// ข้อมูลใบเสร็จสำหรับเครื่องพิมพ์ Bluetooth 58 มม. (หน้าใบเสร็จ + พิมพ์อัตโนมัติหลังชำระใน POS ใช้ชุดเดียวกัน)
export function btReceipt(bill: PosBill, wifi: Wifi | null): BtReceipt {
  const orders = bill.orders.filter((o) => o.status !== "cancelled");
  const earn = pointsEarned(bill.total);
  const url = claimLink(bill);
  const change = bill.payMethod === "cash" && bill.cashReceived != null ? bill.cashReceived - bill.total : 0;
  return {
    no: receiptNo(bill),
    when: receiptWhen(bill.paidAt!),
    label: bill.label ?? "",
    items: orders.flatMap((o) => o.items.map((i) => ({ name: i.name, qty: i.qty, price: baht(i.price), detail: i.detail ?? "" }))),
    subtotal: baht(bill.subtotal),
    promo: bill.promoDiscount > 0 ? { code: bill.promoCode ?? "", amount: baht(bill.promoDiscount) } : null,
    total: baht(bill.total),
    pay: bill.payMethod === "cash" ? "เงินสด" : "พร้อมเพย์ QR",
    cash: bill.payMethod === "cash" && bill.cashReceived != null ? { received: baht(bill.cashReceived), change: baht(change) } : null,
    claim: url && earn > 0 ? { url, earn, days: CLAIM_DAYS } : null,
    wifi,
  };
}
