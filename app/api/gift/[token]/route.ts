import { NextResponse } from "next/server";
import { openCup } from "@/lib/cupCrypt";
import { CUP_MSG_DAYS } from "@/lib/cupMsg";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// หน้า /gift?t=... อ่านข้อความบนแก้วของออเดอร์เดียว (รหัสสุ่มเดาไม่ได้)
// ยังไม่จ่าย / ยกเลิก / เก่ากว่า CUP_MSG_DAYS วัน = ไม่แสดง แล้วหน้า gift สุ่มคำอวยพรของร้านแทน
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16}$/.test(token)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data, error } = await db()
    .from("orders")
    .select("cup_msg,status,created_at")
    .eq("cup_token", token)
    .maybeSingle();
  if (error) throw error;
  const old = data && Date.now() - new Date(data.created_at).getTime() > CUP_MSG_DAYS * 86400000;
  const cup = data?.cup_msg && !old && data.status !== "awaiting_payment" && data.status !== "cancelled" ? openCup(token, data.cup_msg) : null;
  if (!cup) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(
    { message: cup.msg, to: cup.to, from: cup.from },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
