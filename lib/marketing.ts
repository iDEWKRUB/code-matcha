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

// หลักจิตวิทยาที่ใช้ในคอนเทนต์ (ชื่อสากล + คำอธิบายสั้น) · Social Proof / Scarcity ใช้ได้เฉพาะของจริงเท่านั้น
export const PSYCH: Record<string, string> = {
  "Curiosity Gap": "ชวนสงสัย อยากรู้ต่อ",
  Storytelling: "เล่าเรื่องจริงของร้าน",
  "Social Proof": "รีวิว/ภาพลูกค้าจริง (ห้ามแต่ง)",
  Reciprocity: "ให้คุณค่าก่อน เช่น ความรู้ ทิป",
  "Goal Gradient": "ใกล้เป้า อยากไปต่อ (แต้ม/รางวัล)",
  "Loss Aversion": "เสียดายถ้าพลาด (เงื่อนไขจริงเท่านั้น)",
  "Endowment Effect": "รู้สึกว่าเป็นของเราแล้ว",
  Anchoring: "เทียบราคา/ความคุ้ม",
  "Mere Exposure": "เห็นบ่อยแล้วคุ้นเคย",
  "Peak-End Rule": "ช่วงประทับใจที่สุด/ตอนจบ",
  Scarcity: "มีจำกัดจริง เช่น เวลาโปร",
  "Habit Loop": "ผูกกับกิจวัตร เช่น พักเที่ยง",
  Belonging: "รู้สึกเป็นส่วนหนึ่งของชุมชน",
  Novelty: "ของใหม่ เรื่องใหม่",
};
export const isPsych = (v: unknown): v is string => v === "" || (typeof v === "string" && v in PSYCH);

export type MkChannel = { id: string; name: string; short: string; color: string; enabled: boolean; sort: number; url: string };

// โดเมนของแต่ละช่องทาง (ใช้ตรวจว่าวางลิงก์ถูกช่อง) · ช่องที่ร้านเพิ่มเองไม่ตรวจ
const DOMAINS: Record<string, string[]> = {
  fb: ["facebook.com", "fb.com", "fb.watch", "fb.me"],
  ig: ["instagram.com", "instagr.am"],
  x: ["x.com", "twitter.com"],
  tiktok: ["tiktok.com"],
  line: ["line.me"],
  yt: ["youtube.com", "youtu.be"],
};
// ตรวจลิงก์: คืนข้อความผิดพลาด หรือ null ถ้าใช้ได้
export function linkProblem(url: string, channelId: string, channelName = "ช่องนี้") {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return "ลิงก์ไม่ถูกต้อง ลองคัดลอกลิงก์จากแอปอีกครั้ง";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "ลิงก์ต้องขึ้นต้นด้วย https://";
  const allow = DOMAINS[channelId];
  const host = u.hostname.replace(/^www\.|^m\.|^mobile\./, "");
  if (allow && !allow.some((d) => host === d || host.endsWith(`.${d}`))) return `ลิงก์นี้ไม่ใช่ของ ${channelName} วางผิดช่องหรือเปล่า`;
  return null;
}
export type MkPost = {
  post_date: string;
  slot: number;
  title: string;
  pillar: Pillar;
  format: string;
  caption: string; // แคปชันหลัก (ใช้กับทุกช่องที่ไม่ได้เขียนแยก)
  body: string; // เนื้อเรื่อง/คำอธิบาย
  psychology: string;
  visual: string; // ไอเดียภาพ/ช็อตที่ต้องถ่าย
  cta: string;
  hashtags: string; // แฮชแท็กเฉพาะโพสต์
  captions: Record<string, string>; // แคปชันแยกช่องทาง
  links: Record<string, string>; // ลิงก์โพสต์จริงของแต่ละช่อง
  status: Record<string, PostState>;
  done_at: Record<string, string>;
};
export const POST_COLUMNS = "post_date,slot,title,pillar,format,caption,body,psychology,visual,cta,hashtags,captions,links,status,done_at";

// แคปชันพร้อมโพสต์ของช่องหนึ่ง: แคปชันของช่อง (ว่าง = แคปชันหลัก) + แฮชแท็กเฉพาะโพสต์ + แฮชแท็กแบรนด์ (ไม่ซ้ำ)
export function composeCaption(p: Pick<MkPost, "caption" | "captions" | "hashtags">, channelId: string, brandTags: string) {
  const text = (p.captions?.[channelId] || p.caption || "").trim();
  const tags = [...new Set(`${p.hashtags} ${brandTags}`.split(/\s+/).filter((t) => t.startsWith("#")))];
  const missing = tags.filter((t) => !text.includes(t));
  return [text, missing.join(" ")].filter(Boolean).join("\n\n");
}
export type MkIdea = { id: number; title: string; pillar: Pillar; format: string };
export type MkData = {
  today: string;
  month: string; // YYYY-MM
  days: string[]; // ทุกวันของเดือน
  perDay: number;
  brandTags: string;
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
export const weekStartOf = (date: string) => addDays(date, -dowMon(date));

// เป้าหมาย + รางวัล
export type GoalPeriod = "week" | "month";
export type GoalMetric = "posts" | "days";
export type MkGoal = { id: number; period: GoalPeriod; metric: GoalMetric; target: number; reward: string; strict: boolean; active: boolean; sort: number };
export type MkGoalProgress = MkGoal & { value: number; achieved: boolean; claimed: boolean; key: string; from: string; to: string; daysLeft: number };
export type MkClaim = { id: number; goal_id: number; period_key: string; reward: string; value: number; claimed_at: string };
export const goalLabel = (g: Pick<MkGoal, "period" | "metric" | "target">) =>
  `${g.period === "week" ? "สัปดาห์นี้" : "เดือนนี้"} ${g.metric === "posts" ? `โพสต์ครบ ${g.target} เรื่อง` : `ลงครบทุกวัน ${g.target} วัน`}`;
export const doneCount = (p: Pick<MkPost, "status"> | undefined, channels: MkChannel[]) => channels.filter((c) => p?.status?.[c.id] === "done").length;
