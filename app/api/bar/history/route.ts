import { NextResponse } from "next/server";
import { TRAY_KEEP_DAYS } from "@/lib/bar";
import { trayUrls } from "@/lib/barServer";
import { verifyIdToken } from "@/lib/line";
import type { OrderItem } from "@/lib/menu";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PAID = ["pending", "preparing", "ready", "completed"];

// ประวัติการมากินมาม่าบาร์ของฉัน (ย้อนหลังตามระยะที่เก็บรูป)
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return NextResponse.json({ error: "เซสชัน LINE หมดอายุ" }, { status: 401 });
  const since = new Date(Date.now() - TRAY_KEEP_DAYS * 86400000).toISOString();
  const { data, error } = await db()
    .from("orders")
    .select("id,daily_no,created_at,items,total,status,tray_path,bar_extra,bar_extra_note,bar_extra_status")
    .eq("line_user_id", user.userId)
    .eq("source", "bar")
    .in("status", [...PAID, "payment_review"])
    .gt("created_at", since)
    .order("id", { ascending: false })
    .limit(50);
  if (error) throw error;
  const urls = await trayUrls(data.map((o) => o.tray_path));
  return NextResponse.json({
    bills: data.map((o) => ({
      id: o.id,
      no: o.daily_no,
      at: o.created_at,
      items: o.items as OrderItem[],
      total: o.total,
      paid: PAID.includes(o.status),
      photo: o.tray_path ? (urls.get(o.tray_path) ?? null) : null,
      extra: o.bar_extra,
      extraNote: o.bar_extra_note,
      extraStatus: o.bar_extra_status,
    })),
  });
}
