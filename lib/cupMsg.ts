// ข้อความบนแก้ว (ลูกค้าเขียนตอนสั่ง → ร้านพิมพ์สติ๊กเกอร์ QR → คนได้แก้วสแกนอ่าน)
export const MAX_CUP_MSG = 120;
export const MAX_CUP_NAME = 20;
// เปิดอ่านได้กี่วันหลังสั่ง
export const CUP_MSG_DAYS = 60;

// ชื่อ: บรรทัดเดียว · ข้อความ: ขึ้นบรรทัดใหม่ได้ (บรรทัดว่างติดกันไม่เกิน 1)
function clean(v: unknown, max: number, lines = false) {
  if (typeof v !== "string") return "";
  const s = lines
    ? v.replace(/\r/g, "").replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n")
    : v.replace(/\s+/g, " ");
  return s.trim().slice(0, max);
}

export function cleanCupMsg(raw: { cupMsg?: unknown; cupTo?: unknown; cupFrom?: unknown }) {
  const msg = clean(raw.cupMsg, MAX_CUP_MSG, true);
  if (!msg) return null;
  return { msg, to: clean(raw.cupTo, MAX_CUP_NAME), from: clean(raw.cupFrom, MAX_CUP_NAME) };
}
