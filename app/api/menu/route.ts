import { NextResponse } from "next/server";
import { getMenu, getSettings, getTodaySlots, openNow } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  const [menu, slots] = await Promise.all([getMenu(), getTodaySlots(settings)]);
  // เมนูแนะนำขึ้นก่อน
  menu.sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.sort - b.sort);
  return NextResponse.json({
    menu,
    slots,
    banner: settings.bannerActive ? settings.banner : "",
    hours: { accepting: settings.accepting, openTime: settings.openTime, closeTime: settings.closeTime, openNow: openNow(settings) },
    payReady: !!process.env.PROMPTPAY_ID,
  });
}
