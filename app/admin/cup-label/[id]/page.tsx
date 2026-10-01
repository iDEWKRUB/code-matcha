import type { Metadata } from "next";
import QRCode from "qrcode";
import { isAdmin } from "@/lib/auth";
import { SHOP } from "@/lib/config";
import { db } from "@/lib/supabase";
import Login from "../../Login";
import CupLabelPrint from "./CupLabelPrint";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สติ๊กเกอร์ข้อความบนแก้ว · CODE-MATCHA", robots: { index: false } };

// พิมพ์สติ๊กเกอร์ QR ข้อความบนแก้วของออเดอร์เดียว (ม้วน Sbarco 3 ดวงต่อแถว เหมือนสติ๊กเกอร์อวยพร)
export default async function CupLabelPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return <Login />;
  const { data } = await db()
    .from("orders")
    .select("daily_no,cup_msg,cup_to,cup_token")
    .eq("id", Number((await params).id))
    .maybeSingle();
  if (!data?.cup_token || !data.cup_msg)
    return (
      <main className="cupm-page">
        <p>ออเดอร์นี้ไม่มีข้อความบนแก้ว</p>
      </main>
    );
  const opts = { margin: 1, width: 480, errorCorrectionLevel: "H" } as const;
  const [qr, wishQr] = await Promise.all([
    QRCode.toDataURL(`${SHOP.siteUrl}/gift?t=${data.cup_token}`, opts),
    QRCode.toDataURL(`${SHOP.siteUrl}/gift`, opts),
  ]);
  return (
    <CupLabelPrint
      no={data.daily_no}
      qr={qr}
      wishQr={wishQr}
      forCup={data.cup_to ?? ""}
    />
  );
}
