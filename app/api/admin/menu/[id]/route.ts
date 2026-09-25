import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { MENU_COLUMNS } from "@/lib/orders";
import { db } from "@/lib/supabase";
import { parseMenuInput } from "../validate";

// แก้เมนู (ส่งมาเฉพาะช่องที่เปลี่ยน เช่น { available: false })
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = parseMenuInput(await req.json().catch(() => null), false);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, error } = await db()
    .from("menu_items")
    .update(parsed.row)
    .eq("id", (await params).id)
    .select(MENU_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) return NextResponse.json({ error: "ไม่พบเมนู" }, { status: 404 });
  return NextResponse.json(data);
}

// ลบเมนู (ออเดอร์เก่าเก็บชื่อเมนูไว้ในตัวเองแล้ว จึงไม่กระทบ)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { error } = await db().from("menu_items").delete().eq("id", (await params).id);
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
