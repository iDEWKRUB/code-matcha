import { NextResponse } from "next/server";
import { getBarHours, getBarItems } from "@/lib/barServer";
import { activeNotice } from "@/lib/menu";
import { getSettings } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  const [items, hours, settings] = await Promise.all([getBarItems(), getBarHours(), getSettings().catch(() => null)]);
  return NextResponse.json({
    items,
    autoSlip: !!(process.env.SLIPOK_API_KEY && process.env.SLIPOK_BRANCH_ID),
    hours,
    notice: settings ? activeNotice(settings) : "",
  });
}
