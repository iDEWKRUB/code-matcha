import { NextResponse } from "next/server";
import { getBarItems } from "@/lib/barServer";
import { getSettings, openNow } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  const [items, shop] = await Promise.all([getBarItems(), getSettings()]);
  return NextResponse.json({
    items,
    autoSlip: !!(process.env.SLIPOK_API_KEY && process.env.SLIPOK_BRANCH_ID),
    hours: { openNow: openNow(shop), openTime: shop.openTime, closeTime: shop.closeTime, accepting: shop.accepting },
  });
}
