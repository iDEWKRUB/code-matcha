import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/line";
import { memberSummary, toCoupon } from "@/lib/member";
import { db } from "@/lib/supabase";

const ERRORS: Record<string, string> = {
  not_enough_points: "แต้มไม่พอสำหรับของขวัญนี้",
  out_of_stock: "ของขวัญนี้หมดแล้ว",
  reward_unavailable: "ของขวัญนี้ปิดการแลกแล้ว",
};

// แลกของขวัญ: หักแต้มทันที ได้คูปองไปแสดงที่ร้าน
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return NextResponse.json({ error: "เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  const { rewardId, name } = (await req.json().catch(() => ({}))) as { rewardId?: unknown; name?: unknown };
  if (!Number.isInteger(rewardId)) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const customer = typeof name === "string" && name.trim() ? name.trim().slice(0, 60) : user.name;
  const { data, error } = await db().rpc("redeem_reward", { p_user: user.userId, p_name: customer, p_reward: rewardId });
  if (error) {
    const msg = Object.keys(ERRORS).find((k) => error.message.includes(k));
    if (msg) return NextResponse.json({ error: ERRORS[msg] }, { status: 409 });
    throw error;
  }
  const { customerName: _, ...coupon } = toCoupon(data);
  return NextResponse.json({ coupon, member: await memberSummary(user.userId, user.name) });
}
