// นำเข้าต้นทุนจากระบบ POS เดิม (ครั้งเดียว) → cost_items, menu_cost_lines, gp_platforms
// ใช้: node --env-file=.env.local scripts/import-pos-costs.mjs   (ต้องรัน migration-013 ก่อน)
// ถ้ามีข้อมูลในคลังแล้วจะไม่ทำซ้ำ

const S = process.env.SUPABASE_URL + "/rest/v1/";
const H = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
const rest = async (path, init = {}) => {
  const r = await fetch(S + path, { headers: H, ...init });
  const t = await r.text();
  if (!r.ok) throw new Error(`${path}: ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
};

// คลังต้นทุน (จาก POS: cost_templates + รายการที่ใส่เองในสูตร) — ผงมัทฉะคิดจากราคาแพ็กในชื่อ
const ITEMS = [
  { name: "ผงมัทฉะ Matcha Rounting 650/30g", category: "ingredient", unit: "กรัม", pack_price: 650, pack_size: 30 },
  { name: "ผงมัทฉะ MINI MATCHA Pride 495/40g", category: "ingredient", unit: "กรัม", pack_price: 495, pack_size: 40 },
  { name: "ผงมัทฉะ FELL BOY 2590/100g", category: "ingredient", unit: "กรัม", pack_price: 2590, pack_size: 100 },
  { name: "ผงมัทฉะ TRIAL MATCHA 489/30g", category: "ingredient", unit: "กรัม", pack_price: 489, pack_size: 30 },
  { name: "ไซรัป", category: "ingredient", unit: "กรัม", unit_cost: 0.5 },
  { name: "น้ำแข็ง (น้ำแร่)", category: "ingredient", unit: "แก้ว", unit_cost: 2 },
  { name: "น้ำมะพร้าวสด", category: "ingredient", unit: "ถุง", unit_cost: 15 },
  { name: "ไข่ไก่เบอร์ 0", category: "ingredient", unit: "ฟอง", unit_cost: 6 },
  { name: "ค่าน้ำมันพืช", category: "ingredient", unit: "จาน", unit_cost: 1 },
  { name: "แก้ว 12 oz", category: "packaging", unit: "ใบ", unit_cost: 2 },
  { name: "ฝาแก้วแบบพร้อมดื่ม 92 mm", category: "packaging", unit: "ชิ้น", unit_cost: 1 },
  { name: "ถุงกระดาษหิ้วมีหูจับ", category: "packaging", unit: "ใบ", unit_cost: 1.5 },
  { name: "สติ๊กเกอร์ขอบคุณ", category: "packaging", unit: "ชิ้น", unit_cost: 1.5 },
  { name: "กล่องใส่อาหาร", category: "packaging", unit: "ชิ้น", unit_cost: 4 },
  { name: "ค่าแรงต่อแก้ว", category: "labor", unit: "แก้ว", unit_cost: 20 },
  { name: "ค่าแรงทอดไข่", category: "labor", unit: "จาน", unit_cost: 15 },
  { name: "รวมค่าน้ำ + ค่าไฟ", category: "utility", unit: "แก้ว", unit_cost: 5 },
];

const DRINK_BASE = [
  ["แก้ว 12 oz", 1],
  ["ฝาแก้วแบบพร้อมดื่ม 92 mm", 1],
  ["ถุงกระดาษหิ้วมีหูจับ", 1],
  ["สติ๊กเกอร์ขอบคุณ", 1],
  ["น้ำแข็ง (น้ำแร่)", 1],
  ["ไซรัป", 1],
  ["ค่าแรงต่อแก้ว", 1],
  ["รวมค่าน้ำ + ค่าไฟ", 1],
];
const PRIDE = "ผงมัทฉะ MINI MATCHA Pride 495/40g";
const ROUNTING = "ผงมัทฉะ Matcha Rounting 650/30g";

// เมนู CODE-MACHA ← สูตรจาก POS (เกรดพรีเมียม = ผง MINI MATCHA Pride, เซเรโมเนียล = Matcha Rounting)
const RECIPES = {
  usucha: [[PRIDE, 3], ...DRINK_BASE.filter(([n]) => n !== "ไซรัป")], // POS: เพียวมัทฉะ (เกรดพรีเมียม) ไม่มีไซรัป
  "matcha-latte": [[PRIDE, 5], ...DRINK_BASE], // POS: มัทฉะลาเต้ (เกรดพรีเมียม)
  "cold-whisk-latte": [[PRIDE, 5], ...DRINK_BASE], // POS: Cole whisk Latte (เกรดพรีเมียม)
  "coconut-matcha": [[PRIDE, 5], ["น้ำมะพร้าวสด", 1], ...DRINK_BASE], // POS: มัทฉะน้ำมะพร้าว (เกรดพรีเมียม)
  "ceremonial-latte": [[ROUNTING, 4], ...DRINK_BASE], // POS: มัทฉะลาเต้ (เกรดพิธีการ)
  "omelette-rice": [
    ["ไข่ไก่เบอร์ 0", 1],
    ["ค่าน้ำมันพืช", 1],
    ["กล่องใส่อาหาร", 1],
    ["ค่าแรงทอดไข่", 1],
  ], // POS: ข้าวไข่เจียวธรรมดา
};

const PLATFORMS = [
  { name: "Grab", gp_percent: 30, sort: 1 },
  { name: "LINE MAN", gp_percent: 30, sort: 2 },
  { name: "ShopeeFood", gp_percent: 30, sort: 3 },
];

const existing = await rest("cost_items?select=id&limit=1");
if (existing.length) {
  console.log("มีข้อมูลในคลังแล้ว ไม่นำเข้าซ้ำ");
  process.exit(0);
}

const rows = ITEMS.map((it, i) => ({
  name: it.name,
  category: it.category,
  unit: it.unit,
  unit_cost: it.pack_price ? Math.round((it.pack_price / it.pack_size) * 10000) / 10000 : it.unit_cost,
  pack_price: it.pack_price ?? null,
  pack_size: it.pack_size ?? null,
  sort: i,
}));
const inserted = await rest("cost_items", { method: "POST", body: JSON.stringify(rows) });
const byName = new Map(inserted.map((r) => [r.name, r]));
console.log("คลังต้นทุน:", inserted.length, "รายการ");

const menu = new Set((await rest("menu_items?select=id")).map((m) => m.id));
const lines = [];
for (const [menuId, recipe] of Object.entries(RECIPES)) {
  if (!menu.has(menuId)) {
    console.log("ข้ามเมนูที่ไม่มี:", menuId);
    continue;
  }
  recipe.forEach(([name, qty], i) => {
    const c = byName.get(name);
    lines.push({ menu_item_id: menuId, cost_item_id: c.id, name: c.name, category: c.category, unit: c.unit, unit_cost: c.unit_cost, qty, sort: i });
  });
}
await rest("menu_cost_lines", { method: "POST", body: JSON.stringify(lines) });
console.log("สูตรต้นทุน:", Object.keys(RECIPES).filter((k) => menu.has(k)).length, "เมนู,", lines.length, "บรรทัด");

if (!(await rest("gp_platforms?select=id&limit=1")).length) {
  await rest("gp_platforms", { method: "POST", body: JSON.stringify(PLATFORMS) });
  console.log("แพลตฟอร์ม:", PLATFORMS.map((p) => p.name).join(", "));
}
