import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getPowders } from "@/lib/orders";
import { db } from "@/lib/supabase";
import { amount, text } from "../costs/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getPowders(false));
}

// เพิ่ม (ไม่มี id) หรือแก้ (มี id) ผงมัทฉะ
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = text(b.name, 40);
  if (!name) return NextResponse.json({ error: "กรุณาใส่ชื่อผงมัทฉะ" }, { status: 400 });
  const extra = amount(b.extraPerGram, 500);
  if (extra === null) return NextResponse.json({ error: "ราคาบวกต่อกรัมไม่ถูกต้อง" }, { status: 400 });
  const row = {
    name,
    note: text(b.note, 80),
    extra_per_gram: Math.round(extra * 100) / 100,
    cost_item_id: Number.isInteger(b.costItemId) ? (b.costItemId as number) : null,
  };
  const id = Number(b.id);
  if (Number.isInteger(id) && id > 0) {
    const { error } = await db().from("matcha_powders").update(row).eq("id", id);
    if (error) throw error;
  } else {
    const { data: last } = await db().from("matcha_powders").select("sort").order("sort", { ascending: false }).limit(1);
    const { error } = await db().from("matcha_powders").insert({ ...row, sort: (last?.[0]?.sort ?? 0) + 1 });
    if (error) throw error;
  }
  return NextResponse.json(await getPowders(false));
}
