import "server-only";
import { TRAY_KEEP_DAYS, type BarItem } from "./bar";
import { db } from "./supabase";

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
