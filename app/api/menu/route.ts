import { NextResponse } from "next/server";
import { getBarHours } from "@/lib/barServer";
import { activeNotice } from "@/lib/menu";
import {
  getMenu,
  getPowders,
  getSettings,
  getTodaySlots,
  getTomorrowSlots,
  openNow,
  tomorrowDate,
} from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  const [all, slots, tomorrowSlots, powders, bar] = await Promise.all([
    getMenu(),
    getTodaySlots(settings),
    getTomorrowSlots(settings),
    getPowders(),
    // ปุ่มเข้ามาม่าบาร์: ถ้าอ่านไม่ได้ก็แค่ไม่แสดงปุ่ม ไม่ให้หน้าเมนูล่ม
    getBarHours().catch((e) => {
      console.error("getBarHours failed", e);
      return null;
    }),
  ]);
  const menu = all.filter((m) => !m.hidden); // เมนูที่ร้านซ่อนไว้ ลูกค้าไม่เห็น
  // เมนูแนะนำขึ้นก่อน
  menu.sort(
    (a, b) => Number(b.recommended) - Number(a.recommended) || a.sort - b.sort,
  );
  return NextResponse.json(
    {
      menu,
      powders,
      slots,
      banner: settings.bannerActive ? settings.banner : "",
      notice: activeNotice(settings),
      hours: {
        accepting: settings.accepting,
        openTime: settings.openTime,
        closeTime: settings.closeTime,
        openNow: openNow(settings),
      },
      bar: bar?.enabled ? bar : null,
      payReady: !!process.env.PROMPTPAY_ID,
      // สั่งล่วงหน้าสำหรับพรุ่งนี้ (ว่าง = ปิดรับ/เลยเวลาปิดรับแล้ว)
      tomorrow: tomorrowSlots.length
        ? {
            date: tomorrowDate(),
            slots: tomorrowSlots,
            cutoff: settings.preorderCutoff,
          }
        : null,
      // ร้านไปส่ง (ฟรีในรัศมี) · ต้องตั้งพิกัดร้านก่อนถึงจะเปิดให้ลูกค้าเลือก
      delivery:
        settings.deliveryEnabled &&
        settings.shopLat !== null &&
        settings.shopLng !== null
          ? {
              km: settings.deliveryKm,
              min: settings.deliveryMin,
              lat: settings.shopLat,
              lng: settings.shopLng,
            }
          : null,
    },
    // เมนูเป็นข้อมูลสาธารณะ (ผู้ที่ยังไม่ล็อกอินก็เปิดดูได้) พักไว้ที่ CDN สั้นๆ ลดการอ่านฐานข้อมูลเวลามีคนเปิดพร้อมกันเยอะ · ตรวจที่ว่างจริงตอนสั่งอยู่แล้ว
    {
      headers: {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
      },
    },
  );
}
