import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getBarHours } from "@/lib/barServer";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getBarHours());
}

// บันทึกเฉพาะช่องที่ส่งมา: เปิดให้ลูกค้าเห็น / 24 ชม. / เวลาเปิด-ปิด (ปิดก่อนเปิด = ข้ามเที่ยงคืน)
export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const row: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
  if ("enabled" in b) {
    if (typeof b.enabled !== "boolean") return bad("ข้อมูลไม่ถูกต้อง");
    row.bar_enabled = b.enabled;
  }
  if ("allDay" in b) {
    if (typeof b.allDay !== "boolean") return bad("ข้อมูลไม่ถูกต้อง");
    row.bar_all_day = b.allDay;
  }
  if ("openTime" in b || "closeTime" in b) {
    if (typeof b.openTime !== "string" || typeof b.closeTime !== "string" || !TIME.test(b.openTime) || !TIME.test(b.closeTime))
      return bad("รูปแบบเวลาไม่ถูกต้อง");
    if (b.openTime === b.closeTime) return bad("เวลาเปิดกับเวลาปิดต้องไม่ตรงกัน (ถ้าจะเปิดทั้งวัน ให้เลือก 24 ชม.)");
    row.bar_open_time = b.openTime;
    row.bar_close_time = b.closeTime;
  }
  const { error } = await db().from("shop_settings").upsert(row);
  if (error) throw error;
  return NextResponse.json(await getBarHours());
}
