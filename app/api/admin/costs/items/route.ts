import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { packUnitCost } from "@/lib/costs";
import { costsPayload } from "@/lib/costsServer";
import { db } from "@/lib/supabase";
import { amount, category, imageUrl, text } from "../validate";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
const blank = (v: unknown) => v === null || v === undefined || v === "";

// เพิ่ม (ไม่มี id) หรือแก้ (มี id) รายการในคลัง — ใส่ราคาแพ็กแล้วระบบคิดราคาต่อหน่วยให้
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = text(b.name, 80);
  if (!name) return bad("กรุณาใส่ชื่อรายการ");
  const packPrice = blank(b.packPrice) ? null : amount(b.packPrice);
  const packSize = blank(b.packSize) ? null : amount(b.packSize);
  if (!blank(b.packPrice) && packPrice === null) return bad("ราคาแพ็กไม่ถูกต้อง");
  if (!blank(b.packSize) && packSize === null) return bad("ขนาดแพ็กไม่ถูกต้อง");
  if ((packPrice === null) !== (packSize === null)) return bad("ใส่ทั้งราคาที่ซื้อและปริมาณที่ได้ หรือเว้นว่างทั้งคู่");
  if (packSize !== null && packSize <= 0) return bad("ปริมาณที่ได้ต้องมากกว่า 0");
  const unitCost = packPrice !== null && packSize !== null ? packUnitCost(packPrice, packSize) : amount(b.unitCost);
  if (unitCost === null) return bad("ราคาต่อหน่วยไม่ถูกต้อง");
  const image = imageUrl(b.imageUrl);
  if (image === undefined) return bad("ลิงก์รูปไม่ถูกต้อง");
  const row = {
    name,
    category: category(b.category),
    unit: text(b.unit, 20),
    unit_cost: Math.round(unitCost * 10000) / 10000,
    pack_price: packPrice,
    pack_size: packSize,
    image_url: image,
  };
  const id = Number.isInteger(b.id) ? (b.id as number) : null;
  const { error } = id ? await db().from("cost_items").update(row).eq("id", id) : await db().from("cost_items").insert(row);
  if (error) throw error;
  // อัปเดตสำเนาในสูตรที่ผูกไว้ด้วย (ใช้เมื่อรายการในคลังถูกลบภายหลัง)
  if (id) {
    const { error: e } = await db()
      .from("menu_cost_lines")
      .update({ name: row.name, category: row.category, unit: row.unit, unit_cost: row.unit_cost })
      .eq("cost_item_id", id);
    if (e) throw e;
  }
  return NextResponse.json(await costsPayload());
}
