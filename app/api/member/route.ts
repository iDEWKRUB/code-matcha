import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/line";
import { memberSummary } from "@/lib/member";

export const dynamic = "force-dynamic";

// บัตรสมาชิกของฉัน: แต้มคงเหลือ ใช้ไป สะสมทั้งหมด ประวัติ คูปอง และของขวัญที่แลกได้
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return NextResponse.json({ error: "เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  return NextResponse.json(await memberSummary(user.userId, user.name));
}
