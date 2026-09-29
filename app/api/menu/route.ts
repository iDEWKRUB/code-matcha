import { NextResponse } from "next/server";
import { getBarHours } from "@/lib/barServer";
import { getMenu, getPowders, getSettings, getTodaySlots, openNow } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  const [all, slots, powders, bar] = await Promise.all([
    getMenu(),
    getTodaySlots(settings),
    getPowders(),
    // ปุ่มเข้ามาม่าบาร์: ถ้าอ่านไม่ได้ก็แค่ไม่แสดงปุ่ม ไม่ให้หน้าเมนูล่ม
    getBarHours().catch((e) => {
      console.error("getBarHours failed", e);
      return null;
    }),
  ]);
  const menu = all.filter((m) => !m.hidden); // เมนูที่ร้านซ่อนไว้ ลูกค้าไม่เห็น
  // เมนูแนะนำขึ้นก่อน
  menu.sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.sort - b.sort);
  return NextResponse.json({
    menu,
    powders,
    slots,
    banner: settings.bannerActive ? settings.banner : "",
    hours: { accepting: settings.accepting, openTime: settings.openTime, closeTime: settings.closeTime, openNow: openNow(settings) },
    bar: bar?.enabled ? bar : null,
    payReady: !!process.env.PROMPTPAY_ID,
  });
}
