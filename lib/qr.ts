import "server-only";
import QRCode from "qrcode";

// ลิงก์เปิดหน้าสั่งใน LINE (สแกนด้วยกล้องมือถือแล้วเด้งเข้า LINE)
export const orderUrl = () => {
  const id = process.env.NEXT_PUBLIC_LIFF_ID;
  return id ? `https://liff.line.me/${id}` : "https://code-matcha.vercel.app/";
};

export const orderQrSvg = () =>
  QRCode.toString(orderUrl(), { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1c2419", light: "#ffffff" } });
