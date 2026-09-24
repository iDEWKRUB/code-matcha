// ใช้ร่วมกันทั้งฝั่งหน้าเว็บและเซิร์ฟเวอร์

export type Temp = "iced" | "hot";

export type MenuItem = {
  id: string;
  name: string;
  jp: string;
  description: string;
  price: number;
  temps: Temp[];
  milk: boolean;
  available: boolean;
};

export type CartLine = {
  itemId: string;
  temp: Temp;
  sweet: number;
  milk: string | null;
  extraShot: boolean;
  qty: number;
};

export type OrderItem = { name: string; qty: number; detail: string; price: number };

export type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

export type Order = {
  id: number;
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
};

export type Slot = { time: string; remaining: number };

export const MILKS = [
  { id: "fresh", label: "นมสด", price: 0 },
  { id: "oat", label: "นมโอ๊ต", price: 15 },
  { id: "almond", label: "นมอัลมอนด์", price: 15 },
];
export const SWEET = [0, 25, 50, 75, 100];
export const SHOT_PRICE = 20;
export const MAX_QTY = 10;
export const TEMP_LABEL: Record<Temp, string> = { iced: "เย็น", hot: "ร้อน" };

export function linePrice(item: MenuItem, l: CartLine) {
  const milk = item.milk ? MILKS.find((m) => m.id === l.milk)?.price ?? 0 : 0;
  return (item.price + milk + (l.extraShot ? SHOT_PRICE : 0)) * l.qty;
}

export function lineDetail(l: CartLine) {
  return [
    TEMP_LABEL[l.temp],
    l.sweet === 0 ? "ไม่หวาน" : `หวาน ${l.sweet}%`,
    l.milk && MILKS.find((m) => m.id === l.milk)?.label,
    l.extraShot && "+ช็อตมัทฉะ",
  ]
    .filter(Boolean)
    .join(", ");
}
