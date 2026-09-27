import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { costsPayload } from "@/lib/costsServer";
import { db } from "@/lib/supabase";
import { amount, text } from "../validate";

// เพิ่ม/แก้แพลตฟอร์มเดลิเวอรี่
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = text(b.name, 40);
  const gp = amount(b.gpPercent, 89.99);
  if (!name || gp === null) return NextResponse.json({ error: "ใส่ชื่อแพลตฟอร์มและค่า GP (0–89%)" }, { status: 400 });
  const id = Number.isInteger(b.id) ? (b.id as number) : null;
  const { error } = id
    ? await db().from("gp_platforms").update({ name, gp_percent: gp }).eq("id", id)
    : await db().from("gp_platforms").insert({ name, gp_percent: gp });
  if (error) throw error;
  return NextResponse.json(await costsPayload());
}
