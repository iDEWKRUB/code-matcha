import crypto from "crypto";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { BAR_KINDS, BAR_MAX_CATEGORY, BAR_MAX_CODE, barCode, type BarItem } from "@/lib/bar";
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
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const row = {
    name,
    kind,
    price,
    available: b.available !== false,
    sort: Number.isInteger(b.sort) ? b.sort : 0,
    image_url: typeof b.imageUrl === "string" && b.imageUrl.startsWith("https://") ? b.imageUrl : null,
    category: text(b.category, BAR_MAX_CATEGORY) || "อื่น ๆ",
    item_group: text(b.group, 60),
    detail: text(b.detail, 120),
    unit: text(b.unit, 20),
  };
  // รหัสสินค้า: ว่าง = ให้ระบบออกเลขถัดไป
  let code: number | null = b.code === null || b.code === undefined || (b.code as unknown) === "" ? null : Number(b.code);
  if (code !== null && (!Number.isInteger(code) || code < 1 || code > BAR_MAX_CODE)) return fail(`รหัสสินค้าต้องเป็นเลข 1–${BAR_MAX_CODE}`);
  if (code === null) {
    const { data: top } = await db().from("bar_items").select("code").not("code", "is", null).order("code", { ascending: false }).limit(1);
    code = Math.min(BAR_MAX_CODE, (top?.[0]?.code ?? 0) + 1);
  }
  const { data: same } = await db().from("bar_items").select("id,name").eq("code", code).limit(1);
  if (same?.[0] && same[0].id !== b.id) return fail(`รหัส ${barCode(code)} ใช้กับ "${same[0].name}" แล้ว`);
  const { error } = b.id
    ? await db().from("bar_items").update({ ...row, code }).eq("id", String(b.id))
    : await db().from("bar_items").insert({ ...row, code, id: `b-${crypto.randomBytes(4).toString("hex")}` });
  if (error) throw error;
  return NextResponse.json({ items: await getBarItems(false) });
}

// เปิด/ปิดขายทีละหลายรายการ (ปุ่ม "เปิดขายที่แสดงอยู่" หลังกรองหมวด/ค้นหา)
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const b = (await req.json().catch(() => null)) as { ids?: unknown; available?: unknown } | null;
  const ids = Array.isArray(b?.ids) ? b.ids.filter((x): x is string => typeof x === "string").slice(0, 500) : [];
  if (!ids.length || typeof b?.available !== "boolean") return fail("ข้อมูลไม่ถูกต้อง");
  const { error } = await db().from("bar_items").update({ available: b.available }).in("id", ids);
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
