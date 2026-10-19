import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { isPillar } from "@/lib/marketing";
import { db } from "@/lib/supabase";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  if (!(await isAdmin())) return bad("unauthorized", 401);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title || title.length > 120) return bad("ใส่หัวข้อไอเดีย (ไม่เกิน 120 ตัวอักษร)");
  const pillar = isPillar(b.pillar) ? b.pillar : "menu";
  const format = typeof b.format === "string" ? b.format.trim().slice(0, 40) : "";
  const { data, error } = await db().from("marketing_ideas").insert({ title, pillar, format }).select("id,title,pillar,format").single();
  if (error) return bad("ยังไม่ได้รัน migration-042-marketing.sql", 503);
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return bad("unauthorized", 401);
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return bad("ข้อมูลไม่ถูกต้อง");
  const { error } = await db().from("marketing_ideas").delete().eq("id", id);
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
