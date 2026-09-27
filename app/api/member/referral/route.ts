import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/line";
import { claimReferral } from "@/lib/referral";

// ใช้โค้ดชวนของเพื่อน (จากลิงก์ ?ref= หรือกรอกเองในบัตรสมาชิก)
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return NextResponse.json({ error: "เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  const { code, name } = (await req.json().catch(() => ({}))) as { code?: unknown; name?: unknown };
  if (typeof code !== "string") return NextResponse.json({ error: "โค้ดชวนไม่ถูกต้อง" }, { status: 400 });
  const r = await claimReferral(user.userId, typeof name === "string" && name.trim() ? name.trim() : user.name, code);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json(r);
}
