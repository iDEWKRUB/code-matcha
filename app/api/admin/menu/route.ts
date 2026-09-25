import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { MENU_COLUMNS } from "@/lib/orders";
import { parseMenuInput } from "./validate";

// เพิ่มเมนูใหม่
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = parseMenuInput(await req.json().catch(() => null), true);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data: last } = await db().from("menu_items").select("sort").order("sort", { ascending: false }).limit(1);
  const row = {
    id: `menu-${Date.now().toString(36)}`,
    available: true,
    sort: (last?.[0]?.sort ?? 0) + 1,
    ...parsed.row,
  };
  const { data, error } = await db().from("menu_items").insert(row).select(MENU_COLUMNS).single();
  if (error) throw error;
  return NextResponse.json(data);
}
