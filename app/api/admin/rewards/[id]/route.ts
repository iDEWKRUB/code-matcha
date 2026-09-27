import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { rewardsPayload } from "@/lib/member";

// เปิด/ปิดการแลก
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { active } = (await req.json().catch(() => ({}))) as { active?: unknown };
  if (typeof active !== "boolean") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const { error } = await db().from("rewards").update({ active }).eq("id", Number((await params).id));
  if (error) throw error;
  return NextResponse.json(await rewardsPayload());
}

// ลบของขวัญ (คูปองที่ลูกค้าแลกไปแล้วยังอยู่ครบ)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { error } = await db().from("rewards").delete().eq("id", Number((await params).id));
  if (error) throw error;
  return NextResponse.json(await rewardsPayload());
}
