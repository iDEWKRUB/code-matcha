import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { costsPayload } from "@/lib/costsServer";
import { db } from "@/lib/supabase";
import { amount, category, text } from "../../validate";

// บันทึกสูตรต้นทุนของเมนู (แทนที่ทั้งชุด)
export async function PUT(req: Request, { params }: { params: Promise<{ menuId: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const menuId = decodeURIComponent((await params).menuId);
  const { lines } = (await req.json().catch(() => ({}))) as { lines?: unknown };
  if (!Array.isArray(lines) || lines.length > 60) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const rows = [];
  for (const [i, raw] of lines.entries()) {
    const l = (raw ?? {}) as Record<string, unknown>;
    const name = text(l.name, 80);
    const unitCost = amount(l.unitCost);
    const qty = amount(l.qty, 100000);
    if (!name || unitCost === null || qty === null)
      return NextResponse.json({ error: `รายการที่ ${i + 1} ไม่ครบ (ชื่อ ราคา จำนวน)` }, { status: 400 });
    rows.push({
      menu_item_id: menuId,
      cost_item_id: Number.isInteger(l.costItemId) ? (l.costItemId as number) : null,
      name,
      category: category(l.category),
      unit: text(l.unit, 20),
      unit_cost: unitCost,
      qty,
      sort: i,
    });
  }
  const { error: e1 } = await db().from("menu_cost_lines").delete().eq("menu_item_id", menuId);
  if (e1) throw e1;
  if (rows.length) {
    const { error: e2 } = await db().from("menu_cost_lines").insert(rows);
    if (e2) throw e2;
  }
  return NextResponse.json(await costsPayload());
}
