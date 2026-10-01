// คำอวยพรหน้า /gift (สติ๊กเกอร์ติดแก้ว): ใช้ร่วมกันทั้งหลังร้านและเซิร์ฟเวอร์
// mood เปลี่ยนหน้าตาน้องมัทฉะ · {name} = ชื่อเล่นที่ลูกค้าใส่ · {name|เธอ} = ไม่ใส่ชื่อให้ใช้คำว่า "เธอ"

export type Mood = "love" | "miss" | "day" | "cheer" | "hug";
export type Blessing = { mood: Mood; text: string };

export const MOODS: { id: Mood; label: string }[] = [
  { id: "day", label: "วันดี ๆ (ตายิ้ม · พระอาทิตย์)" },
  { id: "cheer", label: "สู้ ๆ (ดาว · คอนเฟตตี)" },
  { id: "hug", label: "กอด (หัวใจลอย)" },
  { id: "love", label: "รัก (ตาหัวใจ)" },
  { id: "miss", label: "ซึ้ง (ตาเป็นประกาย · จดหมาย)" },
];

export const MAX_BLESSINGS = 100;
export const MAX_BLESSING_LEN = 120;

export const DEFAULT_BLESSINGS: Blessing[] = [
  { mood: "day", text: "ขอให้วันนี้เป็นวันที่ดีนะ {name}" },
  { mood: "hug", text: "หากวันนี้เจอเรื่องแย่ ขอให้{name|เธอ}ผ่านไปได้ด้วยดีนะ" },
  { mood: "cheer", text: "เป็นกำลังใจให้นะ {name}" },
  { mood: "hug", text: "วันนี้หนักมั้ย เป็นกำลังใจให้นะ {name}" },
  { mood: "day", text: "ขอให้วันนี้เป็นวันที่ดีนะ {name} และถ้ามันไม่ดี ก็ไม่เป็นไรเลย" },
  { mood: "hug", text: "เหนื่อยมาทั้งวันแล้ว ตอนนี้พักก่อนนะ {name}" },
  { mood: "cheer", text: "ไม่ต้องเก่งทุกวันก็ได้ แค่ยังอยู่ตรงนี้ ก็เก่งมากแล้ว" },
  { mood: "hug", text: "วันที่ไม่มีใครเห็น ยังมีคนเห็นความพยายามของ{name|เธอ}อยู่นะ" },
  { mood: "love", text: "{name|เธอ}ไม่ได้อยู่คนเดียวนะ" },
  { mood: "day", text: "วันแย่ ๆ จะผ่านไป แต่{name|เธอ}จะยังอยู่ และเข้มแข็งกว่าเดิม" },
  { mood: "miss", text: "ร้องไห้ได้นะ มันไม่ได้แปลว่าอ่อนแอเลย" },
  { mood: "cheer", text: "ภูมิใจใน{name|เธอ}มากนะ ที่ผ่านมาได้จนถึงวันนี้" },
  { mood: "love", text: "โลกนี้ดีขึ้นนิดนึง เพราะมี{name|เธอ}อยู่" },
  { mood: "day", text: "ขอให้วันนี้มีเรื่องเล็ก ๆ ที่ทำให้{name|เธอ}ยิ้มได้" },
  { mood: "hug", text: "ถ้าวันนี้มันหนักเกินไป วางลงก่อนก็ได้นะ พรุ่งนี้ค่อยว่ากัน" },
  { mood: "cheer", text: "ช้าไม่เป็นไร ขอแค่อย่าเพิ่งยอมแพ้นะ {name}" },
  { mood: "love", text: "{name|เธอ}ใจดีกับทุกคนมาตลอด วันนี้ใจดีกับตัวเองบ้างนะ" },
  { mood: "miss", text: "เหนื่อยเมื่อไหร่ กลับมาตรงนี้ได้เสมอนะ" },
  { mood: "cheer", text: "ทุกอย่างที่{name|เธอ}พยายามมา ไม่เคยสูญเปล่าเลยนะ" },
  { mood: "hug", text: "กอดตัวเองแน่น ๆ สักทีนะ ฝากกอดจากตรงนี้ไปด้วย" },
  { mood: "miss", text: "ขอบคุณที่ยังสู้มาจนถึงวันนี้นะ {name}" },
  { mood: "love", text: "{name|เธอ}มีค่ามากกว่าที่ตัวเองคิดเยอะเลยนะ" },
];

// ตรวจข้อมูลจากหลังร้าน: คืนรายการที่ใช้ได้ หรือข้อความ error
export function cleanBlessings(raw: unknown): Blessing[] | string {
  if (!Array.isArray(raw)) return "ข้อมูลไม่ถูกต้อง";
  const out: Blessing[] = [];
  for (const r of raw) {
    const text = String((r as Blessing)?.text ?? "").replace(/\s+/g, " ").trim();
    const mood = (r as Blessing)?.mood;
    if (!text) continue;
    if (text.length > MAX_BLESSING_LEN) return `คำอวยพรยาวเกิน ${MAX_BLESSING_LEN} ตัวอักษร: "${text.slice(0, 20)}…"`;
    out.push({ mood: MOODS.some((m) => m.id === mood) ? mood : "love", text });
  }
  if (!out.length) return "ต้องมีคำอวยพรอย่างน้อย 1 ข้อความ";
  if (out.length > MAX_BLESSINGS) return `ใส่ได้ไม่เกิน ${MAX_BLESSINGS} ข้อความ`;
  return out;
}
