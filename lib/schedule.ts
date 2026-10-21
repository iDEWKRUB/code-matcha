// ตารางเปิด–ปิดร้านรายสัปดาห์ + วันหยุดพิเศษ (ใช้ร่วมกันทั้งหน้าเว็บและเซิร์ฟเวอร์)

export type DayHours = { closed: boolean; open: string; close: string };
export type ClosedDate = { date: string; note: string };

// ดัชนี 0 = อาทิตย์ … 6 = เสาร์ (ตาม getUTCDay)
export const DAY_NAMES = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];
export const DAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
// ลำดับแสดงในหน้าตั้งค่า เริ่มวันจันทร์
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isTime = (v: unknown): v is string =>
  typeof v === "string" && TIME.test(v);
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

export const weekdayOf = (date: string) =>
  new Date(`${date}T00:00:00Z`).getUTCDay();
export function addDay(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// อ่านค่าจากฐานข้อมูล: ไม่ถูกต้อง/ยังไม่ตั้ง = ทุกวันเปิดตามเวลาปกติ
export function parseWeekly(
  raw: unknown,
  open: string,
  close: string,
): DayHours[] {
  const all = (): DayHours[] =>
    Array.from({ length: 7 }, () => ({ closed: false, open, close }));
  if (!Array.isArray(raw) || raw.length !== 7) return all();
  return raw.map((d: unknown) => {
    const x = (d ?? {}) as Partial<DayHours>;
    const ok =
      isTime(x.open) && isTime(x.close) && mins(x.close) > mins(x.open);
    return {
      closed: x.closed === true,
      open: ok ? (x.open as string) : open,
      close: ok ? (x.close as string) : close,
    };
  });
}
export function parseClosedDates(raw: unknown): ClosedDate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d: unknown) => d as Partial<ClosedDate>)
    .filter(
      (d) => typeof d?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date),
    )
    .map((d) => ({
      date: d.date as string,
      note: typeof d.note === "string" ? d.note.slice(0, 60) : "",
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// เวลาของวันนั้น: ปิดเพราะอะไร (null = เปิด) + เวลาเปิด/ปิด
export function scheduleFor(
  weekly: DayHours[],
  closedDates: ClosedDate[],
  date: string,
) {
  const w = weekly[weekdayOf(date)];
  const special = closedDates.find((d) => d.date === date);
  const reason = special
    ? special.note
      ? `ร้านหยุด (${special.note})`
      : "ร้านหยุดพิเศษ"
    : w.closed
      ? `ร้านหยุดประจำสัปดาห์ (วัน${DAY_NAMES[weekdayOf(date)]})`
      : null;
  return { closed: reason !== null, reason, open: w.open, close: w.close };
}

// วันเปิดถัดไปนับจากหลังวันที่ระบุ (ไม่เกิน 14 วัน)
export function nextOpenAfter(
  weekly: DayHours[],
  closedDates: ClosedDate[],
  date: string,
) {
  for (let i = 1; i <= 14; i++) {
    const d = addDay(date, i);
    const s = scheduleFor(weekly, closedDates, d);
    if (!s.closed)
      return {
        date: d,
        dayName: DAY_NAMES[weekdayOf(d)],
        open: s.open,
        tomorrow: i === 1,
      };
  }
  return null;
}

// สรุปเวลาปกติสำหรับแสดงลูกค้า เช่น "ทุกวัน 09:00–20:00 · หยุดวันอังคาร"
export function scheduleSummary(weekly: DayHours[]) {
  const open = DAY_ORDER.filter((d) => !weekly[d].closed);
  const closed = DAY_ORDER.filter((d) => weekly[d].closed);
  const first = weekly[open[0] ?? 1];
  const same = open.every(
    (d) => weekly[d].open === first.open && weekly[d].close === first.close,
  );
  const hours = same
    ? `${first.open}–${first.close} น.`
    : "เวลาต่างกันแต่ละวัน";
  const head =
    closed.length <= 3
      ? "ทุกวัน"
      : `เปิด ${open.map((d) => DAY_SHORT[d]).join(" ")}`;
  return `${head} ${hours}${closed.length ? ` · หยุดวัน${closed.map((d) => DAY_NAMES[d]).join(" ")}` : ""}`;
}
