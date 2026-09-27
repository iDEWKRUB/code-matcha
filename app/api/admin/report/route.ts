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
  items: { name: string; qty: number; price: number }[];
};

// ดึงทุกแถว (Supabase คืนครั้งละไม่เกิน 1000)
async function fetchPaid(from: string, to: string) {
  const rows: Row[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await db()
      .from("orders")
      .select("pickup_date,total,discount,promo_discount,cups,service,items")
      .gte("pickup_date", from)
      .lte("pickup_date", to)
      .in("status", PAID)
      .range(off, off + 999);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (data.length < 1000) return rows;
  }
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = new URL(req.url).searchParams.get("period");
  const period: Period = p === "week" || p === "month" ? p : "day";
  const bs = buckets(period, nowInShop().date);
  const rows = await fetchPaid(bs[0].start, bs[bs.length - 1].end);

  const series = bs.map((b) => ({ ...b, revenue: 0, orders: 0, cups: 0, discount: 0 }));
  const top = new Map<string, { name: string; qty: number; revenue: number }>();
  const services: Record<string, { orders: number; revenue: number }> = {
    dine_in: { orders: 0, revenue: 0 },
    takeaway: { orders: 0, revenue: 0 },
    pickup: { orders: 0, revenue: 0 },
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
    for (const i of r.items ?? []) {
      const t = top.get(i.name) ?? { name: i.name, qty: 0, revenue: 0 };
      t.qty += i.qty;
      t.revenue += i.price;
      top.set(i.name, t);
    }
  }

  return NextResponse.json({
    period,
    series: series.map(({ key, label, short, revenue, orders, cups, discount }) => ({ key, label, short, revenue, orders, cups, discount })),
    top: [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 8),
    services,
  });
}
