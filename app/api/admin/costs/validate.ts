import { COST_CATEGORIES, type CostCategory } from "@/lib/costs";

export const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// ตัวเลขทศนิยมไม่ติดลบ (รับทั้ง number และ string จากช่องกรอก)
export function amount(v: unknown, max = 1_000_000): number | null {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
export const category = (v: unknown): CostCategory => (COST_CATEGORIES.some((c) => c.id === v) ? (v as CostCategory) : "other");

// ลิงก์รูปต้องมาจาก bucket "promo" ของร้านเท่านั้น (ว่าง = ไม่มีรูป, undefined = ไม่ถูกต้อง)
export function imageUrl(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || v.length > 400) return undefined;
  return v.startsWith(`${process.env.SUPABASE_URL}/storage/v1/object/public/promo/`) ? v : undefined;
}
