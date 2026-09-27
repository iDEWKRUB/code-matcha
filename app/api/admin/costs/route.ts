import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { costsPayload } from "@/lib/costsServer";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await costsPayload());
}

// ตั้งค่า: บวก VAT บนค่า GP หรือไม่
export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { gpVat } = (await req.json().catch(() => ({}))) as { gpVat?: unknown };
  if (typeof gpVat !== "boolean") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const { error } = await db().from("shop_settings").update({ gp_vat: gpVat }).eq("id", 1);
  if (error) throw error;
  return NextResponse.json(await costsPayload());
}
