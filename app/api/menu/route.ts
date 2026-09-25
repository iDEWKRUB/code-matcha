import { NextResponse } from "next/server";
import { getMenu, getSettings, getTodaySlots } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  const [menu, slots, settings] = await Promise.all([getMenu(), getTodaySlots(), getSettings()]);
  // เมนูแนะนำขึ้นก่อน
  menu.sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.sort - b.sort);
  return NextResponse.json({
    menu,
    slots,
    banner: settings.bannerActive ? settings.banner : "",
    payReady: !!process.env.PROMPTPAY_ID,
  });
}
