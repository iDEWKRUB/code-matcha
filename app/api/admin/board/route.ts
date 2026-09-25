import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { ORDER_COLUMNS, getMenu, toOrder, type OrderRow } from "@/lib/orders";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

const PAID = ["pending", "preparing", "ready", "completed"];

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const date = nowInShop().date;
  const [{ data, error }, menu, paid] = await Promise.all([
    db()
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("pickup_date", date)
      .in("status", ["payment_review", "pending", "preparing", "ready"])
      .order("pickup_time")
      .order("daily_no"),
    getMenu(),
    db().from("orders").select("total,cups").eq("pickup_date", date).in("status", PAID),
  ]);
  if (error) throw error;
  if (paid.error) throw paid.error;
  const stats = {
    orders: paid.data.length,
    revenue: paid.data.reduce((n, o) => n + o.total, 0),
    cups: paid.data.reduce((n, o) => n + o.cups, 0),
  };
  return NextResponse.json({ orders: (data as OrderRow[]).map(toOrder), menu, stats });
}
