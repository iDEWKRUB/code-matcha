import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { normalizeCode } from "@/lib/promo";
import { listPromos } from "@/lib/promoServer";
import { db } from "@/lib/supabase";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
const posInt = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await listPromos());
}

// สร้าง/แก้โค้ด (upsert ตามชื่อโค้ด)
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = normalizeCode(String(b.code ?? ""));
  if (code.length < 3) return bad("โค้ดต้องยาวอย่างน้อย 3 ตัว (A-Z, 0-9, -)");
  if (b.kind !== "percent" && b.kind !== "amount") return bad("เลือกประเภทส่วนลด");
  const value = posInt(b.value);
  if (!value || (b.kind === "percent" && value > 100)) return bad("มูลค่าส่วนลดไม่ถูกต้อง");
  const expires = typeof b.expiresOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.expiresOn) ? b.expiresOn : null;
  const hm = (v: unknown) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);
  const timeFrom = hm(b.timeFrom);
  const timeTo = hm(b.timeTo);
  if (!timeFrom !== !timeTo) return bad("ใส่เวลาเริ่มและเวลาสิ้นสุดให้ครบ หรือเว้นว่างทั้งคู่");
  if (timeFrom && timeTo && timeFrom >= timeTo) return bad("เวลาสิ้นสุดต้องหลังเวลาเริ่ม");
  const row = {
    code,
    kind: b.kind,
    value,
    max_discount: b.kind === "percent" ? posInt(b.maxDiscount) : null,
    min_spend: Number.isInteger(b.minSpend) && (b.minSpend as number) >= 0 ? b.minSpend : 0,
    new_customers_only: b.newCustomersOnly === true,
    per_user_limit: posInt(b.perUserLimit) ?? 1,
    max_uses: posInt(b.maxUses),
    expires_on: expires,
    active: b.active !== false,
    note: typeof b.note === "string" ? b.note.trim().slice(0, 80) : "",
    show_customers: b.showCustomers === true,
    time_from: timeFrom,
    time_to: timeTo,
  };
  const { error } = await db().from("promo_codes").upsert(row);
  if (error) throw error;
  return NextResponse.json(await listPromos());
}
