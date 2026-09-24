import { NextResponse } from "next/server";
import { passwordMatches, startSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: unknown };
  if (typeof password !== "string" || !passwordMatches(password))
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  await startSession();
  return NextResponse.json({ ok: true });
}
