// รีวิวแบบไม่ระบุชื่อ (ใช้ร่วมกันทั้งหน้าเว็บและเซิร์ฟเวอร์)
export const MAX_REVIEW = 300;
// รีวิวได้เมื่อร้านทำเสร็จแล้ว และภายในกี่วันหลังสั่ง
export const REVIEW_STATUSES = ["ready", "completed"];
export const REVIEW_DAYS = 14;

export type PublicReview = { id: number; rating: number; comment: string; items: string; at: string };
export type ReviewSummary = { count: number; avg: number; dist: number[]; latest: PublicReview[] };
export type AdminReview = PublicReview & { orderNo: number; date: string; isPublic: boolean; hidden: boolean; source: "line" | "pos" };

export const RATING_LABEL = ["", "ต้องปรับปรุง", "พอใช้", "ดี", "ดีมาก", "ประทับใจมาก"];

// "3 วันก่อน" แบบสั้น
export function ago(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 60) return m <= 1 ? "เมื่อสักครู่" : `${m} นาทีก่อน`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ชั่วโมงก่อน`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} วันก่อน`;
  return `${Math.round(d / 30)} เดือนก่อน`;
}
