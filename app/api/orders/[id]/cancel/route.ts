import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/line";
import { db } from "@/lib/supabase";

// ลูกค้ายกเลิกเองได้เฉพาะตอนยังไม่แนบสลิป
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return NextResponse.json({ error: "เซสชัน LINE หมดอายุ" }, { status: 401 });
  const { data, error } = await db()
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", Number((await params).id))
    .eq("line_user_id", user.userId)
    .eq("status", "awaiting_payment")
    .select("id");
  if (error) throw error;
  if (!data.length) return NextResponse.json({ error: "ยกเลิกไม่ได้แล้ว" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
