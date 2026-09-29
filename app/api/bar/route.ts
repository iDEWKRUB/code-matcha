import { NextResponse } from "next/server";
import { getBarHours, getBarItems } from "@/lib/barServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const [items, hours] = await Promise.all([getBarItems(), getBarHours()]);
  return NextResponse.json({
    items,
    autoSlip: !!(process.env.SLIPOK_API_KEY && process.env.SLIPOK_BRANCH_ID),
    hours,
  });
}
