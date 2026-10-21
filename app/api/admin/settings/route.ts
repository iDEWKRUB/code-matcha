import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/orders";
import { db } from "@/lib/supabase";
import { isTime, type ClosedDate, type DayHours } from "@/lib/schedule";
import { toMinutes } from "@/lib/time";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getSettings());
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

// บันทึกเฉพาะช่องที่ส่งมา (ป้ายประกาศ หรือ เวลาเปิด-ปิด)
export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const row: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };

  if ("banner" in b) {
    if (typeof b.banner !== "string") return bad("ข้อความไม่ถูกต้อง");
    row.banner = b.banner.trim().slice(0, 120);
  }
  if ("bannerActive" in b) {
    if (typeof b.bannerActive !== "boolean") return bad("ข้อมูลไม่ถูกต้อง");
    row.banner_active = b.bannerActive;
  }
  if ("notice" in b) {
    if (typeof b.notice !== "string") return bad("ข้อความไม่ถูกต้อง");
    row.notice = b.notice.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 300);
  }
  if ("noticeActive" in b) {
    if (typeof b.noticeActive !== "boolean") return bad("ข้อมูลไม่ถูกต้อง");
    row.notice_active = b.noticeActive;
  }
  if ("noticeUntil" in b) {
    const u = b.noticeUntil;
    if (u !== null && (typeof u !== "string" || Number.isNaN(Date.parse(u)))) return bad("เวลาสิ้นสุดประกาศไม่ถูกต้อง");
    row.notice_until = u;
  }
  if ("accepting" in b) {
    if (typeof b.accepting !== "boolean") return bad("ข้อมูลไม่ถูกต้อง");
    row.accepting = b.accepting;
  }
  if ("openTime" in b || "closeTime" in b) {
    if (typeof b.openTime !== "string" || typeof b.closeTime !== "string" || !TIME.test(b.openTime) || !TIME.test(b.closeTime))
      return bad("รูปแบบเวลาไม่ถูกต้อง");
    if (toMinutes(b.closeTime) <= toMinutes(b.openTime)) return bad("เวลาปิดต้องหลังเวลาเปิด");
    row.open_time = b.openTime;
    row.close_time = b.closeTime;
  }
  // ตารางเวลารายสัปดาห์: 7 ช่อง (อาทิตย์…เสาร์) · ต้องเปิดอย่างน้อย 1 วัน
  if ("weekly" in b) {
    const w = b.weekly;
    if (!Array.isArray(w) || w.length !== 7) return bad("ตารางเวลาไม่ถูกต้อง");
    const days: DayHours[] = [];
    for (const d of w as Partial<DayHours>[]) {
      if (typeof d?.closed !== "boolean" || !isTime(d.open) || !isTime(d.close)) return bad("รูปแบบเวลาไม่ถูกต้อง");
      if (!d.closed && toMinutes(d.close) <= toMinutes(d.open)) return bad("เวลาปิดต้องหลังเวลาเปิด");
      days.push({ closed: d.closed, open: d.open, close: d.close });
    }
    if (days.every((d) => d.closed)) return bad("ต้องเปิดร้านอย่างน้อย 1 วันต่อสัปดาห์");
    row.weekly_hours = days;
    // เวลาปกติเดิม (ใช้เป็นค่าสำรอง) = วันเปิดวันแรก
    const first = days.find((d) => !d.closed)!;
    row.open_time = first.open;
    row.close_time = first.close;
  }
  // วันหยุดพิเศษ (เช่น วันหยุดยาว) · เก็บเฉพาะวันที่ยังไม่ผ่าน
  if ("closedDates" in b) {
    const list = b.closedDates;
    if (!Array.isArray(list) || list.length > 100) return bad("วันหยุดพิเศษไม่ถูกต้อง");
    const out: ClosedDate[] = [];
    for (const d of list as Partial<ClosedDate>[]) {
      if (typeof d?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || Number.isNaN(Date.parse(d.date))) return bad("วันที่ไม่ถูกต้อง");
      if (out.some((x) => x.date === d.date)) continue;
      out.push({ date: d.date, note: typeof d.note === "string" ? d.note.trim().slice(0, 60) : "" });
    }
    row.closed_dates = out.sort((a, b) => a.date.localeCompare(b.date));
  }
  if ("slotMinutes" in b) {
    if (![5, 10, 15, 20, 30, 60].includes(b.slotMinutes as number)) return bad("ระยะห่างรอบไม่ถูกต้อง");
    row.slot_minutes = b.slotMinutes;
  }
  if ("slotCapacity" in b) {
    const c = b.slotCapacity as number;
    if (!Number.isInteger(c) || c < 1 || c > 100) return bad("จำนวนแก้วต่อรอบต้องอยู่ระหว่าง 1–100");
    row.slot_capacity = c;
  }

  if ("orderNoStart" in b) {
    const n = b.orderNoStart as number;
    if (!Number.isInteger(n) || n < 1 || n > 900) return bad("เลขออเดอร์แรกต้องอยู่ระหว่าง 1–900");
    row.order_no_start = n;
  }

  // จัดส่ง + สั่งล่วงหน้า
  for (const [k, col] of [["deliveryEnabled", "delivery_enabled"], ["preorderEnabled", "preorder_enabled"]] as const) {
    if (k in b) {
      if (typeof b[k] !== "boolean") return bad("ข้อมูลไม่ถูกต้อง");
      row[col] = b[k];
    }
  }
  if ("deliveryKm" in b) {
    const v = Number(b.deliveryKm);
    if (!(v > 0 && v <= 20)) return bad("รัศมีส่งต้องอยู่ระหว่าง 0.5–20 กม.");
    row.delivery_km = Math.round(v * 10) / 10;
  }
  if ("deliveryMin" in b) {
    const v = Number(b.deliveryMin);
    if (!Number.isInteger(v) || v < 0 || v > 10000) return bad("ยอดขั้นต่ำไม่ถูกต้อง");
    row.delivery_min = v;
  }
  if ("shopLat" in b || "shopLng" in b) {
    const lat = Number(b.shopLat), lng = Number(b.shopLng);
    if (b.shopLat === null && b.shopLng === null) {
      row.shop_lat = null;
      row.shop_lng = null;
    } else {
      if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180) || (lat === 0 && lng === 0)) return bad("พิกัดร้านไม่ถูกต้อง");
      row.shop_lat = lat;
      row.shop_lng = lng;
    }
  }
  for (const [k, col] of [["preorderFrom", "preorder_from"], ["preorderCutoff", "preorder_cutoff"]] as const) {
    if (k in b) {
      if (typeof b[k] !== "string" || !TIME.test(b[k] as string)) return bad("เวลาไม่ถูกต้อง");
      row[col] = b[k];
    }
  }

  const { error } = await db().from("shop_settings").upsert(row);
  if (error) throw error;
  return NextResponse.json(await getSettings());
}
