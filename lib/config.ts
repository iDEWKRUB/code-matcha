// ตั้งค่าร้าน: แก้ที่นี่แล้ว deploy ใหม่
export const SHOP = {
  name: "CODE-MACHA",
  timeZone: "Asia/Bangkok",
  // เวลาเปิด-ปิด ระยะห่างรอบ และแก้วต่อรอบ ตั้งได้ในหน้าบาริสต้า > ตั้งค่าร้าน (ตาราง shop_settings)
  siteUrl: "https://code-matcha.vercel.app", // ใช้ในปุ่มของการ์ด LINE
  lineOaId: "@745plqxi", // LINE OA ของร้าน (ลูกค้าต้องเป็นเพื่อนถึงจะได้รับแจ้งเตือน)
  leadMinutes: 10, // ต้องสั่งล่วงหน้าอย่างน้อยกี่นาที
  holdMinutes: 10, // จองเวลารับไว้ให้ระหว่างรอชำระเงินกี่นาที
};

// สะสมแต้ม: จ่ายทุก bahtPerPoint บาท ได้ 1 แต้ม, 1 แต้ม = ลด 1 บาท, ใช้ครั้งละอย่างน้อย minRedeem แต้ม
export const POINTS = { bahtPerPoint: 25, minRedeem: 50 };
export const pointsEarned = (paid: number) => Math.floor(paid / POINTS.bahtPerPoint);
