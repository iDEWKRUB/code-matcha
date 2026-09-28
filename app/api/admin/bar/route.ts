import crypto from "crypto";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { BAR_KINDS, type BarItem } from "@/lib/bar";
import { getBarItems } from "@/lib/barServer";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET() {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  return NextResponse.json({ items: await getBarItems(false) });
}

// เพิ่ม (ไม่มี id) หรือแก้ของในมาม่าบาร์
export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const b = (await req.json().catch(() => null)) as Partial<BarItem> | null;
  if (!b) return fail("ข้อมูลไม่ถูกต้อง");
  const name = String(b.name ?? "").trim().slice(0, 60);
  const price = Number(b.price);
  if (!name) return fail("กรุณาใส่ชื่อ");
  if (!Number.isInteger(price) || price < 0 || price > 10000) return fail("ราคาไม่ถูกต้อง");
  const kind = BAR_KINDS.some((k) => k.id === b.kind) ? b.kind : "other";
  const row = {
    name,
    kind,
    price,
    available: b.available !== false,
    sort: Number.isInteger(b.sort) ? b.sort : 0,
    image_url: typeof b.imageUrl === "string" && b.imageUrl.startsWith("https://") ? b.imageUrl : null,
  };
  const { error } = b.id
    ? await db().from("bar_items").update(row).eq("id", String(b.id))
    : await db().from("bar_items").insert({ ...row, id: `b-${crypto.randomBytes(4).toString("hex")}` });
  if (error) throw error;
  return NextResponse.json({ items: await getBarItems(false) });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("ไม่พบรายการ");
  const { error } = await db().from("bar_items").delete().eq("id", id);
  if (error) throw error;
  return NextResponse.json({ items: await getBarItems(false) });
}
