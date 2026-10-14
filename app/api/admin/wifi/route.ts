import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ชื่อ/รหัส Wi-Fi ที่พิมพ์ท้ายใบเสร็จหน้าร้าน (เฉพาะแอดมิน ไม่ส่งให้หน้าลูกค้า)
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await db().from("shop_settings").select("wifi_ssid,wifi_pass").eq("id", 1).maybeSingle();
  if (error) return NextResponse.json({ error: "ยังไม่ได้รัน migration-037-wifi.sql" }, { status: 503 });
  return NextResponse.json({ ssid: data?.wifi_ssid ?? "", pass: data?.wifi_pass ?? "" });
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { ssid?: unknown; pass?: unknown };
  if (typeof b.ssid !== "string" || typeof b.pass !== "string") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const ssid = b.ssid.trim(), pass = b.pass.trim();
  if (ssid.length > 64 || pass.length > 64) return NextResponse.json({ error: "ชื่อหรือรหัสยาวเกิน 64 ตัวอักษร" }, { status: 400 });
  if (!ssid && pass) return NextResponse.json({ error: "ใส่ชื่อ Wi-Fi ด้วย" }, { status: 400 });
  const { error } = await db().from("shop_settings").upsert({ id: 1, wifi_ssid: ssid, wifi_pass: pass, updated_at: new Date().toISOString() });
  if (error) throw error;
  return NextResponse.json({ ssid, pass });
}
