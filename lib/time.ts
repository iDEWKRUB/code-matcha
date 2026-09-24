import { SHOP } from "./config";

// วันที่และนาทีของวัน ตามเวลาร้าน (ไม่ขึ้นกับ timezone ของเซิร์ฟเวอร์)
export function nowInShop() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: SHOP.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function slotTimes() {
  const out: string[] = [];
  for (let m = toMinutes(SHOP.open); m < toMinutes(SHOP.close); m += SHOP.slotMinutes) out.push(hhmm(m));
  return out;
}

export function isBookable(time: string, nowMinutes: number) {
  return slotTimes().includes(time) && toMinutes(time) >= nowMinutes + SHOP.leadMinutes;
}
