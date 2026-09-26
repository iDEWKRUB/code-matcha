// โค้ดส่วนลด: ใช้ร่วมกันทั้งหน้าเว็บและเซิร์ฟเวอร์

export type PromoRule = {
  code: string;
  kind: "percent" | "amount";
  value: number;
  maxDiscount: number | null;
  minSpend: number;
  newCustomersOnly: boolean;
  perUserLimit: number;
  maxUses: number | null;
  expiresOn: string | null; // YYYY-MM-DD
  active: boolean;
  note: string;
  used?: number; // จำนวนครั้งที่ใช้แล้ว (หน้าแอดมิน)
};

export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);

// ส่วนลดจากยอดรวม (ปัดลง ไม่เกินยอด)
export function promoDiscount(rule: Pick<PromoRule, "kind" | "value" | "maxDiscount" | "minSpend">, subtotal: number) {
  if (subtotal < rule.minSpend) return 0;
  let d = rule.kind === "percent" ? Math.floor((subtotal * rule.value) / 100) : rule.value;
  if (rule.maxDiscount !== null) d = Math.min(d, rule.maxDiscount);
  return Math.max(0, Math.min(d, subtotal));
}

export function promoLabel(r: Pick<PromoRule, "kind" | "value" | "maxDiscount" | "minSpend" | "newCustomersOnly">) {
  return [
    r.kind === "percent" ? `ลด ${r.value}%` : `ลด ฿${r.value}`,
    r.kind === "percent" && r.maxDiscount !== null && `สูงสุด ฿${r.maxDiscount}`,
    r.minSpend > 0 && `เมื่อซื้อครบ ฿${r.minSpend}`,
    r.newCustomersOnly && "เฉพาะลูกค้าใหม่",
  ]
    .filter(Boolean)
    .join(" · ");
}
