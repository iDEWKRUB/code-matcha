import { LOOK_IDS } from "@/lib/menu";

type Row = Record<string, unknown>;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const money = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10000 ? (v as number) : undefined);

// ตรวจข้อมูลเมนูจากหน้าตั้งค่า (required = ตอนเพิ่มใหม่ต้องมีครบ)
export function parseMenuInput(body: unknown, required: boolean): { row: Row } | { error: string } {
  if (!body || typeof body !== "object") return { error: "ข้อมูลไม่ถูกต้อง" };
  const b = body as Row;
  const row: Row = {};

  if ("name" in b) {
    const name = text(b.name, 60);
    if (!name) return { error: "กรุณาใส่ชื่อเมนู" };
    row.name = name;
  } else if (required) return { error: "กรุณาใส่ชื่อเมนู" };

  if ("jp" in b) row.jp = text(b.jp, 40) ?? "";
  if ("description" in b) row.description = text(b.description, 200) ?? "";

  if ("price" in b) {
    const price = money(b.price);
    if (price === undefined || price === 0) return { error: "ราคาไม่ถูกต้อง" };
    row.price = price;
  } else if (required) return { error: "กรุณาใส่ราคา" };

  if ("promoPrice" in b) {
    if (b.promoPrice === null || b.promoPrice === "") row.promo_price = null;
    else {
      const promo = money(b.promoPrice);
      if (promo === undefined || promo === 0) return { error: "ราคาโปรไม่ถูกต้อง" };
      row.promo_price = promo;
    }
  }

  if ("temps" in b) {
    const temps = Array.isArray(b.temps) ? b.temps.filter((t) => t === "iced" || t === "hot") : [];
    if (!temps.length) return { error: "เลือกอย่างน้อย 1 แบบ (เย็น/ร้อน)" };
    row.temps = [...new Set(temps)];
  } else if (required) row.temps = ["iced"];

  for (const k of ["milk", "available", "recommended"] as const)
    if (k in b) {
      if (typeof b[k] !== "boolean") return { error: "ข้อมูลไม่ถูกต้อง" };
      row[k] = b[k];
    }

  if ("look" in b) {
    if (b.look !== null && !LOOK_IDS.includes(String(b.look))) return { error: "หน้าตาแก้วไม่ถูกต้อง" };
    row.look = b.look;
  }

  if ("kind" in b) {
    if (b.kind !== "drink" && b.kind !== "food") return { error: "ประเภทเมนูไม่ถูกต้อง" };
    row.kind = b.kind;
  }

  if ("toppings" in b) {
    if (!Array.isArray(b.toppings) || b.toppings.length > 20) return { error: "ท็อปปิ้งไม่ถูกต้อง" };
    const tops = [];
    for (const t of b.toppings as Row[]) {
      const label = text(t?.label, 40);
      const price = money(t?.price);
      if (!label) return { error: "กรุณาใส่ชื่อท็อปปิ้งให้ครบ" };
      if (price === undefined) return { error: `ราคาท็อปปิ้ง "${label}" ไม่ถูกต้อง` };
      const id = typeof t.id === "string" && /^[a-z0-9-]{1,40}$/.test(t.id) ? t.id : `t-${Math.random().toString(36).slice(2, 8)}`;
      tops.push({ id, label, price });
    }
    row.toppings = tops;
  }

  if ("sort" in b) {
    if (!Number.isInteger(b.sort)) return { error: "ลำดับไม่ถูกต้อง" };
    row.sort = b.sort;
  }

  if (!Object.keys(row).length) return { error: "ไม่มีข้อมูลที่จะบันทึก" };
  return { row };
}
