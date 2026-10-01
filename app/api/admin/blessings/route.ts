import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { DEFAULT_BLESSINGS, cleanBlessings } from "@/lib/blessings";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await db().from("shop_settings").select("blessings").eq("id", 1).maybeSingle();
  if (error) throw error;
  const list = data?.blessings ? cleanBlessings(data.blessings) : null;
  return NextResponse.json({ messages: Array.isArray(list) ? list : DEFAULT_BLESSINGS, custom: Array.isArray(list) });
}

// บันทึกทั้งชุด · reset = กลับไปใช้ชุดตั้งต้น
export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { messages?: unknown; reset?: boolean };
  let value: unknown = null;
  if (!b.reset) {
    const list = cleanBlessings(b.messages);
    if (typeof list === "string") return NextResponse.json({ error: list }, { status: 400 });
    value = list;
  }
  const { error } = await db().from("shop_settings").upsert({ id: 1, blessings: value, updated_at: new Date().toISOString() });
  if (error) throw error;
  return NextResponse.json({ messages: value ?? DEFAULT_BLESSINGS, custom: !!value });
}
