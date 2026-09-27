import { COST_CATEGORIES, type CostCategory } from "@/lib/costs";

export const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// ตัวเลขทศนิยมไม่ติดลบ (รับทั้ง number และ string จากช่องกรอก)
export function amount(v: unknown, max = 1_000_000): number | null {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
export const category = (v: unknown): CostCategory => (COST_CATEGORIES.some((c) => c.id === v) ? (v as CostCategory) : "other");
