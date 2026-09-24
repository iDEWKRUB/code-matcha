import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pushText } from "@/lib/line";
import type { OrderStatus } from "@/lib/menu";
import { ORDER_COLUMNS, type OrderRow } from "@/lib/orders";
import { db } from "@/lib/supabase";

const NEXT: Record<string, OrderStatus[]> = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed"],
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  const { to } = (await req.json().catch(() => ({}))) as { to?: OrderStatus };

  const { data: current, error: readErr } = await db()
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", id)
    .maybeSingle<OrderRow>();
  if (readErr) throw readErr;
  if (!current) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
  if (!to || !NEXT[current.status]?.includes(to))
    return NextResponse.json({ error: "เปลี่ยนสถานะนี้ไม่ได้" }, { status: 409 });

  // อัปเดตเฉพาะเมื่อสถานะยังเหมือนเดิม กันสองเครื่องกดพร้อมกัน
  const { data: updated, error } = await db()
    .from("orders")
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", current.status)
    .select("id");
  if (error) throw error;
  if (!updated?.length) return NextResponse.json({ error: "ออเดอร์ถูกอัปเดตไปแล้ว" }, { status: 409 });

  if (to === "ready")
    await pushText(
      current.line_user_id,
      `🍵 เครื่องดื่มออเดอร์ #${current.daily_no} พร้อมรับแล้ว\nแจ้งเลข #${current.daily_no} ที่เคาน์เตอร์ ชำระ ฿${current.total} ที่ร้านได้เลย`,
    );
  if (to === "cancelled")
    await pushText(
      current.line_user_id,
      `ขออภัย ร้านต้องยกเลิกออเดอร์ #${current.daily_no} (รับ ${current.pickup_time} น.)\nหากสงสัยตอบกลับในแชทนี้ได้เลย`,
    );

  return NextResponse.json({ ok: true });
}
