import type { Metadata } from "next";
import QRCode from "qrcode";
import { isAdmin } from "@/lib/auth";
import { SHOP, pointsEarned } from "@/lib/config";
import { CLAIM_DAYS, getBill } from "@/lib/pos";
import Login from "../../../Login";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ใบเสร็จ · CODE-MATCHA", robots: { index: false } };

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (s: string) =>
  new Date(s).toLocaleString("th-TH", { timeZone: SHOP.timeZone, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

// ใบเสร็จหน้าร้าน (กระดาษม้วน 80 มม. หรือพิมพ์เป็น PDF) · มี QR ให้ลูกค้าสแกนรับแต้มใน LINE
export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }) {
  if (!(await isAdmin())) return <Login />;
  const bill = await getBill(Number((await params).id));
  if (!bill || bill.status !== "paid") return <main className="rc-page"><p>ไม่พบใบเสร็จนี้ (หรือบิลยังไม่ได้ชำระ)</p></main>;
  const orders = bill.orders.filter((o) => o.status !== "cancelled");
  const earn = pointsEarned(bill.total);
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  const claimUrl = bill.claimToken ? (liffId ? `https://liff.line.me/${liffId}/claim?t=${bill.claimToken}` : `${SHOP.siteUrl}/claim?t=${bill.claimToken}`) : "";
  const qr = claimUrl && !bill.claimedAt ? await QRCode.toString(claimUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M" }) : "";
  const no = `POS-${bill.date.slice(5).replace("-", "")}-${String(bill.id).padStart(4, "0")}`;
  const change = bill.payMethod === "cash" && bill.cashReceived != null ? bill.cashReceived - bill.total : 0;

  return (
    <main className="rc-page">
      <PrintButton auto={(await searchParams).print === "1"} />
      <article className="rc">
        <header className="rc-head">
          <span className="rc-seal">
            暗<br />号
          </span>
          <b>CODE-MATCHA</b>
          <small>Matcha &amp; Working Space</small>
        </header>
        <hr />
        <div className="rc-row">
          <span>ใบเสร็จ {no}</span>
          <span>{when(bill.paidAt!)}</span>
        </div>
        {bill.label && (
          <div className="rc-row">
            <span>{bill.label} · ทานที่ร้าน</span>
          </div>
        )}
        <hr />
        {orders.flatMap((o) =>
          o.items.map((i, k) => (
            <div key={`${o.id}-${k}`} className="rc-item">
              <div className="rc-row">
                <span>
                  {i.name} ×{i.qty}
                </span>
                <span>{baht(i.price)}</span>
              </div>
              {i.detail && <small>{i.detail}</small>}
            </div>
          )),
        )}
        <hr />
        <div className="rc-row">
          <span>รวม</span>
          <span>{baht(bill.subtotal)}</span>
        </div>
        {bill.promoDiscount > 0 && (
          <div className="rc-row">
            <span>โค้ด {bill.promoCode}</span>
            <span>−{baht(bill.promoDiscount)}</span>
          </div>
        )}
        <div className="rc-row rc-total">
          <span>ยอดสุทธิ</span>
          <span>฿{baht(bill.total)}</span>
        </div>
        <div className="rc-row">
          <span>ชำระโดย</span>
          <span>{bill.payMethod === "cash" ? "เงินสด" : "พร้อมเพย์ QR"}</span>
        </div>
        {bill.payMethod === "cash" && bill.cashReceived != null && (
          <>
            <div className="rc-row">
              <span>รับเงิน</span>
              <span>{baht(bill.cashReceived)}</span>
            </div>
            <div className="rc-row">
              <span>เงินทอน</span>
              <span>{baht(change)}</span>
            </div>
          </>
        )}
        {qr && earn > 0 && (
          <>
            <hr />
            <div className="rc-claim">
              <span className="rc-qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <span>
                <b>สแกนรับ {earn} แต้ม ใน LINE</b>
                <small>
                  ใช้ได้ครั้งเดียว ภายใน {CLAIM_DAYS} วัน · ครั้งหน้าสั่งล่วงหน้าผ่าน LINE ได้เลย
                </small>
              </span>
            </div>
          </>
        )}
        <hr />
        <p className="rc-jp">ありがとうございました</p>
        <p className="rc-thanks">ขอบคุณที่แวะมา CODE-MATCHA</p>
      </article>
    </main>
  );
}
