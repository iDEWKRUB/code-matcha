import type { Metadata } from "next";
import QRCode from "qrcode";
import { isAdmin } from "@/lib/auth";
import { SHOP } from "@/lib/config";
import { cupSticker } from "@/lib/cupSticker";
import { getMenu } from "@/lib/orders";
import Login from "../../Login";
import MenuLabelPrint from "./MenuLabelPrint";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สติ๊กเกอร์แก้ว · CODE-MATCHA", robots: { index: false } };

// พิมพ์สติ๊กเกอร์ติดแก้ว 5x5 ซม. ของเมนูเดียว (1 ดวงต่อหน้า) · QR = หน้าคำอวยพร
export default async function MenuLabelPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return <Login />;
  const id = (await params).id;
  const item = (await getMenu()).find((m) => m.id === id);
  if (!item)
    return (
      <main className="cupm-page">
        <p>ไม่พบเมนูนี้</p>
      </main>
    );
  const qr = await QRCode.toString(`${SHOP.siteUrl}/gift`, { type: "svg", margin: 0, errorCorrectionLevel: "H", color: { dark: "#000000", light: "#ffffff" } });
  return <MenuLabelPrint sticker={cupSticker(item)} qr={qr} />;
}
