// ตั้งค่าร้าน: แก้ที่นี่แล้ว deploy ใหม่
export const SHOP = {
  name: "CODE-MACHA",
  timeZone: "Asia/Bangkok",
  open: "10:30", // ช่องรับแรก
  close: "17:00", // ช่องรับสุดท้ายต้องก่อนเวลานี้
  slotMinutes: 15,
  slotCapacity: 8, // จำนวนแก้วสูงสุดต่อช่องเวลา
  leadMinutes: 10, // ต้องสั่งล่วงหน้าอย่างน้อยกี่นาที
  holdMinutes: 10, // จองเวลารับไว้ให้ระหว่างรอชำระเงินกี่นาที
};

// สะสมแต้ม: จ่ายทุก bahtPerPoint บาท ได้ 1 แต้ม, 1 แต้ม = ลด 1 บาท, ใช้ครั้งละอย่างน้อย minRedeem แต้ม
export const POINTS = { bahtPerPoint: 25, minRedeem: 50 };
export const pointsEarned = (paid: number) => Math.floor(paid / POINTS.bahtPerPoint);
