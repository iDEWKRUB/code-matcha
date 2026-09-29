import "server-only";
import { TRAY_KEEP_DAYS, type BarHours, type BarItem, type ExtraItem } from "./bar";
import { orderUri } from "./flex";
import { pushCard } from "./line";
import { db } from "./supabase";
import { nowInShop, toMinutes } from "./time";

export async function getBarHours(): Promise<BarHours> {
  const { data, error } = await db()
    .from("shop_settings")
    .select("bar_enabled,bar_open_time,bar_close_time,bar_all_day")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  const h = {
    enabled: data?.bar_enabled ?? false,
    allDay: data?.bar_all_day ?? false,
    openTime: data?.bar_open_time ?? "14:00",
    closeTime: data?.bar_close_time ?? "23:59",
  };
  const m = nowInShop().minutes;
  const open = toMinutes(h.openTime);
  const close = toMinutes(h.closeTime);
  // เวลาปิดก่อนเวลาเปิด = เปิดข้ามเที่ยงคืน (เช่น 14:00–02:00)
  const openNow = h.allDay || (close > open ? m >= open && m < close : m >= open || m < close);
  return { ...h, openNow };
}

// บิลมาม่าบาร์จ่ายแล้ว → ตัดสต๊อกตามรายการที่จ่าย (เรียกซ้ำได้ ไม่ตัดซ้ำ) ไม่ให้ล้มการจ่ายเงินถ้าตัดไม่สำเร็จ
export async function applySale(orderId: number) {
  const { data, error } = await db().from("orders").select("bar_scan").eq("id", orderId).maybeSingle();
  if (error || !data?.bar_scan) return;
  const final = (data.bar_scan as { final?: Record<string, number> }).final ?? {};
  const lines = Object.entries(final).map(([id, qty]) => ({ id, qty }));
  const { error: e } = await db().rpc("bar_stock_set_order", { p_order: orderId, p_kind: "sale", p_lines: lines });
  if (e) console.error("applySale failed", orderId, e);
}

// ลูกค้าจ่ายยอดเพิ่มครบแล้ว → ส่งการ์ดยืนยันรับเงิน + ขออภัยในความไม่สะดวก
export async function notifyExtraPaid(id: number) {
  const { data: o, error } = await db()
    .from("orders")
    .select("daily_no,line_user_id,customer_name,total,bar_extra,bar_extra_items")
    .eq("id", id)
    .maybeSingle();
  if (error || !o) return console.error("notifyExtraPaid read failed", error);
  const items = (o.bar_extra_items as ExtraItem[]) ?? [];
  await pushCard(
    o.line_user_id,
    {
      tone: "matcha",
      title: "ได้รับชำระเพิ่มเรียบร้อยแล้ว",
      subtitle: `มาม่าบาร์ · บิล #${o.daily_no} · ครบถ้วนแล้ว`,
      rows: [
        ["ยอดชำระเพิ่ม", `฿${o.bar_extra}`, true],
        ["ยอดรวมบิลนี้", `฿${o.total + o.bar_extra}`],
        ["สถานะ", "ชำระครบ ไม่มียอดค้าง"],
      ],
      items: items.map((i) => `${i.qty}× ${i.name}`),
      note: "ขออภัยในความผิดพลาดและความไม่สะดวกที่เกิดขึ้น ขอบคุณที่ใช้บริการมาม่าบาร์ CODE-MATCHA แล้วแวะมาต้มกันใหม่นะ",
      button: { label: "ดูประวัติการมากิน", uri: `${orderUri()}/bar?history=1` },
    },
    { name: o.customer_name, orderNo: o.daily_no },
  );
}

// ลิงก์ดูรูปถาดชั่วคราว (bucket ส่วนตัว) คืน map path → url
export async function trayUrls(paths: (string | null)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  if (!list.length) return new Map<string, string>();
  const { data, error } = await db().storage.from("trays").createSignedUrls(list, 60 * 60);
  if (error) {
    console.error("tray signed urls failed", error);
    return new Map<string, string>();
  }
  return new Map(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl]));
}

// ลบรูปถาดที่เก่ากว่ากำหนด (เรียกตอนร้านเปิดดูบิล ทีละไม่เกิน 100 รูป)
export async function purgeOldTrays() {
  const before = new Date(Date.now() - TRAY_KEEP_DAYS * 86400000).toISOString();
  const { data, error } = await db().from("orders").select("id,tray_path").not("tray_path", "is", null).lt("created_at", before).limit(100);
  if (error || !data.length) return;
  const { error: rmErr } = await db().storage.from("trays").remove(data.map((o) => o.tray_path as string));
  if (rmErr) return console.error("purge trays failed", rmErr);
  await db().from("orders").update({ tray_path: null }).in("id", data.map((o) => o.id));
}

export async function getBarItems(availableOnly = true): Promise<BarItem[]> {
  let q = db().from("bar_items").select("id,name,kind,price,available,sort,image_url").order("sort").order("name");
  if (availableOnly) q = q.eq("available", true);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    price: r.price,
    available: r.available,
    sort: r.sort,
    imageUrl: r.image_url,
  }));
}

// SlipOK ตอบกลับเป็นรหัส บางรหัสแปลให้ลูกค้าอ่านเข้าใจ (ไม่รู้จักรหัสก็ใช้ข้อความจาก SlipOK)
const SLIPOK_REASONS: Record<number, string> = {
  1007: "รูปนี้ไม่มี QR ของสลิป",
  1008: "QR ในรูปไม่ใช่สลิปโอนเงิน",
  1010: "ธนาคารยังไม่ส่งข้อมูลสลิปนี้",
  1012: "สลิปนี้เคยใช้แล้ว",
  1013: "ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องจ่าย",
  1014: "บัญชีผู้รับไม่ใช่บัญชีของร้าน",
};

export type SlipCheck = { ok: true; ref: string } | { ok: false; reason: string };

// ตรวจสลิปอัตโนมัติกับ SlipOK; คืน null เมื่อยังไม่ได้ตั้งค่า (ให้ร้านตรวจเอง)
export async function checkSlip(image: Blob, amount: number): Promise<SlipCheck | null> {
  const key = process.env.SLIPOK_API_KEY?.trim().replace(/^["']|["']$/g, "");
  const branch = process.env.SLIPOK_BRANCH_ID?.trim().replace(/^["'#]|["']$/g, "");
  if (!key || !branch) return null;
  const fd = new FormData();
  fd.append("files", image, "slip.jpg");
  fd.append("log", "true");
  fd.append("amount", String(amount));
  try {
    const r = await fetch(`https://api.slipok.com/api/line/apikey/${encodeURIComponent(branch)}`, {
      method: "POST",
      headers: { "x-authorization": key },
      body: fd,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const j = (await r.json().catch(() => null)) as {
      success?: boolean;
      code?: number;
      message?: string;
      data?: { success?: boolean; transRef?: string; amount?: number };
    } | null;
    const d = j?.data;
    if (r.ok && j?.success && d?.success && d.transRef && Number(d.amount) === amount) return { ok: true, ref: String(d.transRef) };
    if (r.ok && d?.success && Number(d.amount) !== amount) return { ok: false, reason: SLIPOK_REASONS[1013] };
    return { ok: false, reason: (j?.code && SLIPOK_REASONS[j.code]) || j?.message || "ตรวจสลิปอัตโนมัติไม่ผ่าน" };
  } catch (e) {
    console.error("slipok failed", e);
    return { ok: false, reason: "ระบบตรวจสลิปไม่ตอบ" };
  }
}
