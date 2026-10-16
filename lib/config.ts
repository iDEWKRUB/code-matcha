// ตั้งค่าร้าน: แก้ที่นี่แล้ว deploy ใหม่
export const SHOP = {
  name: "CODE-MATCHA",
  timeZone: "Asia/Bangkok",
  // เวลาเปิด-ปิด ระยะห่างรอบ และแก้วต่อรอบ ตั้งได้ในหน้าบาริสต้า > ตั้งค่าร้าน (ตาราง shop_settings)
  // โดเมนของเว็บ (ไม่มี / ท้าย) ใช้ในปุ่มการ์ด LINE และ QR สติ๊กเกอร์ · ย้ายโฮสต์ให้ตั้ง NEXT_PUBLIC_SITE_URL
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "https://code-matcha.vercel.app").replace(/\/+$/, ""),
  lineOaId: process.env.NEXT_PUBLIC_LINE_OA_ID || "@745plqxi", // LINE OA ของร้าน (ลูกค้าต้องเป็นเพื่อนถึงจะได้รับแจ้งเตือน)
  requireFriend: true, // ต้องแอดเพื่อน OA ก่อนถึงจะสั่งได้ (false = สั่งได้เลย แต่ไม่ได้รับแจ้งเตือน)
  leadMinutes: 10, // ต้องสั่งล่วงหน้าอย่างน้อยกี่นาที
  holdMinutes: 10, // จองเวลารับไว้ให้ระหว่างรอชำระเงินกี่นาที
};

// ข้อความท้ายใบเสร็จหน้าร้าน (ประกาศที่จอดรถ) · แก้ที่นี่แล้ว push
// ชื่อ/รหัส Wi-Fi ตั้งในหน้าแอดมิน > ตั้งค่า > ร้าน (shop_settings.wifi_ssid / wifi_pass) ไม่เก็บในโค้ด
export const RECEIPT = {
  noticeTitle: "สำหรับท่านที่นำรถยนต์มา โปรดทราบ",
  notice: "เนื่องจากที่จอดรถมีจำนวนจำกัด ทางร้านขอสงวนสิทธิ์ใช้บริการไม่เกิน 2 ชม. ขอบคุณที่เข้าใจนะครับ",
};

// สะสมแต้ม: จ่ายทุก bahtPerPoint บาท ได้ 1 แต้ม, 1 แต้ม = ลด 1 บาท, ใช้ครั้งละอย่างน้อย minRedeem แต้ม
export const POINTS = { bahtPerPoint: 25, minRedeem: 1 }; // ใช้ได้ตั้งแต่ 1 แต้ม
export const pointsEarned = (paid: number) => Math.floor(paid / POINTS.bahtPerPoint);

// ระดับบัตรสมาชิก ตามแต้มที่ "สะสมมาทั้งหมด" (ใช้แต้มแลกของแล้วระดับไม่ลด)
export const TIERS = [
  { id: "culinary", name: "Culinary", th: "สมาชิก", from: 0 },
  { id: "premium", name: "Premium", th: "พรีเมียม", from: 100 },
  { id: "ceremonial", name: "Ceremonial", th: "เซเรโมเนียล", from: 300 },
] as const;
export type Tier = (typeof TIERS)[number];
export function tierOf(earned: number) {
  let i = 0;
  while (i + 1 < TIERS.length && earned >= TIERS[i + 1].from) i++;
  return { tier: TIERS[i], next: TIERS[i + 1] ?? null };
}

// ชวนเพื่อน: ได้แต้มเมื่อร้านยืนยันการจ่ายออเดอร์แรกของเพื่อน (ตั้ง 0 = ไม่ให้)
export const REFERRAL = { referrerPoints: 20, friendPoints: 20 };
