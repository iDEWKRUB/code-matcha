import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Stats = { delivered: number | null; opened: number | null; clicked: number | null } | null;

// สถิติบรอดแคสต์จาก LINE (มีให้ดูวันถัดไป และ LINE ซ่อนตัวเลขที่ต่ำกว่า 20 คน)
async function broadcastStats(requestId: string): Promise<Stats> {
  const r = await fetch(`https://api.line.me/v2/bot/insight/message/event?requestId=${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { overview?: { delivered?: number | null; uniqueImpression?: number | null; uniqueClick?: number | null } };
  const o = j.overview;
  return o ? { delivered: o.delivered ?? null, opened: o.uniqueImpression ?? null, clicked: o.uniqueClick ?? null } : null;
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await db()
    .from("message_log")
    .select("id,created_at,kind,to_name,title,order_no,ok,error,request_id")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = await Promise.all(
    data.map(async (m) => ({
      id: m.id,
      at: m.created_at,
      kind: m.kind,
      to: m.to_name,
      title: m.title,
      orderNo: m.order_no,
      ok: m.ok,
      error: m.error,
      stats: m.kind === "broadcast" && m.ok && m.request_id ? await broadcastStats(m.request_id) : undefined,
    })),
  );
  return NextResponse.json(rows);
}
