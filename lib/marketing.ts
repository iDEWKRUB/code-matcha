// หน้าการตลาด: ชนิดข้อมูลและค่าคงที่ใช้ร่วมกันทั้งหน้าเว็บและเซิร์ฟเวอร์

export const PILLARS = {
  menu: "เมนู",
  promo: "โปรโมชั่น",
  behind: "หลังร้าน",
  know: "ความรู้มัทฉะ",
  cust: "ลูกค้า",
} as const;
export type Pillar = keyof typeof PILLARS;
export const isPillar = (v: unknown): v is Pillar => typeof v === "string" && v in PILLARS;

export type PostState = "todo" | "sched" | "done";
export const isState = (v: unknown): v is PostState => v === "todo" || v === "sched" || v === "done";
export const STATE_LABEL: Record<PostState, string> = { todo: "ยังไม่ลง", sched: "ตั้งเวลาแล้ว", done: "ลงแล้ว" };
export const NEXT_STATE: Record<PostState, PostState> = { todo: "sched", sched: "done", done: "todo" };

export type MkChannel = { id: string; name: string; short: string; color: string; enabled: boolean; sort: number };
export type MkPost = {
  post_date: string;
  slot: number;
  title: string;
  pillar: Pillar;
  format: string;
  caption: string;
  status: Record<string, PostState>;
  done_at: Record<string, string>;
};
export type MkIdea = { id: number; title: string; pillar: Pillar; format: string };
export type MkData = {
  today: string;
  month: string; // YYYY-MM
  days: string[]; // ทุกวันของเดือน
  perDay: number;
  channels: MkChannel[];
  posts: MkPost[];
  ideas: MkIdea[];
};

// วันที่ YYYY-MM-DD ± n วัน (คำนวณแบบ UTC ไม่ขึ้นกับ timezone เครื่อง)
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// ทุกวันของเดือน YYYY-MM
export function monthDays(month: string) {
  const out: string[] = [];
  for (let d = `${month}-01`; d.slice(0, 7) === month; d = addDays(d, 1)) out.push(d);
  return out;
}
// เดือนถัดไป/ก่อนหน้า (n = ±1)
export function shiftMonth(month: string, n: number) {
  const d = new Date(`${month}-15T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}
// 0 = จันทร์ … 6 = อาทิตย์
export const dowMon = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
export const doneCount = (p: Pick<MkPost, "status"> | undefined, channels: MkChannel[]) => channels.filter((c) => p?.status?.[c.id] === "done").length;
