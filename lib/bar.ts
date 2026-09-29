// มาม่าบาร์: ใช้ร่วมกันทั้งหน้าเว็บและเซิร์ฟเวอร์

export type BarKind = "noodle" | "topping" | "other";
export const BAR_KINDS: { id: BarKind; label: string }[] = [
  { id: "noodle", label: "เส้น / มาม่า" },
  { id: "topping", label: "ท็อปปิ้ง" },
  { id: "other", label: "อื่น ๆ" },
];

export type BarItem = {
  id: string;
  name: string;
  kind: BarKind;
  price: number;
  available: boolean;
  sort: number;
  imageUrl: string | null;
};

export type BarLine = { id: string; qty: number };

export const BAR_MAX_QTY = 20;

// ข้อความใน QR สติ๊กเกอร์ของแต่ละชิ้น
const QR_PREFIX = "CMB1:";
export const barQrText = (id: string) => `${QR_PREFIX}${id}`;
export const barIdFromQr = (text: string) => (text.startsWith(QR_PREFIX) ? text.slice(QR_PREFIX.length).trim() : null);

// ต้มกี่นาที (ปุ่มจับเวลาหน้าเสร็จ)
export const COOK_SECONDS = 180;

// เงื่อนไขที่ลูกค้าต้องติ๊กก่อนชำระ (แก้ข้อความ = เปลี่ยน TERMS_VERSION ด้วย จะได้รู้ว่าบิลเก่ายอมรับฉบับไหน)
export const TERMS_VERSION = 1;
export const TERMS = [
  "ยืนยันว่ารายการครบถ้วนตามที่หยิบมา",
  "ยอมรับว่า หากร้านตรวจพบว่าจำนวนจริงในถาดไม่ตรงกับรายการ ร้านสามารถเรียกเก็บเงินย้อนหลังตามจำนวนจริงได้",
];

// เก็บรูปถาดไว้เป็นหลักฐานกี่วัน
export const TRAY_KEEP_DAYS = 90;

// ผลสแกนที่เก็บคู่กับบิล: ระบบอ่านได้เท่าไร ลูกค้านับได้เท่าไร และรายการสุดท้ายที่จ่าย
export type BarScan = {
  detected: Record<string, number>;
  unknown: number;
  declared: number;
  final: Record<string, number>;
};

export type BarFlag = { level: "warn" | "info"; text: string };

// ป้ายเตือนให้ร้านตรวจบิล: ลดจำนวนเอง / นับไม่ตรง = น่าสงสัย, เพิ่มเอง / QR ไม่รู้จัก = แค่แจ้ง
export function barFlags(s: BarScan | null, names: (id: string) => string = (id) => id): BarFlag[] {
  if (!s) return [];
  const flags: BarFlag[] = [];
  const ids = new Set([...Object.keys(s.detected), ...Object.keys(s.final)]);
  const fewer: string[] = [];
  const more: string[] = [];
  for (const id of ids) {
    const d = s.detected[id] ?? 0;
    const f = s.final[id] ?? 0;
    if (f < d) fewer.push(`${names(id)} ${d}→${f}`);
    if (f > d) more.push(`${names(id)} ${d}→${f}`);
  }
  const total = Object.values(s.final).reduce((n, q) => n + q, 0);
  if (fewer.length) flags.push({ level: "warn", text: `ลดจำนวนเอง: ${fewer.join(", ")}` });
  if (s.declared !== total) flags.push({ level: "warn", text: `ลูกค้านับได้ ${s.declared} ชิ้น แต่จ่าย ${total} ชิ้น` });
  if (more.length) flags.push({ level: "info", text: `เพิ่มเอง: ${more.join(", ")}` });
  if (s.unknown > 0) flags.push({ level: "info", text: `มี QR ที่ไม่รู้จัก ${s.unknown} อัน` });
  return flags;
}
