import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import {
  POST_COLUMNS,
  isPillar,
  isPsych,
  isState,
  linkProblem,
  monthDays,
  type MkChannel,
  type MkData,
  type MkPost,
  type PostState,
} from "@/lib/marketing";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

const NEED_MIGRATION = "ยังไม่ได้รัน migration-042 ถึง 045 (marketing)";
const bad = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });
const hm = () => {
  const m = nowInShop().minutes;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

async function channelsAndPerDay() {
  const [ch, st] = await Promise.all([
    db().from("marketing_channels").select("*").order("sort"),
    db()
      .from("marketing_settings")
      .select("per_day,brand_tags")
      .eq("id", 1)
      .maybeSingle(),
  ]);
  if (ch.error) throw ch.error;
  if (st.error) throw st.error;
  return {
    channels: ch.data as MkChannel[],
    perDay: (st.data?.per_day as number | undefined) ?? 2,
    brandTags: (st.data?.brand_tags as string | undefined) ?? "",
  };
}

// ?summary=1 → แค่จำนวนเรื่องของวันนี้ที่ยังลงไม่ครบ (ป้ายบนเมนู) · ?month=YYYY-MM → ทั้งเดือน (ค่าเริ่มต้น = เดือนนี้)
export async function GET(req: Request) {
  if (!(await isAdmin())) return bad("unauthorized", 401);
  const url = new URL(req.url);
  const today = nowInShop().date;
  const summary = !!url.searchParams.get("summary");
  try {
    const { channels, perDay, brandTags } = await channelsAndPerDay();
    if (summary) {
      const { data, error } = await db()
        .from("marketing_posts")
        .select("slot,status")
        .eq("post_date", today);
      if (error) throw error;
      const on = channels.filter((c) => c.enabled);
      const rows = new Map(
        (data ?? []).map((r) => [
          r.slot as number,
          r.status as Record<string, PostState>,
        ]),
      );
      let left = 0;
      for (let s = 1; s <= perDay; s++)
        if (!on.length || !on.every((c) => rows.get(s)?.[c.id] === "done"))
          left++;
      return NextResponse.json({ left });
    }
    const mo = url.searchParams.get("month");
    const month =
      mo && /^\d{4}-(0[1-9]|1[0-2])$/.test(mo) ? mo : today.slice(0, 7);
    const days = monthDays(month);
    const [posts, ideas] = await Promise.all([
      db()
        .from("marketing_posts")
        .select(POST_COLUMNS)
        .gte("post_date", days[0])
        .lte("post_date", days[days.length - 1])
        .order("post_date")
        .order("slot"),
      db()
        .from("marketing_ideas")
        .select("id,title,pillar,format")
        .order("id", { ascending: false })
        .limit(200),
    ]);
    if (posts.error) throw posts.error;
    if (ideas.error) throw ideas.error;
    const body: MkData = {
      today,
      month,
      days,
      perDay,
      brandTags,
      channels,
      posts: posts.data as MkPost[],
      ideas: ideas.data as MkData["ideas"],
    };
    return NextResponse.json(body);
  } catch {
    return summary ? NextResponse.json({ left: 0 }) : bad(NEED_MIGRATION, 503);
  }
}

// แก้เรื่องของวัน/ช่อง: หัวข้อ แคปชัน หมวด รูปแบบ และสถานะรายช่องทาง (รวมกับของเดิม)
export async function PUT(req: Request) {
  if (!(await isAdmin())) return bad("unauthorized", 401);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const date =
    typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date)
      ? b.date
      : null;
  const slot = Number(b.slot);
  if (!date || !Number.isInteger(slot) || slot < 1 || slot > 10)
    return bad("ข้อมูลไม่ถูกต้อง");
  if (
    b.title !== undefined &&
    (typeof b.title !== "string" || b.title.length > 120)
  )
    return bad("หัวข้อยาวเกิน 120 ตัวอักษร");
  if (
    b.caption !== undefined &&
    (typeof b.caption !== "string" || b.caption.length > 2200)
  )
    return bad("แคปชันยาวเกิน 2,200 ตัวอักษร");
  if (
    b.format !== undefined &&
    (typeof b.format !== "string" || b.format.length > 40)
  )
    return bad("รูปแบบยาวเกิน 40 ตัวอักษร");
  if (b.pillar !== undefined && !isPillar(b.pillar))
    return bad("หมวดไม่ถูกต้อง");
  if (b.psychology !== undefined && !isPsych(b.psychology))
    return bad("หลักจิตวิทยาไม่ถูกต้อง");
  const LIMIT = { body: 3000, visual: 1500, cta: 200, hashtags: 500 } as const;
  for (const [k, n] of Object.entries(LIMIT))
    if (
      b[k] !== undefined &&
      (typeof b[k] !== "string" || (b[k] as string).length > n)
    )
      return bad(`ข้อความยาวเกิน ${n} ตัวอักษร`);

  try {
    const { channels } = await channelsAndPerDay();
    const ids = new Set(channels.map((c) => c.id));
    const patchStatus: Record<string, PostState> = {};
    if (b.status !== undefined) {
      if (!b.status || typeof b.status !== "object")
        return bad("สถานะไม่ถูกต้อง");
      for (const [k, v] of Object.entries(
        b.status as Record<string, unknown>,
      )) {
        if (!ids.has(k) || !isState(v))
          return bad("สถานะหรือช่องทางไม่ถูกต้อง");
        patchStatus[k] = v;
      }
    }
    const patchCaps: Record<string, string> = {};
    if (b.captions !== undefined) {
      if (!b.captions || typeof b.captions !== "object")
        return bad("แคปชันไม่ถูกต้อง");
      for (const [k, v] of Object.entries(
        b.captions as Record<string, unknown>,
      )) {
        if (!ids.has(k) || typeof v !== "string" || v.length > 2200)
          return bad("แคปชันหรือช่องทางไม่ถูกต้อง");
        patchCaps[k] = v.trim();
      }
    }
    // ลิงก์โพสต์จริง: ต้องเป็นลิงก์ของช่องนั้น · วางลิงก์แล้วถือว่า "ลงแล้ว" ให้เอง
    const patchLinks: Record<string, string> = {};
    if (b.links !== undefined) {
      if (!b.links || typeof b.links !== "object")
        return bad("ลิงก์ไม่ถูกต้อง");
      for (const [k, v] of Object.entries(b.links as Record<string, unknown>)) {
        const ch = channels.find((c) => c.id === k);
        if (!ch || typeof v !== "string" || v.length > 500)
          return bad("ลิงก์หรือช่องทางไม่ถูกต้อง");
        const url = v.trim();
        if (url) {
          const problem = linkProblem(url, k, ch.name);
          if (problem) return bad(problem);
          if (!patchStatus[k]) patchStatus[k] = "done";
        }
        patchLinks[k] = url;
      }
    }
    const { data: cur, error: e1 } = await db()
      .from("marketing_posts")
      .select("status,done_at,captions,links")
      .eq("post_date", date)
      .eq("slot", slot)
      .maybeSingle();
    if (e1) throw e1;
    const status = {
      ...((cur?.status as Record<string, PostState>) ?? {}),
      ...patchStatus,
    };
    const done_at = { ...((cur?.done_at as Record<string, string>) ?? {}) };
    for (const [k, v] of Object.entries(patchStatus)) {
      if (v === "done")
        done_at[k] =
          done_at[k] &&
          (cur?.status as Record<string, PostState> | undefined)?.[k] === "done"
            ? done_at[k]
            : hm();
      else delete done_at[k];
    }
    const links = {
      ...((cur?.links as Record<string, string>) ?? {}),
      ...patchLinks,
    };
    for (const k of Object.keys(links)) if (!links[k]) delete links[k];
    const captions = {
      ...((cur?.captions as Record<string, string>) ?? {}),
      ...patchCaps,
    };
    for (const k of Object.keys(captions)) if (!captions[k]) delete captions[k];
    const row: Record<string, unknown> = {
      post_date: date,
      slot,
      status,
      done_at,
      captions,
      links,
      updated_at: new Date().toISOString(),
    };
    for (const k of [
      "title",
      "caption",
      "format",
      "body",
      "visual",
      "cta",
      "hashtags",
    ] as const)
      if (typeof b[k] === "string") row[k] = (b[k] as string).trim();
    if (b.pillar !== undefined) row.pillar = b.pillar;
    if (b.psychology !== undefined) row.psychology = b.psychology;
    const { data, error } = await db()
      .from("marketing_posts")
      .upsert(row, { onConflict: "post_date,slot" })
      .select(POST_COLUMNS)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return bad(NEED_MIGRATION, 503);
  }
}
