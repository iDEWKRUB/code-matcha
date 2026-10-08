// ใช้ร่วมกันทั้งฝั่งหน้าเว็บและเซิร์ฟเวอร์

export type Temp = "iced" | "hot";
export type Kind = "drink" | "food";
// ตัวเลือกอาหาร: มี group = เลือกได้ 1 อย่างในกลุ่ม (อันแรกเป็นค่าเริ่มต้น), ไม่มี group = ท็อปปิ้งเลือกได้หลายอย่าง
export type Topping = { id: string; label: string; price: number; group?: string };

export function optionGroups(item: { toppings: Topping[] }) {
  const groups = new Map<string, Topping[]>();
  for (const t of item.toppings) if (t.group) groups.set(t.group, [...(groups.get(t.group) ?? []), t]);
  return [...groups.entries()].map(([name, options]) => ({ name, options }));
}
export const freeToppings = (item: { toppings: Topping[] }) => item.toppings.filter((t) => !t.group);
// ค่าเริ่มต้นของแต่ละกลุ่ม
export const defaultChoices = (item: { toppings: Topping[] }) => optionGroups(item).map((g) => g.options[0].id);

export type MenuItem = {
  kind: Kind;
  toppings: Topping[]; // ท็อปปิ้งที่เลือกได้ (ใช้กับอาหาร)
  id: string;
  name: string;
  jp: string;
  description: string;
  price: number;
  temps: Temp[];
  milk: boolean;
  available: boolean;
  promoPrice: number | null; // ราคาโปร (null = ไม่มีโปร)
  recommended: boolean;
  look: string | null; // หน้าตาแก้วการ์ตูน (id ของสูตรใน Cup) null = ใช้ id เมนู
  photoUrl?: string | null; // รูปเครื่องดื่มจริง (การ์ดพลิกจากการ์ตูนเป็นรูปนี้) null = ไม่มีปุ่มพลิก
  sort: number;
  grams: number | null; // กรัมผงมัทฉะที่ใช้ (null = ไม่ให้เลือกผง)
  addons: boolean; // มีท็อปปิ้งให้เลือก (ช็อตมัทฉะ / ซอฟต์ครีม)
  sweetChoice?: boolean; // มีความหวานให้เลือก (false = ทำไม่หวานเสมอ เช่น เพียวมัทฉะ)
  hidden: boolean; // ซ่อนจากหน้าลูกค้า (ยังอยู่ในหลังร้าน)
};

export type ShopSettings = {
  banner: string;
  bannerActive: boolean;
  notice: string; // ประกาศสำคัญ (เช่น วันนี้ร้านหยุด)
  noticeActive: boolean;
  noticeUntil: string | null; // หายเองหลังเวลานี้ · null = จนกว่าจะปิดเอง
  openTime: string; // รอบรับแรก HH:MM
  closeTime: string; // รอบสุดท้ายต้องก่อนเวลานี้
  slotMinutes: number;
  slotCapacity: number; // แก้วสูงสุดต่อรอบ
  accepting: boolean; // สวิตช์เปิด/ปิดรับออเดอร์
  orderNoStart: number; // เลขออเดอร์แรกของแต่ละวัน
};

// แบบหน้าตาแก้วการ์ตูนที่เลือกให้เมนูใหม่ได้ (ต้องตรงกับสูตรใน app/Cup.tsx)
export const LOOKS = [
  { id: "usucha", label: "เขียวทั้งแก้ว (มัทฉะเพียว)" },
  { id: "matcha-latte", label: "ชั้นนม + มัทฉะ (ลาเต้)" },
  { id: "ceremonial-latte", label: "ชั้นนม + มัทฉะเข้ม" },
  { id: "cold-whisk-latte", label: "เขียวอมเหลือง + ฟอง" },
  { id: "hojicha-latte", label: "ชั้นนม + โฮจิฉะ (น้ำตาล)" },
  { id: "strawberry-matcha", label: "สตรอว์เบอร์รี่ 3 ชั้น" },
  { id: "coconut-matcha", label: "น้ำมะพร้าว + มัทฉะ" },
  { id: "yuzu-sparkling", label: "โซดายูซุ + มัทฉะ" },
  { id: "yuzu-soda", label: "ยูซุโซดา (ไม่มีมัทฉะ)" },
  { id: "strawberry-soda", label: "สตรอว์เบอร์รี่โซดา" },
  { id: "lychee-soda", label: "ลิ้นจี่โซดา" },
  { id: "mango-soda", label: "มะม่วงโซดา" },
  { id: "passion-soda", label: "เสาวรสโซดา" },
  { id: "kiwi-soda", label: "กีวีโซดา" },
  { id: "cocoa", label: "โกโก้ (ชั้นนม + โกโก้)" },
];
export const FOOD_LOOKS = [
  { id: "omelette-rice", label: "ข้าวไข่เจียวบนจาน" },
  { id: "fries", label: "เฟรนช์ฟรายส์ในกล่อง" },
];
export const LOOK_IDS = [...LOOKS, ...FOOD_LOOKS].map((l) => l.id);
export const lookOf = (item: Pick<MenuItem, "id" | "look">) => item.look ?? item.id;

// หมวดในหน้าสั่ง: เมนูที่ใช้แก้วโซดาผลไม้ (look ลงท้าย -soda) อยู่หมวด "เครื่องดื่มโซดา" ให้อัตโนมัติ
export type MenuGroup = "drink" | "soda" | "food";
export const MENU_GROUPS: { id: MenuGroup; label: string }[] = [
  { id: "drink", label: "เครื่องดื่มมัทฉะ" },
  { id: "soda", label: "เครื่องดื่มโซดา" },
  { id: "food", label: "อาหาร" },
];
export const menuGroup = (item: Pick<MenuItem, "id" | "look" | "kind">): MenuGroup =>
  item.kind === "food" ? "food" : lookOf(item).endsWith("-soda") ? "soda" : "drink";

export const basePrice = (item: MenuItem) => item.promoPrice ?? item.price;

export type CartLine = {
  itemId: string;
  temp: Temp;
  sweet: number;
  milk: string | null;
  powder: string | null;
  extraShot: boolean;
  softCream: boolean;
  iceSep?: boolean; // แยกน้ำแข็ง (เฉพาะเย็น)
  toppings: string[]; // id ท็อปปิ้ง (อาหาร)
  qty: number;
};

export type OrderItem = { name: string; qty: number; detail: string; price: number };

export type OrderStatus =
  | "awaiting_payment"
  | "payment_review"
  | "pending"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

// วิธีรับ: pickup = สั่งล่วงหน้ามารับตามรอบ, dine_in / takeaway = ลูกค้าอยู่ที่ร้านแล้ว ทำให้เลย
export type Service = "pickup" | "dine_in" | "takeaway";
export const SERVICE_LABEL: Record<Service, string> = { pickup: "สั่งล่วงหน้า", dine_in: "ทานที่ร้าน", takeaway: "รับกลับบ้าน" };

// ข้อความบอกว่ารับเมื่อไร/ที่ไหน ใช้ทั้งหน้าเว็บและข้อความ LINE
export function whenText(o: { service?: Service; pickupTime: string; tableNo?: string }) {
  if (o.service === "dine_in") return `ทานที่ร้าน${o.tableNo ? ` · โต๊ะ ${o.tableNo}` : ""} (ทำให้เลย)`;
  if (o.service === "takeaway") return "รับกลับบ้าน · รอที่ร้าน (ทำให้เลย)";
  return `มารับ ${o.pickupTime} น.`;
}

export type Order = {
  id: number;
  service: Service;
  tableNo: string;
  promoCode: string | null;
  promoDiscount: number;
  no: number;
  pickupDate: string;
  pickupTime: string;
  customerName: string;
  items: OrderItem[];
  total: number;
  cups: number;
  note: string;
  status: OrderStatus;
  createdAt: string;
  hasSlip: boolean;
  discount: number; // ส่วนลดจากแต้ม (total คือยอดที่จ่ายจริงหลังหักแล้ว)
  source: "menu" | "bar"; // bar = มาม่าบาร์ (ลูกค้าต้มเอง)
  channel: "line" | "pos"; // pos = พนักงานคิดเงินหน้าร้าน
  unpaid: boolean; // บิลหน้าร้านที่ยังไม่เช็คบิล (ทำเครื่องดื่มไปก่อน จ่ายตอนออก)
  cupFor: string; // โน้ตจากลูกค้าว่าให้ติดข้อความที่แก้วไหน
  hasCupMsg: boolean; // มีข้อความบนแก้ว (เข้ารหัส ร้านไม่เห็นเนื้อหา) → พิมพ์สติ๊กเกอร์ QR ให้ออเดอร์นี้
};

// ข้อมูลสำหรับหน้าจ่ายเงินของลูกค้า
export type Payment = {
  id: number;
  service: Service;
  tableNo: string;
  promoCode: string | null;
  promoDiscount: number;
  no: number;
  total: number;
  discount: number;
  pickupTime: string;
  expiresAt: string;
  qr: string;
};

export type Slot = { time: string; remaining: number };

export const MILKS = [
  { id: "fresh", label: "นมสด", price: 0 },
  { id: "oat", label: "นมโอ๊ต", price: 15 },
  { id: "almond", label: "นมอัลมอนด์", price: 15 },
];
// ผงมัทฉะให้ลูกค้าเลือก (ร้านตั้งในหลังบ้าน) ราคาบวก = บาทต่อกรัม × กรัมที่เมนูใช้
export type Powder = {
  id: string;
  name: string;
  note: string;
  extraPerGram: number;
  costItemId: number | null;
  active: boolean;
  sort: number;
  ownImage: string | null; // รูปที่อัปโหลดให้ผงนี้โดยตรง
  imageUrl: string | null; // รูปที่แสดง (ของผงเอง หรือของวัตถุดิบที่ผูกไว้)
};
export const hasPowder = (item: Pick<MenuItem, "kind" | "grams">) => item.kind !== "food" && !!item.grams && item.grams > 0;
// ปัดเป็นหลัก 5 บาท (เช่น 13.33 × 3 กรัม = 40)
export const powderExtra = (item: Pick<MenuItem, "grams">, p: Pick<Powder, "extraPerGram">) =>
  Math.round(((p.extraPerGram * (item.grams ?? 0)) / 5) + 1e-9) * 5;

export const SWEET = [0, 25, 50, 75, 100];
export const SHOT_PRICE = 20;
export const SOFT_CREAM_PRICE = 15;
export const MAX_QTY = 10;
export const TEMP_LABEL: Record<Temp, string> = { iced: "เย็น", hot: "ร้อน" };

export function linePrice(item: MenuItem, l: CartLine, powders: Powder[]) {
  if (item.kind === "food") {
    const tops = l.toppings.reduce((n, id) => n + (item.toppings.find((t) => t.id === id)?.price ?? 0), 0);
    return (basePrice(item) + tops) * l.qty;
  }
  const milk = item.milk ? MILKS.find((m) => m.id === l.milk)?.price ?? 0 : 0;
  const chosen = hasPowder(item) ? powders.find((p) => p.id === l.powder) : undefined;
  const powder = chosen ? powderExtra(item, chosen) : 0;
  const addons = item.addons ? (l.extraShot ? SHOT_PRICE : 0) + (l.softCream ? SOFT_CREAM_PRICE : 0) : 0;
  return (basePrice(item) + milk + powder + addons) * l.qty;
}

export function lineDetail(item: MenuItem, l: CartLine, powders: Powder[]) {
  if (item.kind === "food") {
    const chosen = l.toppings.map((id) => item.toppings.find((t) => t.id === id)).filter((t): t is Topping => !!t);
    const choices = chosen.filter((t) => t.group).map((t) => t.label);
    const tops = chosen.filter((t) => !t.group).map((t) => t.label);
    const hasFree = freeToppings(item).length > 0;
    return [...choices, hasFree ? (tops.length ? `ท็อปปิ้ง: ${tops.join(", ")}` : "ไม่ใส่ท็อปปิ้ง") : ""]
      .filter(Boolean)
      .join(", ");
  }
  return [
    TEMP_LABEL[l.temp],
    l.temp === "iced" && l.iceSep && "แยกน้ำแข็ง",
    item.sweetChoice !== false && (l.sweet === 0 ? "ไม่หวาน" : `หวาน ${l.sweet}%`),
    l.milk && MILKS.find((m) => m.id === l.milk)?.label,
    l.powder && hasPowder(item) && powders.find((p) => p.id === l.powder)?.name,
    item.addons && l.extraShot && "+ช็อตมัทฉะ",
    item.addons && l.softCream && "+ท็อปซอฟต์ครีม",
  ]
    .filter(Boolean)
    .join(", ");
}

// ประกาศสำคัญที่ยังมีผลตอนนี้ (เปิดอยู่ ยังไม่เลยเวลาที่ตั้ง และมีข้อความ) · ไม่มี = ""
export const activeNotice = (s: Pick<ShopSettings, "notice" | "noticeActive" | "noticeUntil">, now = Date.now()) =>
  s.noticeActive && s.notice.trim() && (!s.noticeUntil || new Date(s.noticeUntil).getTime() > now) ? s.notice.trim() : "";
