import type { CostCategory, CostItem, CostLine, CostsPayload, GpPlatform } from "./costs";
import { db } from "./supabase";

type ItemRow = {
  id: number;
  name: string;
  category: CostCategory;
  unit: string;
  unit_cost: number;
  pack_price: number | null;
  pack_size: number | null;
  image_url: string | null;
  sort: number;
};
type LineRow = { id: number; menu_item_id: string; cost_item_id: number | null; name: string; category: CostCategory; unit: string; unit_cost: number; qty: number; sort: number };
type PlatformRow = { id: number; name: string; gp_percent: number; sort: number };

const num = (v: unknown) => Number(v) || 0;

export const toCostItem = (r: ItemRow): CostItem => ({
  id: r.id,
  name: r.name,
  category: r.category,
  unit: r.unit,
  unitCost: num(r.unit_cost),
  packPrice: r.pack_price === null ? null : num(r.pack_price),
  packSize: r.pack_size === null ? null : num(r.pack_size),
  imageUrl: r.image_url,
  sort: r.sort,
});

export async function costsPayload(): Promise<CostsPayload> {
  const [items, lines, platforms, settings] = await Promise.all([
    db().from("cost_items").select("id,name,category,unit,unit_cost,pack_price,pack_size,image_url,sort").order("category").order("sort").order("id"),
    db().from("menu_cost_lines").select("id,menu_item_id,cost_item_id,name,category,unit,unit_cost,qty,sort").order("sort").order("id"),
    db().from("gp_platforms").select("id,name,gp_percent,sort").order("sort").order("id"),
    db().from("shop_settings").select("gp_vat").eq("id", 1).maybeSingle(),
  ]);
  for (const r of [items, lines, platforms, settings]) if (r.error) throw r.error;

  const recipes: Record<string, CostLine[]> = {};
  for (const l of lines.data as LineRow[]) {
    (recipes[l.menu_item_id] ??= []).push({
      id: l.id,
      costItemId: l.cost_item_id,
      name: l.name,
      category: l.category,
      unit: l.unit,
      unitCost: num(l.unit_cost),
      qty: num(l.qty),
    });
  }
  return {
    items: (items.data as ItemRow[]).map(toCostItem),
    recipes,
    platforms: (platforms.data as PlatformRow[]).map((p): GpPlatform => ({ id: p.id, name: p.name, gpPercent: num(p.gp_percent), sort: p.sort })),
    gpVat: settings.data?.gp_vat !== false,
  };
}
