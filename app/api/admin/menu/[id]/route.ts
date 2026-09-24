import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { available } = (await req.json().catch(() => ({}))) as { available?: unknown };
  if (typeof available !== "boolean") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const { error } = await db().from("menu_items").update({ available }).eq("id", (await params).id);
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
