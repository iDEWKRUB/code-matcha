import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { barFlags, type BarScan, type CountLine, type ExtraItem } from "@/lib/bar";
import { trayUrls } from "@/lib/barServer";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const dayStart = (date: string) => new Date(`${date}T00:00:00+07:00`).toISOString();

async function items() {
  const { data, error } = await db().from("bar_items").select("id,name,price,kind,stock,available,category,item_group,detail,code").order("sort").order("name");
  if (error) throw error;
  return data.map(({ item_group, ...r }) => ({ ...r, group: item_group ?? "" }));
}

// ตามของหาย: บิลของวันที่นับที่มีรายการนี้อยู่ในถาด (ระบบอ่านได้ / จ่าย / เรียกเก็บเพิ่ม)
async function trace(countId: number, itemId: string) {
  const { data: c, error } = await db().from("bar_counts").select("count_date").eq("id", countId).maybeSingle();
  if (error) throw error;
  if (!c) return null;
  const { data: rows, error: e } = await db()
    .from("orders")
    .select("id,daily_no,created_at,customer_name,status,tray_path,bar_scan,bar_extra_items,bar_extra_status")
    .eq("source", "bar")
    .eq("pickup_date", c.count_date)
    .neq("status", "awaiting_payment")
    .order("id");
  if (e) throw e;
  const all = rows.map((o) => {
    const scan = o.bar_scan as BarScan | null;
    const extra = o.bar_extra_status === "none" ? 0 : ((o.bar_extra_items as ExtraItem[]) ?? []).filter((i) => i.id === itemId).reduce((n, i) => n + i.qty, 0);
    return {
      id: o.id,
      no: o.daily_no,
      at: o.created_at,
      name: o.customer_name,
      status: o.status,
      trayPath: o.tray_path as string | null,
      detected: scan?.detected[itemId] ?? 0,
      paid: o.status === "cancelled" ? 0 : (scan?.final[itemId] ?? 0),
      extra,
      pieces: Object.values(scan?.final ?? {}).reduce((n, q) => n + q, 0),
      warn: barFlags(scan).some((f) => f.level === "warn"),
    };
  });
  // บิลที่รู้ว่ามีรายการนี้ + บิลอื่นวันนั้น (ระบบอาจอ่านไม่เจอ ต้องดูจากรูป) เรียงบิลน่าสงสัยก่อน
  const related = all
    .filter((b) => b.detected || b.paid || b.extra)
    .sort((a, b) => Number(b.detected - b.paid - b.extra > 0) - Number(a.detected - a.paid - a.extra > 0) || Number(b.warn) - Number(a.warn) || a.no - b.no);
  const others = all.filter((b) => !(b.detected || b.paid || b.extra)).sort((a, b) => Number(b.warn) - Number(a.warn) || a.no - b.no);
  const urls = await trayUrls(all.map((b) => b.trayPath));
  const withPhoto = ({ trayPath, ...b }: (typeof all)[number]) => ({ ...b, photo: trayPath ? (urls.get(trayPath) ?? null) : null });
  return { bills: related.map(withPhoto), others: others.map(withPhoto) };
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const q = new URL(req.url).searchParams;
  if (q.get("trace")) {
    const t = await trace(Number(q.get("trace")), String(q.get("item") ?? ""));
    return t ? NextResponse.json(t) : fail("ไม่พบผลนับ", 404);
  }
  const today = nowInShop().date;
  const [list, moves, counts] = await Promise.all([
    items(),
    db()
      .from("bar_stock_moves")
      .select("id,item_id,delta,kind,order_id,note,created_at,orders(daily_no)")
      .gte("created_at", dayStart(today))
      .order("id", { ascending: false })
      .limit(300),
    db().from("bar_counts").select("id,count_date,lines,missing,missing_value,created_at").order("id", { ascending: false }).limit(14),
  ]);
  if (moves.error) throw moves.error;
  if (counts.error) throw counts.error;
  return NextResponse.json({
    today,
    items: list,
    moves: moves.data.map((m) => ({
      id: m.id,
      itemId: m.item_id,
      delta: m.delta,
      kind: m.kind,
      orderNo: (m.orders as unknown as { daily_no: number } | null)?.daily_no ?? null,
      note: m.note,
      at: m.created_at,
    })),
    counts: counts.data.map((c) => ({ id: c.id, date: c.count_date, at: c.created_at, lines: c.lines as CountLine[], missing: c.missing, missingValue: c.missing_value })),
  });
}

// in = รับของเข้า, count = บันทึกผลนับจริง (ปรับสต๊อกเป็นตัวเลขที่นับได้), waste = ระบุว่าของที่หายเป็นของเสีย
export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const b = (await req.json().catch(() => null)) as { action?: unknown; lines?: unknown; note?: unknown; countId?: unknown; id?: unknown; qty?: unknown } | null;
  const list = await items();
  const byId = new Map(list.map((i) => [i.id, i]));
  const raw = Array.isArray(b?.lines) ? (b!.lines as { id?: unknown; qty?: unknown; counted?: unknown }[]) : [];

  if (b?.action === "in") {
    const lines = raw.map((l) => ({ id: String(l.id), delta: Number(l.qty) })).filter((l) => byId.has(l.id) && Number.isInteger(l.delta) && l.delta > 0 && l.delta <= 10000);
    if (!lines.length) return fail("ใส่จำนวนที่รับเข้าอย่างน้อย 1 รายการ");
    const note = typeof b.note === "string" ? b.note.trim().slice(0, 100) : "";
    const { error } = await db().rpc("bar_stock_add", { p_kind: "in", p_lines: lines, p_note: note, p_count: null });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  }

  if (b?.action === "count") {
    const lines: CountLine[] = [];
    for (const l of raw) {
      const it = byId.get(String(l.id));
      const counted = Number(l.counted);
      if (!it || !Number.isInteger(counted) || counted < 0 || counted > 100000) continue;
      lines.push({ id: it.id, name: it.name, price: it.price, expected: it.stock, counted, diff: counted - it.stock, waste: 0 });
    }
    if (!lines.length) return fail("กรอกจำนวนที่นับได้อย่างน้อย 1 รายการ");
    const missing = lines.reduce((n, l) => n + Math.max(0, -l.diff), 0);
    const missingValue = lines.reduce((n, l) => n + Math.max(0, -l.diff) * l.price, 0);
    const { data, error } = await db()
      .from("bar_counts")
      .insert({ count_date: nowInShop().date, lines, missing, missing_value: missingValue })
      .select("id")
      .single();
    if (error) throw error;
    const { error: e } = await db().rpc("bar_stock_add", { p_kind: "count", p_lines: lines.map((l) => ({ id: l.id, delta: l.diff })), p_note: "นับจริง", p_count: data.id });
    if (e) throw e;
    return NextResponse.json({ ok: true, countId: data.id });
  }

  if (b?.action === "waste") {
    const countId = Number(b.countId);
    const qty = Number(b.qty);
    const { data: c, error } = await db().from("bar_counts").select("lines").eq("id", countId).maybeSingle();
    if (error) throw error;
    if (!c) return fail("ไม่พบผลนับ", 404);
    const lines = (c.lines as CountLine[]).map((l) => (l.id === String(b.id) ? { ...l, waste: Math.max(0, Math.min(Number.isInteger(qty) ? qty : 0, Math.max(0, -l.diff))) } : l));
    const { error: e } = await db().from("bar_counts").update({ lines }).eq("id", countId);
    if (e) throw e;
    return NextResponse.json({ ok: true });
  }

  return fail("คำสั่งไม่ถูกต้อง");
}
