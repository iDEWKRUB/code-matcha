import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/orders";
import { db } from "@/lib/supabase";
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
  if ("slotMinutes" in b) {
    if (![5, 10, 15, 20, 30, 60].includes(b.slotMinutes as number)) return bad("ระยะห่างรอบไม่ถูกต้อง");
    row.slot_minutes = b.slotMinutes;
  }
  if ("slotCapacity" in b) {
    const c = b.slotCapacity as number;
    if (!Number.isInteger(c) || c < 1 || c > 100) return bad("จำนวนแก้วต่อรอบต้องอยู่ระหว่าง 1–100");
    row.slot_capacity = c;
  }

  const { error } = await db().from("shop_settings").upsert(row);
  if (error) throw error;
  return NextResponse.json(await getSettings());
}
