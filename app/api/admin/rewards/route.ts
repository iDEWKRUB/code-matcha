import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { rewardsPayload } from "@/lib/member";
import { MERCH_LOOKS } from "@/lib/rewards";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await rewardsPayload());
}

// เพิ่ม (ไม่มี id) หรือแก้ (มี id) ของขวัญ
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = text(b.name, 60);
  if (!name) return bad("กรุณาใส่ชื่อของขวัญ");
  const points = b.points;
  if (!Number.isInteger(points) || (points as number) < 1 || (points as number) > 100000) return bad("แต้มที่ใช้แลกต้องเป็นจำนวนเต็มมากกว่า 0");
  const stock = b.stock === null || b.stock === "" || b.stock === undefined ? null : b.stock;
  if (stock !== null && (!Number.isInteger(stock) || (stock as number) < 0)) return bad("จำนวนคงเหลือไม่ถูกต้อง");
  const category = b.category === "merch" ? "merch" : "menu";
  const image = text(b.imageUrl, 400);
  if (image && !image.startsWith(`${process.env.SUPABASE_URL}/storage/v1/object/public/promo/`)) return bad("ลิงก์รูปไม่ถูกต้อง");
  const look = text(b.look, 20);
  const row = {
    name,
    description: text(b.description, 120),
    points,
    stock,
    category,
    menu_item_id: category === "menu" ? text(b.menuItemId, 60) || null : null,
    look: category === "merch" && MERCH_LOOKS.some((l) => l.id === look) ? look : null,
    image_url: category === "merch" ? image || null : null,
    active: b.active !== false,
  };
  const { error } = Number.isInteger(b.id)
    ? await db().from("rewards").update(row).eq("id", b.id)
    : await db().from("rewards").insert(row);
  if (error) throw error;
  return NextResponse.json(await rewardsPayload());
}
