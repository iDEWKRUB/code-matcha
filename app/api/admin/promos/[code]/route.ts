import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { listPromos } from "@/lib/promoServer";
import { db } from "@/lib/supabase";

// เปิด/ปิดโค้ด
export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { active } = (await req.json().catch(() => ({}))) as { active?: unknown };
  if (typeof active !== "boolean") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const { error } = await db().from("promo_codes").update({ active }).eq("code", decodeURIComponent((await params).code));
  if (error) throw error;
  return NextResponse.json(await listPromos());
}

// ลบโค้ด (ออเดอร์เก่ายังเก็บชื่อโค้ดและส่วนลดไว้)
export async function DELETE(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { error } = await db().from("promo_codes").delete().eq("code", decodeURIComponent((await params).code));
  if (error) throw error;
  return NextResponse.json(await listPromos());
}
