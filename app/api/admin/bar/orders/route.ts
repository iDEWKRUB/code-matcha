import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { extraTotal, type BarScan, type ExtraItem, type ExtraStatus } from "@/lib/bar";
import { getBarItems, notifyExtraPaid, purgeOldTrays, trayUrls } from "@/lib/barServer";
import { orderUri } from "@/lib/flex";
import { pushCard } from "@/lib/line";
import type { OrderItem } from "@/lib/menu";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const PAID = ["pending", "preparing", "ready", "completed"];

// บิลมาม่าบาร์ของวันที่เลือก พร้อมรูปถาด ผลสแกน สลิป และสถานะเรียกเก็บเพิ่ม
export async function GET(req: Request) {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const q = new URL(req.url).searchParams.get("date");
  const date = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : nowInShop().date;
  await purgeOldTrays();
  const { data, error } = await db()
    .from("orders")
    .select(
      "id,daily_no,created_at,customer_name,items,total,status,slip_path,slip_ref,paid_at,tray_path,bar_scan,terms_at,terms_version,bar_extra,bar_extra_note,bar_extra_items,bar_extra_status,bar_extra_sent_at,bar_extra_slip_path,bar_extra_slip_ref,bar_extra_paid_at",
    )
    .eq("source", "bar")
    .eq("pickup_date", date)
    .neq("status", "awaiting_payment")
    .order("id", { ascending: false });
  if (error) throw error;
  const urls = await trayUrls(data.map((o) => o.tray_path));
  const slips = data.filter((o) => o.bar_extra_slip_path).map((o) => o.bar_extra_slip_path as string);
  const slipUrls = new Map<string, string>();
  if (slips.length) {
    const s = await db().storage.from("slips").createSignedUrls(slips, 60 * 60);
    for (const x of s.data ?? []) if (x.path && x.signedUrl) slipUrls.set(x.path, x.signedUrl);
  }
  return NextResponse.json({
    date,
    bills: data.map((o) => ({
      id: o.id,
      no: o.daily_no,
      at: o.created_at,
      name: o.customer_name,
      items: o.items as OrderItem[],
      total: o.total,
      status: o.status,
      hasSlip: !!o.slip_path,
      photo: o.tray_path ? (urls.get(o.tray_path) ?? null) : null,
      scan: (o.bar_scan as BarScan | null) ?? null,
      termsAt: o.terms_at,
      extra: o.bar_extra,
      extraNote: o.bar_extra_note,
      extraItems: (o.bar_extra_items as ExtraItem[]) ?? [],
      extraStatus: o.bar_extra_status as ExtraStatus,
      extraSentAt: o.bar_extra_sent_at,
      extraSlip: o.bar_extra_slip_path ? (slipUrls.get(o.bar_extra_slip_path) ?? null) : null,
      paidAt: o.paid_at,
      autoPaid: !!o.slip_ref,
      termsVersion: o.terms_version,
      extraPaidAt: o.bar_extra_paid_at,
      extraAuto: !!o.bar_extra_slip_ref,
    })),
  });
}

// send = เลือกรายการที่ขาด → บันทึก + แจ้งลูกค้าทาง LINE, cancel = ยกเลิกการเรียกเก็บ, confirm = ร้านยืนยันรับชำระเพิ่ม (ตรวจสลิปเอง)
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const b = (await req.json().catch(() => null)) as { id?: unknown; action?: unknown; items?: unknown; note?: unknown } | null;
  const id = Number(b?.id);
  if (!Number.isInteger(id)) return fail("ไม่พบบิล");
  const { data: o, error } = await db()
    .from("orders")
    .select("id,daily_no,created_at,line_user_id,customer_name,total,status,tray_path,bar_extra_status")
    .eq("id", id)
    .eq("source", "bar")
    .maybeSingle();
  if (error) throw error;
  if (!o) return fail("ไม่พบบิล", 404);
  const now = new Date().toISOString();

  if (b?.action === "cancel") {
    if (o.bar_extra_status === "paid" || o.bar_extra_status === "review") return fail("ลูกค้าจ่าย/แนบสลิปแล้ว ยกเลิกไม่ได้", 409);
    await db().from("orders").update({ bar_extra: 0, bar_extra_items: [], bar_extra_note: "", bar_extra_status: "none" }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (b?.action === "confirm") {
    const { data: u, error: e } = await db()
      .from("orders")
      .update({ bar_extra_status: "paid", bar_extra_paid_at: now })
      .eq("id", id)
      .eq("bar_extra_status", "review")
      .select("id");
    if (e) throw e;
    if (!u.length) return fail("บิลนี้ไม่ได้รอตรวจสลิปชำระเพิ่ม", 409);
    await notifyExtraPaid(id);
    return NextResponse.json({ ok: true });
  }

  if (b?.action !== "send") return fail("คำสั่งไม่ถูกต้อง");
  if (!PAID.includes(o.status)) return fail("เรียกเก็บเพิ่มได้เฉพาะบิลที่จ่ายแล้ว", 409);
  if (o.bar_extra_status === "paid" || o.bar_extra_status === "review") return fail("ลูกค้าจ่าย/แนบสลิปเพิ่มแล้ว แก้ไม่ได้", 409);

  const catalog = new Map((await getBarItems(false)).map((i) => [i.id, i]));
  const items: ExtraItem[] = [];
  for (const raw of Array.isArray(b.items) ? (b.items as { id?: unknown; qty?: unknown }[]) : []) {
    const it = catalog.get(String(raw?.id));
    const qty = Number(raw?.qty);
    if (!it || !Number.isInteger(qty) || qty < 1 || qty > 50) return fail("รายการไม่ถูกต้อง");
    items.push({ id: it.id, name: it.name, qty, price: it.price });
  }
  if (!items.length) return fail("เลือกรายการที่ยังไม่ได้จ่ายอย่างน้อย 1 อย่าง");
  const amount = extraTotal(items);
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 200) : "";
  const { error: upErr } = await db()
    .from("orders")
    .update({ bar_extra: amount, bar_extra_items: items, bar_extra_note: note, bar_extra_status: "due", bar_extra_sent_at: now })
    .eq("id", id);
  if (upErr) throw upErr;

  // รูปถาดในการ์ด LINE: ลิงก์ชั่วคราว 30 วัน (LINE โหลดรูปตอนเปิดแชท)
  let hero: string | undefined;
  if (o.tray_path) {
    const s = await db().storage.from("trays").createSignedUrl(o.tray_path, 30 * 86400);
    hero = s.data?.signedUrl;
  }
  await pushCard(
    o.line_user_id,
    {
      tone: "danger",
      title: "แจ้งยอดชำระเพิ่ม",
      subtitle: `มาม่าบาร์ · บิล #${o.daily_no}`,
      hero,
      rows: [
        ["ชำระแล้ว", `฿${o.total}`],
        ...items.map((i) => [`${i.name} ×${i.qty}`, `฿${i.price * i.qty}`] as [string, string]),
        ["ยอดชำระเพิ่ม", `฿${amount}`, true],
      ],
      note: `${note ? `${note} · ` : ""}รายการในถาดที่ยังไม่ได้ชำระ ตามเงื่อนไขที่ยอมรับไว้ตอนสั่ง`,
      button: { label: "ดูรายละเอียด & ชำระ", uri: `${orderUri()}/bar?extra=${id}` },
    },
    { name: o.customer_name, orderNo: o.daily_no },
  );
  return NextResponse.json({ ok: true });
}
