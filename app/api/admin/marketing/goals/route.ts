import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import {
  addDays,
  monthDays,
  weekStartOf,
  type MkChannel,
  type MkClaim,
  type MkGoal,
  type MkGoalProgress,
  type PostState,
} from "@/lib/marketing";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

const NEED_MIGRATION = "ยังไม่ได้รัน migration-044-marketing-goals.sql";
const bad = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });
const GOAL_COLUMNS = "id,period,metric,target,reward,strict,active,sort";
const dayDiff = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000,
  );

// ความคืบหน้าของทุกเป้าหมายในรอบปัจจุบัน (นับถึงวันนี้)
async function progress(): Promise<{
  goals: MkGoalProgress[];
  claims: MkClaim[];
}> {
  const today = nowInShop().date;
  const wk = weekStartOf(today);
  const month = today.slice(0, 7);
  const mDays = monthDays(month);
  const from = wk < mDays[0] ? wk : mDays[0];
  const [g, ch, st, ps, cl] = await Promise.all([
    db().from("marketing_goals").select(GOAL_COLUMNS).order("sort").order("id"),
    db().from("marketing_channels").select("id,enabled"),
    db().from("marketing_settings").select("per_day").eq("id", 1).maybeSingle(),
    db()
      .from("marketing_posts")
      .select("post_date,slot,status")
      .gte("post_date", from)
      .lte("post_date", today),
    db()
      .from("marketing_goal_claims")
      .select("id,goal_id,period_key,reward,value,claimed_at")
      .order("claimed_at", { ascending: false })
      .limit(20),
  ]);
  for (const r of [g, ch, st, ps, cl]) if (r.error) throw r.error;
  const on = (ch.data as Pick<MkChannel, "id" | "enabled">[])
    .filter((c) => c.enabled)
    .map((c) => c.id);
  const perDay = (st.data?.per_day as number | undefined) ?? 2;
  const posts = ps.data as {
    post_date: string;
    slot: number;
    status: Record<string, PostState>;
  }[];
  const claims = cl.data as MkClaim[];
  const done = (p: (typeof posts)[number], strict: boolean) =>
    strict
      ? on.every((c) => p.status?.[c] === "done")
      : on.some((c) => p.status?.[c] === "done");

  const goals = (g.data as MkGoal[]).map((goal) => {
    const start = goal.period === "week" ? wk : mDays[0];
    const end =
      goal.period === "week" ? addDays(wk, 6) : mDays[mDays.length - 1];
    const inRange = posts.filter(
      (p) => p.post_date >= start && p.post_date <= end && done(p, goal.strict),
    );
    let value = inRange.length;
    if (goal.metric === "days") {
      const perDate = new Map<string, number>();
      for (const p of inRange)
        perDate.set(p.post_date, (perDate.get(p.post_date) ?? 0) + 1);
      value = [...perDate.values()].filter((n) => n >= perDay).length;
    }
    const key = goal.period === "week" ? `W:${wk}` : `M:${month}`;
    return {
      ...goal,
      value,
      achieved: value >= goal.target,
      claimed: claims.some(
        (c) => c.goal_id === goal.id && c.period_key === key,
      ),
      key,
      from: start,
      to: end,
      daysLeft: dayDiff(today, end),
    };
  });
  return { goals, claims };
}

export async function GET() {
  if (!(await isAdmin())) return bad("unauthorized", 401);
  try {
    return NextResponse.json(await progress());
  } catch {
    return bad(NEED_MIGRATION, 503);
  }
}

// สร้าง/แก้เป้าหมาย
export async function POST(req: Request) {
  if (!(await isAdmin())) return bad("unauthorized", 401);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.period !== "week" && b.period !== "month")
    return bad("เลือกรอบ สัปดาห์ หรือ เดือน");
  if (b.metric !== "posts" && b.metric !== "days")
    return bad("เลือกชนิดเป้าหมาย");
  const target = Number(b.target);
  const max = b.metric === "days" ? (b.period === "week" ? 7 : 31) : 400;
  if (!Number.isInteger(target) || target < 1 || target > max)
    return bad(`ตัวเลขเป้าหมายต้องอยู่ระหว่าง 1–${max}`);
  const reward =
    typeof b.reward === "string" ? b.reward.trim().slice(0, 120) : "";
  if (!reward) return bad("ใส่รางวัลที่จะให้ตัวเองด้วย");
  const row = {
    period: b.period,
    metric: b.metric,
    target,
    reward,
    strict: b.strict === true,
    active: b.active !== false,
  };
  try {
    const id = Number(b.id);
    if (Number.isInteger(id) && id > 0) {
      const { error } = await db()
        .from("marketing_goals")
        .update(row)
        .eq("id", id);
      if (error) throw error;
    } else {
      const { data: all } = await db().from("marketing_goals").select("sort");
      const sort = Math.max(0, ...(all ?? []).map((x) => x.sort as number)) + 1;
      const { error } = await db()
        .from("marketing_goals")
        .insert({ ...row, sort });
      if (error) throw error;
    }
    return NextResponse.json(await progress());
  } catch {
    return bad(NEED_MIGRATION, 503);
  }
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return bad("unauthorized", 401);
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return bad("ข้อมูลไม่ถูกต้อง");
  const { error } = await db().from("marketing_goals").delete().eq("id", id);
  if (error) return bad(NEED_MIGRATION, 503);
  return NextResponse.json(await progress());
}

// รับรางวัล: ได้เฉพาะรอบปัจจุบันที่ทำถึงเป้าแล้ว และรอบละครั้ง
export async function PUT(req: Request) {
  if (!(await isAdmin())) return bad("unauthorized", 401);
  const { goalId } = (await req.json().catch(() => ({}))) as {
    goalId?: unknown;
  };
  try {
    const cur = await progress();
    const goal = cur.goals.find((x) => x.id === Number(goalId));
    if (!goal || !goal.active) return bad("ไม่พบเป้าหมายนี้");
    if (!goal.achieved)
      return bad(`ยังไม่ถึงเป้า (${goal.value}/${goal.target})`);
    const { error } = await db()
      .from("marketing_goal_claims")
      .upsert(
        {
          goal_id: goal.id,
          period_key: goal.key,
          reward: goal.reward,
          value: goal.value,
        },
        { onConflict: "goal_id,period_key", ignoreDuplicates: true },
      );
    if (error) throw error;
    return NextResponse.json(await progress());
  } catch {
    return bad(NEED_MIGRATION, 503);
  }
}
