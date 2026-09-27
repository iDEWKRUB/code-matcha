// ต้นทุน & กำไร: ชนิดข้อมูลและสูตรคำนวณ (ใช้ได้ทั้งหน้าเว็บและเซิร์ฟเวอร์)

export const COST_CATEGORIES = [
  { id: "ingredient", label: "วัตถุดิบ" },
  { id: "packaging", label: "บรรจุภัณฑ์" },
  { id: "labor", label: "ค่าแรง" },
  { id: "utility", label: "ค่าน้ำ-ไฟ" },
  { id: "other", label: "อื่น ๆ" },
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number]["id"];
export const categoryLabel = (c: string) => COST_CATEGORIES.find((x) => x.id === c)?.label ?? "อื่น ๆ";

export type CostItem = {
  id: number;
  name: string;
  category: CostCategory;
  unit: string;
  unitCost: number;
  packPrice: number | null;
  packSize: number | null;
  sort: number;
};

export type CostLine = {
  id?: number;
  costItemId: number | null; // ผูกกับคลัง → ใช้ราคาปัจจุบันของคลัง
  name: string;
  category: CostCategory;
  unit: string;
  unitCost: number; // สำเนาราคา (ใช้เมื่อไม่ได้ผูกกับคลัง หรือรายการในคลังถูกลบ)
  qty: number;
};

export type GpPlatform = { id: number; name: string; gpPercent: number; sort: number };

export type CostsPayload = {
  items: CostItem[];
  recipes: Record<string, CostLine[]>; // menu_item_id → รายการต้นทุน
  platforms: GpPlatform[];
  gpVat: boolean;
};

// ราคาต่อหน่วยจากราคาแพ็ก เช่น ผงมัทฉะ 650 บาท / 30 กรัม = 21.67 บาท/กรัม
export const packUnitCost = (packPrice: number, packSize: number) => (packSize > 0 ? packPrice / packSize : 0);

export function lineUnitCost(l: CostLine, items: Map<number, CostItem>) {
  const linked = l.costItemId !== null ? items.get(l.costItemId) : undefined;
  return linked ? linked.unitCost : l.unitCost;
}
export const lineTotal = (l: CostLine, items: Map<number, CostItem>) => lineUnitCost(l, items) * l.qty;
export const recipeCost = (lines: CostLine[], items: Map<number, CostItem>) => lines.reduce((n, l) => n + lineTotal(l, items), 0);

// กำไรขั้นต้นเป็น % ของราคาขาย
export const marginPct = (price: number, cost: number) => (price > 0 ? ((price - cost) / price) * 100 : 0);
// ราคาที่ต้องตั้งเพื่อให้ได้กำไร m% ของราคาขาย
export const priceForMargin = (cost: number, m: number) => (m < 100 ? cost / (1 - m / 100) : 0);
// ค่า GP ที่หักจริง (บวก VAT 7% ถ้าเปิดไว้)
export const gpRate = (p: GpPlatform, vat: boolean) => (p.gpPercent / 100) * (vat ? 1.07 : 1);
// ราคาบนแอปที่ทำให้ได้เงินสุทธิเท่าขายหน้าร้าน
export const onlinePrice = (price: number, rate: number) => (rate < 1 ? price / (1 - rate) : 0);

// ระดับกำไร (ร้านเครื่องดื่มทั่วไปตั้งเป้าต้นทุนวัตถุดิบ ~30–35% ของราคาขาย)
export function marginLevel(m: number): { id: "good" | "ok" | "low"; label: string } {
  if (m >= 65) return { id: "good", label: "กำไรดี" };
  if (m >= 50) return { id: "ok", label: "พอใช้" };
  return { id: "low", label: "กำไรน้อย" };
}

export const baht = (n: number, digits = 2) =>
  `฿${n.toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
