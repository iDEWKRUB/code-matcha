import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { rewardsPayload } from "@/lib/member";

// ให้ของแล้ว / ยกเลิกคูปอง (คืนแต้มและคืนสต็อก)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { to } = (await req.json().catch(() => ({}))) as { to?: unknown };
  if (to !== "given" && to !== "cancelled") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const id = Number((await params).id);
  const { data, error } = await db()
    .from("reward_redemptions")
    .update(to === "given" ? { status: "given", given_at: new Date().toISOString() } : { status: "cancelled" })
    .eq("id", id)
    .eq("status", "waiting")
    .select("reward_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return NextResponse.json({ error: "คูปองนี้ถูกใช้หรือยกเลิกไปแล้ว" }, { status: 409 });
  if (to === "cancelled") {
    const { error: e1 } = await db().from("points_ledger").delete().eq("redemption_id", id);
    if (e1) throw e1;
    if (data.reward_id) {
      const { data: r } = await db().from("rewards").select("stock").eq("id", data.reward_id).maybeSingle();
      if (r && r.stock !== null) await db().from("rewards").update({ stock: r.stock + 1 }).eq("id", data.reward_id);
    }
  }
  return NextResponse.json(await rewardsPayload());
}
