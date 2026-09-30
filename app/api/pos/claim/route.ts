import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/line";
import { pointsBalance } from "@/lib/orders";
import { claimBill } from "@/lib/pos";

export const dynamic = "force-dynamic";

// ลูกค้าสแกน QR บนใบเสร็จหน้าร้าน → รับแต้มของบิลนั้นเข้าบัตรสมาชิก
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return NextResponse.json({ error: "เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  const { t } = (await req.json().catch(() => ({}))) as { t?: unknown };
  if (typeof t !== "string" || !/^[\w-]{8,40}$/.test(t)) return NextResponse.json({ error: "QR ไม่ถูกต้อง" }, { status: 400 });
  const r = await claimBill(t, user.userId, user.name);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json({ earned: r.earned, points: await pointsBalance(user.userId) });
}
