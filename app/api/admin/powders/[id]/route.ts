import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getPowders } from "@/lib/orders";
import { db } from "@/lib/supabase";

// เปิด/ปิดให้ลูกค้าเลือก หรือเลื่อนลำดับ (move: -1 ขึ้น, 1 ลง)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  const b = (await req.json().catch(() => ({}))) as { active?: unknown; move?: unknown };
  if (typeof b.active === "boolean") {
    const { error } = await db().from("matcha_powders").update({ active: b.active }).eq("id", id);
    if (error) throw error;
  } else if (b.move === -1 || b.move === 1) {
    const list = await getPowders(false);
    const i = list.findIndex((p) => p.id === String(id));
    const j = i + (b.move as number);
    if (i >= 0 && j >= 0 && j < list.length) {
      [list[i], list[j]] = [list[j], list[i]];
      for (const [k, p] of list.entries()) {
        const { error } = await db().from("matcha_powders").update({ sort: k }).eq("id", Number(p.id));
        if (error) throw error;
      }
    }
  } else return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  return NextResponse.json(await getPowders(false));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { error } = await db().from("matcha_powders").delete().eq("id", Number((await params).id));
  if (error) throw error;
  return NextResponse.json(await getPowders(false));
}
