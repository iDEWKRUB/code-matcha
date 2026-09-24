import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { ORDER_COLUMNS, getMenu, toOrder, type OrderRow } from "@/lib/orders";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [{ data, error }, menu] = await Promise.all([
    db()
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("pickup_date", nowInShop().date)
      .in("status", ["pending", "preparing", "ready"])
      .order("pickup_time")
      .order("daily_no"),
    getMenu(),
  ]);
  if (error) throw error;
  return NextResponse.json({ orders: (data as OrderRow[]).map(toOrder), menu });
}
