import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

type Period = "day" | "week" | "month";
const PAID = ["pending", "preparing", "ready", "completed"]; // ร้านยืนยันการจ่ายแล้ว
const COUNT: Record<Period, number> = { day: 14, week: 12, month: 12 };

// วันที่ของร้าน (YYYY-MM-DD) ↔ Date แบบ UTC เที่ยงคืน เพื่อคำนวณไม่เพี้ยนตาม timezone
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const toKey = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const monday = (d: Date) => addDays(d, -((d.getUTCDay() + 6) % 7));

const TH = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("th-TH", { timeZone: "UTC", ...o });

function buckets(period: Period, today: string) {
  const t = toDate(today);
  const out: { key: string; start: string; end: string; label: string; short: string }[] = [];
  for (let i = COUNT[period] - 1; i >= 0; i--) {
    if (period === "day") {
      const d = addDays(t, -i);
      out.push({ key: toKey(d), start: toKey(d), end: toKey(d), label: TH(d, { weekday: "short", day: "numeric", month: "short" }), short: TH(d, { day: "numeric", month: "short" }) });
    } else if (period === "week") {
      const s = addDays(monday(t), -7 * i);
      const e = addDays(s, 6);
      out.push({ key: toKey(s), start: toKey(s), end: toKey(e), label: `${TH(s, { day: "numeric", month: "short" })} – ${TH(e, { day: "numeric", month: "short" })}`, short: TH(s, { day: "numeric", month: "short" }) });
    } else {
      const s = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - i, 1));
      const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0));
      out.push({ key: toKey(s), start: toKey(s), end: toKey(e), label: TH(s, { month: "long", year: "numeric" }), short: TH(s, { month: "short", year: "2-digit" }) });
    }
  }
  return out;
}

type Row = {
  pickup_date: string;
  total: number;
  discount: number;
  promo_discount: number;
  cups: number;
  service: string;
  channel: string | null;
  pos_bills: { pay_method: string | null } | null;
  items: { name: string; qty: number; price: number }[];
};

// ดึงทุกแถว (Supabase คืนครั้งละไม่เกิน 1000)
async function fetchPaid(from: string, to: string) {
  const rows: Row[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await db()
      .from("orders")
      .select("pickup_date,total,discount,promo_discount,cups,service,channel,items,pos_bills(pay_method)")
      .gte("pickup_date", from)
      .lte("pickup_date", to)
      .in("status", PAID)
      .or("channel.eq.line,paid_at.not.is.null") // บิลหน้าร้านนับเมื่อเช็คบิลแล้ว
      .range(off, off + 999);
    if (error) throw error;
    rows.push(...(data as unknown as Row[]));
    if (data.length < 1000) return rows;
  }
}

type EventRow = { day: string; visitor: string; event: string; page: string };

// ผู้เข้าชมหน้าเว็บลูกค้า (ถ้ายังไม่ได้รัน migration-017 จะคืน null)
async function fetchEvents(from: string, to: string) {
  const rows: EventRow[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await db()
      .from("site_events")
      .select("day,visitor,event,page")
      .gte("day", from)
      .lte("day", to)
      .range(off, off + 999);
    if (error) return null;
    rows.push(...(data as EventRow[]));
    if (data.length < 1000) return rows;
  }
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = new URL(req.url).searchParams.get("period");
  const period: Period = p === "week" || p === "month" ? p : "day";
  const bs = buckets(period, nowInShop().date);
  const [rows, events, since] = await Promise.all([
    fetchPaid(bs[0].start, bs[bs.length - 1].end),
    fetchEvents(bs[0].start, bs[bs.length - 1].end),
    db().from("site_events").select("first_at").order("first_at").limit(1),
  ]);

  const series = bs.map((b) => ({ ...b, revenue: 0, orders: 0, cups: 0, discount: 0, visitors: 0 }));
  const top = new Map<string, { name: string; qty: number; revenue: number }>();
  const services: Record<string, { orders: number; revenue: number }> = {
    dine_in: { orders: 0, revenue: 0 },
    takeaway: { orders: 0, revenue: 0 },
    pickup: { orders: 0, revenue: 0 },
  };
  // ช่องทางขาย/วิธีรับเงิน: สั่งผ่าน LINE (โอน) · หน้าร้าน QR · หน้าร้านเงินสด (ใช้นับเงินในลิ้นชัก)
  const channels: Record<string, { orders: number; revenue: number }> = {
    line: { orders: 0, revenue: 0 },
    pos_qr: { orders: 0, revenue: 0 },
    pos_cash: { orders: 0, revenue: 0 },
  };

  for (const r of rows) {
    const b = series.find((s) => r.pickup_date >= s.start && r.pickup_date <= s.end);
    if (!b) continue;
    b.revenue += r.total;
    b.orders += 1;
    b.cups += r.cups;
    b.discount += (r.discount ?? 0) + (r.promo_discount ?? 0);
    const svc = services[r.service] ?? services.pickup;
    svc.orders += 1;
    svc.revenue += r.total;
    const ch = channels[r.channel === "pos" ? (r.pos_bills?.pay_method === "cash" ? "pos_cash" : "pos_qr") : "line"];
    ch.orders += 1;
    ch.revenue += r.total;
    for (const i of r.items ?? []) {
      const t = top.get(i.name) ?? { name: i.name, qty: 0, revenue: 0 };
      t.qty += i.qty;
      t.revenue += i.price;
      top.set(i.name, t);
    }
  }

  // นับคน (ไม่ซ้ำ) ต่อช่วงเวลา และจำนวนคนในแต่ละขั้น เข้าเว็บ → ดูเมนู → ใส่ตะกร้า → สั่ง
  let funnel: Record<string, number> | null = null;
  let memberVisitors = 0;
  if (events) {
    const per = series.map(() => new Set<string>());
    const steps: Record<string, Set<string>> = { visit: new Set(), view_item: new Set(), add_cart: new Set(), order: new Set() };
    const member = new Set<string>();
    for (const e of events) {
      steps[e.event]?.add(e.visitor);
      if (e.event !== "visit") continue;
      if (e.page === "member") member.add(e.visitor);
      const i = series.findIndex((s) => e.day >= s.start && e.day <= s.end);
      if (i >= 0) per[i].add(e.visitor);
    }
    per.forEach((set, i) => (series[i].visitors = set.size));
    funnel = Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, v.size]));
    memberVisitors = member.size;
  }

  return NextResponse.json({
    period,
    series: series.map(({ key, label, short, revenue, orders, cups, discount, visitors }) => ({ key, label, short, revenue, orders, cups, discount, visitors })),
    funnel,
    memberVisitors,
    trackingSince: since.data?.[0]?.first_at ?? null,
    top: [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 8),
    services,
    channels,
  });
}
