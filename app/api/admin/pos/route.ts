import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { BAR_MAX_QTY, type BarScan } from "@/lib/bar";
import { getBarItems } from "@/lib/barServer";
import { buildItems } from "@/lib/cartServer";
import type { OrderItem } from "@/lib/menu";
import { getMenu, getPowders } from "@/lib/orders";
import { promoDiscount } from "@/lib/promo";
import { checkPromo } from "@/lib/promoServer";
import { addOrder, createBill, getBill, openBills, payBill, posQr, recentPaidBills } from "@/lib/pos";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const MAX_PHOTO = 4 * 1024 * 1024;

export async function GET() {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const [menu, powders, barItems, bills, recent] = await Promise.all([getMenu(), getPowders(), getBarItems(), openBills(), recentPaidBills(20)]);
  return NextResponse.json({ menu: menu.filter((m) => m.available), powders, barItems, bills, recent });
}

type Body = {
  action?: string;
  billId?: number;
  label?: string;
  source?: "menu" | "bar";
  lines?: unknown;
  barLines?: { id?: unknown; qty?: unknown }[];
  detected?: Record<string, number>;
  photo?: string;
  note?: string;
  method?: "qr" | "cash";
  cashReceived?: number | null;
  promoCode?: string;
  amount?: number;
};

export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const b = (await req.json().catch(() => ({}))) as Body;
  const billId = Number(b.billId) || 0;

  if (b.action === "qr") {
    const amount = Number(b.amount);
    if (!Number.isInteger(amount) || amount <= 0 || amount > 100000) return fail("ยอดไม่ถูกต้อง");
    if (!process.env.PROMPTPAY_ID) return fail("ร้านยังไม่ได้ตั้งค่าพร้อมเพย์", 503);
    return NextResponse.json({ qr: await posQr(amount) });
  }

  // ตรวจโค้ดส่วนลดก่อนเช็คบิล (ให้ QR ใส่ยอดหลังหักถูก) · ตอนจ่ายตรวจซ้ำอีกครั้ง
  if (b.action === "promo") {
    const bill = await getBill(billId);
    if (!bill || bill.status !== "open") return fail("บิลนี้ปิดไปแล้ว", 409);
    const r = await checkPromo(String(b.promoCode ?? ""), `pos:${billId}`, bill.subtotal);
    if ("error" in r) return fail(r.error, 409);
    return NextResponse.json({ code: r.rule.code, discount: Math.min(bill.subtotal, promoDiscount(r.rule, bill.subtotal)) });
  }

  if (b.action === "label") {
    const { error } = await db().from("pos_bills").update({ label: String(b.label ?? "").trim().slice(0, 30) }).eq("id", billId).eq("status", "open");
    if (error) throw error;
    return NextResponse.json({ bills: await openBills() });
  }

  if (b.action === "void") {
    const bill = await getBill(billId);
    if (!bill || bill.status !== "open") return fail("บิลนี้ปิดไปแล้ว", 409);
    await db().from("orders").update({ status: "cancelled" }).eq("pos_bill_id", billId).neq("status", "cancelled");
    await db().from("pos_bills").update({ status: "void" }).eq("id", billId);
    return NextResponse.json({ bills: await openBills() });
  }

  if (b.action === "pay") {
    if (b.method !== "qr" && b.method !== "cash") return fail("เลือกวิธีชำระเงิน");
    const r = await payBill(billId, { method: b.method, cashReceived: b.cashReceived ?? null, promoCode: b.promoCode });
    if ("error" in r) return fail(r.error, 409);
    return NextResponse.json({ bill: r.bill, bills: await openBills() });
  }

  if (b.action === "order") {
    const label = String(b.label ?? "").trim().slice(0, 30);
    let items: OrderItem[];
    let total: number;
    let cups: number;
    let scan: BarScan | undefined;
    let trayPath: string | null = null;
    if (b.source === "bar") {
      const catalog = new Map((await getBarItems()).map((i) => [i.id, i]));
      const qty = new Map<string, number>();
      for (const l of b.barLines ?? []) {
        const id = String(l?.id ?? "");
        const n = Number(l?.qty);
        if (!catalog.has(id)) return fail("มีของบางชิ้นที่ร้านไม่ได้ขายแล้ว");
        if (!Number.isInteger(n) || n < 1 || n > BAR_MAX_QTY) return fail("จำนวนไม่ถูกต้อง");
        qty.set(id, (qty.get(id) ?? 0) + n);
      }
      if (!qty.size) return fail("ยังไม่มีรายการในถาด");
      items = [...qty].map(([id, n]) => ({ name: catalog.get(id)!.name, qty: n, detail: "มาม่าบาร์ · หน้าร้าน", price: catalog.get(id)!.price * n }));
      total = items.reduce((n, i) => n + i.price, 0);
      cups = [...qty.values()].reduce((n, q) => n + q, 0);
      const detected = Object.fromEntries(Object.entries(b.detected ?? {}).filter(([id, n]) => catalog.has(id) && Number.isInteger(n) && n > 0));
      scan = { detected, unknown: 0, unreadable: 0, declared: cups, final: Object.fromEntries(qty) };
      // รูปถาด (ถ้าถ่าย) เก็บเป็นหลักฐานเหมือนบิลที่ลูกค้าสแกนเอง
      const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(b.photo ?? "");
      if (m) {
        const bytes = Buffer.from(m[2], "base64");
        if (bytes.length <= MAX_PHOTO) {
          const path = `${nowInShop().date}/pos-${crypto.randomUUID()}.jpg`;
          const up = await db().storage.from("trays").upload(path, bytes, { contentType: m[1] });
          if (!up.error) trayPath = path;
        }
      }
    } else {
      const [menu, powders] = await Promise.all([getMenu(), getPowders()]);
      const built = buildItems(b.lines, menu, powders, { allowHidden: true });
      if ("error" in built) return fail(built.error);
      ({ items, total, cups } = built);
    }
    let id = billId;
    if (id) {
      const bill = await getBill(id);
      if (!bill || bill.status !== "open") return fail("บิลนี้ปิดไปแล้ว", 409);
    } else id = await createBill(label, "");
    await addOrder(id, label || (await getBill(id))?.label || "", { source: b.source === "bar" ? "bar" : "menu", items, total, cups, note: String(b.note ?? "").slice(0, 200), scan, trayPath });
    return NextResponse.json({ billId: id, bills: await openBills() });
  }

  return fail("ไม่รู้จักคำสั่งนี้");
}
