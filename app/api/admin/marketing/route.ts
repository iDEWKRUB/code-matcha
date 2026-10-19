import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { isPillar, isState, monthDays, type MkChannel, type MkData, type MkPost, type PostState } from "@/lib/marketing";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

const NEED_MIGRATION = "ยังไม่ได้รัน migration-042-marketing.sql";
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const hm = () => {
  const m = nowInShop().minutes;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

async function channelsAndPerDay() {
  const [ch, st] = await Promise.all([db().from("marketing_channels").select("*").order("sort"), db().from("marketing_settings").select("per_day").eq("id", 1).maybeSingle()]);
  if (ch.error) throw ch.error;
  if (st.error) throw st.error;
  return { channels: ch.data as MkChannel[], perDay: (st.data?.per_day as number | undefined) ?? 2 };
}

// ?summary=1 → แค่จำนวนเรื่องของวันนี้ที่ยังลงไม่ครบ (ป้ายบนเมนู) · ?month=YYYY-MM → ทั้งเดือน (ค่าเริ่มต้น = เดือนนี้)
export async function GET(req: Request) {
  if (!(await isAdmin())) return bad("unauthorized", 401);
  const url = new URL(req.url);
  const today = nowInShop().date;
  const summary = !!url.searchParams.get("summary");
  try {
    const { channels, perDay } = await channelsAndPerDay();
    if (summary) {
      const { data, error } = await db().from("marketing_posts").select("slot,status").eq("post_date", today);
      if (error) throw error;
      const on = channels.filter((c) => c.enabled);
      const rows = new Map((data ?? []).map((r) => [r.slot as number, r.status as Record<string, PostState>]));
      let left = 0;
      for (let s = 1; s <= perDay; s++) if (!on.length || !on.every((c) => rows.get(s)?.[c.id] === "done")) left++;
      return NextResponse.json({ left });
    }
    const mo = url.searchParams.get("month");
    const month = mo && /^\d{4}-(0[1-9]|1[0-2])$/.test(mo) ? mo : today.slice(0, 7);
    const days = monthDays(month);
    const [posts, ideas] = await Promise.all([
      db().from("marketing_posts").select("post_date,slot,title,pillar,format,caption,status,done_at").gte("post_date", days[0]).lte("post_date", days[days.length - 1]).order("post_date").order("slot"),
      db().from("marketing_ideas").select("id,title,pillar,format").order("id", { ascending: false }).limit(200),
    ]);
    if (posts.error) throw posts.error;
    if (ideas.error) throw ideas.error;
    const body: MkData = { today, month, days, perDay, channels, posts: posts.data as MkPost[], ideas: ideas.data as MkData["ideas"] };
    return NextResponse.json(body);
  } catch {
    return summary ? NextResponse.json({ left: 0 }) : bad(NEED_MIGRATION, 503);
  }
}

// แก้เรื่องของวัน/ช่อง: หัวข้อ แคปชัน หมวด รูปแบบ และสถานะรายช่องทาง (รวมกับของเดิม)
export async function PUT(req: Request) {
  if (!(await isAdmin())) return bad("unauthorized", 401);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  const slot = Number(b.slot);
  if (!date || !Number.isInteger(slot) || slot < 1 || slot > 10) return bad("ข้อมูลไม่ถูกต้อง");
  if (b.title !== undefined && (typeof b.title !== "string" || b.title.length > 120)) return bad("หัวข้อยาวเกิน 120 ตัวอักษร");
  if (b.caption !== undefined && (typeof b.caption !== "string" || b.caption.length > 2200)) return bad("แคปชันยาวเกิน 2,200 ตัวอักษร");
  if (b.format !== undefined && (typeof b.format !== "string" || b.format.length > 40)) return bad("รูปแบบยาวเกิน 40 ตัวอักษร");
  if (b.pillar !== undefined && !isPillar(b.pillar)) return bad("หมวดไม่ถูกต้อง");

  try {
    const { channels } = await channelsAndPerDay();
    const ids = new Set(channels.map((c) => c.id));
    const patchStatus: Record<string, PostState> = {};
    if (b.status !== undefined) {
      if (!b.status || typeof b.status !== "object") return bad("สถานะไม่ถูกต้อง");
      for (const [k, v] of Object.entries(b.status as Record<string, unknown>)) {
        if (!ids.has(k) || !isState(v)) return bad("สถานะหรือช่องทางไม่ถูกต้อง");
        patchStatus[k] = v;
      }
    }
    const { data: cur, error: e1 } = await db().from("marketing_posts").select("status,done_at").eq("post_date", date).eq("slot", slot).maybeSingle();
    if (e1) throw e1;
    const status = { ...((cur?.status as Record<string, PostState>) ?? {}), ...patchStatus };
    const done_at = { ...((cur?.done_at as Record<string, string>) ?? {}) };
    for (const [k, v] of Object.entries(patchStatus)) {
      if (v === "done") done_at[k] = hm();
      else delete done_at[k];
    }
    const row: Record<string, unknown> = { post_date: date, slot, status, done_at, updated_at: new Date().toISOString() };
    for (const k of ["title", "caption", "format"] as const) if (typeof b[k] === "string") row[k] = (b[k] as string).trim();
    if (b.pillar !== undefined) row.pillar = b.pillar;
    const { data, error } = await db().from("marketing_posts").upsert(row, { onConflict: "post_date,slot" }).select("post_date,slot,title,pillar,format,caption,status,done_at").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return bad(NEED_MIGRATION, 503);
  }
}
