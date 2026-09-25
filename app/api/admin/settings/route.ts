import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/orders";
import { db } from "@/lib/supabase";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getSettings());
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { banner?: unknown; bannerActive?: unknown };
  if (typeof b.banner !== "string" || typeof b.bannerActive !== "boolean")
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const { error } = await db()
    .from("shop_settings")
    .upsert({ id: 1, banner: b.banner.trim().slice(0, 120), banner_active: b.bannerActive, updated_at: new Date().toISOString() });
  if (error) throw error;
  return NextResponse.json(await getSettings());
}
