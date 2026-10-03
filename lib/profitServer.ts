import "server-only";
import { powderCost, recipeCost, type CostItem } from "./costs";
import { costsPayload } from "./costsServer";
import { getMenu, getPowders } from "./orders";
import { db } from "./supabase";

// ต้นทุนของแต่ละรายการในออเดอร์ (ออเดอร์เก็บแค่ชื่อ/รายละเอียด/ราคา จึงจับคู่ด้วยชื่อกับสูตรปัจจุบัน)
// มัทฉะ: สูตรในแท็บต้นทุน (ถ้ารายละเอียดมีชื่อผงที่เลือก ใช้ต้นทุนผงนั้น × กรัมของเมนู)
// มาม่าบาร์: ต้นทุนต่อชิ้นที่ตั้งในของในบาร์ · หาไม่เจอ = null (ยังไม่มีต้นทุน)
export async function costResolver() {
  const [costs, menu, powders, bar] = await Promise.all([
    costsPayload(),
    getMenu(),
    getPowders(false),
    db().from("bar_items").select("name,cost"),
  ]);
  const items = new Map<number, CostItem>(costs.items.map((i) => [i.id, i]));
  const powderIds = new Set(powders.map((p) => p.costItemId).filter((x): x is number => x !== null));
  const menuByName = new Map(menu.map((m) => [m.name, m]));
  const barCost = new Map<string, number>();
  if (!bar.error) for (const r of bar.data as { name: string; cost: number | null }[]) if (r.cost !== null) barCost.set(r.name, Number(r.cost));

  const cache = new Map<string, number | null>();
  return function unitCost(source: string, name: string, detail: string): number | null {
    const key = `${source}|${name}|${detail}`;
    if (cache.has(key)) return cache.get(key)!;
    let c: number | null = null;
    if (source === "bar") c = barCost.get(name) ?? null;
    else {
      const m = menuByName.get(name);
      const lines = m ? costs.recipes[m.id] : undefined;
      if (m && lines?.length) {
        c = recipeCost(lines, items);
        const p = m.grams ? powders.find((x) => detail.includes(x.name)) : undefined;
        if (p && m.grams) c = powderCost(lines, items, m.grams, p, powderIds) ?? c;
      }
    }
    cache.set(key, c);
    return c;
  };
}
