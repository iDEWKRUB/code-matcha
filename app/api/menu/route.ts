import { NextResponse } from "next/server";
import { getMenu, getTodaySlots } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  const [menu, slots] = await Promise.all([getMenu(), getTodaySlots()]);
  return NextResponse.json({ menu, slots, payReady: !!process.env.PROMPTPAY_ID });
}
