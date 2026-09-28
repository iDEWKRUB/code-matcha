import { NextResponse } from "next/server";
import { pointsEarned } from "@/lib/config";
import { verifyIdToken } from "@/lib/line";
import { pointsBalance } from "@/lib/orders";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// สถานะออเดอร์มาม่าบาร์ของฉัน (หน้ารอร้านตรวจสลิปถามซ้ำทุกไม่กี่วินาที)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return NextResponse.json({ error: "เซสชัน LINE หมดอายุ" }, { status: 401 });
  const { data, error } = await db()
    .from("orders")
    .select("id,daily_no,total,status")
    .eq("id", Number((await params).id))
    .eq("line_user_id", user.userId)
    .eq("source", "bar")
    .maybeSingle();
  if (error) throw error;
  if (!data) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
  const paid = ["pending", "preparing", "ready", "completed"].includes(data.status);
  return NextResponse.json({
    no: data.daily_no,
    total: data.total,
    status: paid ? "paid" : data.status === "cancelled" ? "cancelled" : "waiting",
    earned: paid ? pointsEarned(data.total) : 0,
    points: paid ? await pointsBalance(user.userId) : undefined,
  });
}
