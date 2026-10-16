import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { listPromos } from "@/lib/promoServer";
import { db } from "@/lib/supabase";

// เปิด/ปิดโค้ด
export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // เปิด/ปิดโค้ด (active) หรือ แสดงในหน้าชำระของลูกค้า (showCustomers)
  const { active, showCustomers } = (await req.json().catch(() => ({}))) as { active?: unknown; showCustomers?: unknown };
  const patch: Record<string, boolean> = {};
  if (typeof active === "boolean") patch.active = active;
  if (typeof showCustomers === "boolean") patch.show_customers = showCustomers;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const { error } = await db().from("promo_codes").update(patch).eq("code", decodeURIComponent((await params).code));
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
