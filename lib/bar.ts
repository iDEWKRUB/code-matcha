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
