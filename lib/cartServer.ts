import "server-only";
import { MAX_QTY, MILKS, SWEET, hasPowder, lineDetail, linePrice, optionGroups, type CartLine, type MenuItem, type OrderItem, type Powder } from "./menu";

// ตรวจรายการในตะกร้าและคิดราคาใหม่ที่เซิร์ฟเวอร์ (ใช้ทั้งลูกค้าสั่งใน LINE และพนักงานคิดเงินหน้าร้าน)
export function buildItems(
  lines: unknown,
  menuList: MenuItem[],
  powders: Powder[],
  { allowHidden = false }: { allowHidden?: boolean } = {},
): { items: OrderItem[]; total: number; cups: number } | { error: string } {
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 40) return { error: "ตะกร้าไม่ถูกต้อง" };
  const menu = new Map(menuList.map((m) => [m.id, m]));
  const items: OrderItem[] = [];
  let total = 0;
  let cups = 0;
  for (const raw of lines as Partial<CartLine>[]) {
    const item = menu.get(String(raw?.itemId));
    if (!item) return { error: "ไม่พบเมนูนี้" };
    if (!item.available || (item.hidden && !allowHidden)) return { error: `${item.name} หมดแล้ว` };
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return { error: "จำนวนไม่ถูกต้อง" };
    let line: CartLine;
    if (item.kind === "food") {
      // อาหาร: ใช้แค่ท็อปปิ้ง (ต้องเป็นของเมนูนี้ ไม่ซ้ำ)
      const tops = Array.isArray(raw.toppings) ? [...new Set(raw.toppings.map(String))] : [];
      if (tops.some((id) => !item.toppings.some((t) => t.id === id))) return { error: "ท็อปปิ้งไม่ถูกต้อง" };
      // ตัวเลือกแบบกลุ่ม ต้องเลือกกลุ่มละ 1 อย่างพอดี
      for (const g of optionGroups(item))
        if (g.options.filter((o) => tops.includes(o.id)).length !== 1) return { error: `กรุณาเลือก${g.name}` };
      line = { itemId: item.id, temp: item.temps[0] ?? "hot", sweet: 0, milk: null, powder: null, extraShot: false, softCream: false, toppings: tops, qty };
    } else {
      line = {
        itemId: item.id,
        temp: raw.temp as CartLine["temp"],
        sweet: Number(raw.sweet),
        milk: item.milk ? String(raw.milk) : null,
        powder: hasPowder(item) && powders.length ? String(raw.powder ?? powders[0].id) : null,
        extraShot: raw.extraShot === true,
        iceSep: raw.iceSep === true,
        softCream: raw.softCream === true,
        toppings: [],
        qty,
      };
      if (!item.temps.includes(line.temp)) return { error: "อุณหภูมิไม่ถูกต้อง" };
      if (!SWEET.includes(line.sweet)) return { error: "ระดับความหวานไม่ถูกต้อง" };
      if (item.milk && !MILKS.some((m) => m.id === line.milk)) return { error: "ชนิดนมไม่ถูกต้อง" };
      if (line.powder !== null && !powders.some((p) => p.id === line.powder)) return { error: "ผงมัทฉะนี้ไม่มีแล้ว กรุณาเลือกใหม่" };
      if (line.softCream && line.temp !== "iced") return { error: "ท็อปซอฟต์ครีมได้เฉพาะเครื่องดื่มเย็น" };
      if (!item.addons && (line.extraShot || line.softCream)) return { error: `${item.name} ไม่มีท็อปปิ้งให้เลือก` };
      if (line.iceSep && line.temp !== "iced") return { error: "แยกน้ำแข็งได้เฉพาะเครื่องดื่มเย็น" };
    }
    const price = linePrice(item, line, powders);
    items.push({ name: item.name, qty: line.qty, detail: lineDetail(item, line, powders), price });
    total += price;
    cups += line.qty;
  }
  return { items, total, cups };
}
