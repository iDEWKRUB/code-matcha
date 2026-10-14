import type { Metadata } from "next";
import { RECEIPT } from "@/lib/config";
import { orderBtReceipt, receiptIdFromKey, receiptOrder } from "@/lib/orderReceipt";
import { getWifi } from "@/lib/receipt";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ใบเสร็จ · CODE-MATCHA", robots: { index: false, follow: false } };

// ใบเสร็จออนไลน์ของออเดอร์ที่สั่งผ่าน LINE (เปิดจากปุ่มในการ์ด LINE / บัตรสมาชิก)
export default async function OrderReceiptPage({ params }: { params: Promise<{ key: string }> }) {
  const id = receiptIdFromKey((await params).key);
  const order = id ? await receiptOrder(id) : null;
  if (!order)
    return (
      <main className="rc-page">
        <p className="rc-miss">ไม่พบใบเสร็จนี้ · ลิงก์อาจไม่ถูกต้อง หรือออเดอร์ยังไม่ได้ชำระ</p>
      </main>
    );
  const r = orderBtReceipt(order, await getWifi());

  return (
    <main className="rc-page">
      <p className="rc-hint">กดค้างหรือแคปหน้าจอเพื่อเก็บใบเสร็จไว้ได้</p>
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
          <span>ใบเสร็จ {r.no}</span>
          <span>{r.when}</span>
        </div>
        <div className="rc-row">
          <span>{r.label}</span>
        </div>
        <hr />
        {r.items.map((i, k) => (
          <div key={k} className="rc-item">
            <div className="rc-row">
              <span>
                {i.name} ×{i.qty}
              </span>
              <span>{i.price}</span>
            </div>
            {i.detail && <small>{i.detail}</small>}
          </div>
        ))}
        <hr />
        <div className="rc-row">
          <span>รวม</span>
          <span>{r.subtotal}</span>
        </div>
        {r.promo && (
          <div className="rc-row">
            <span>โค้ด {r.promo.code}</span>
            <span>−{r.promo.amount}</span>
          </div>
        )}
        {(r.adjust ?? []).map((a) => (
          <div key={a.label} className="rc-row">
            <span>{a.label}</span>
            <span>−{a.amount}</span>
          </div>
        ))}
        <div className="rc-row rc-total">
          <span>ยอดสุทธิ</span>
          <span>฿{r.total}</span>
        </div>
        <div className="rc-row">
          <span>ชำระโดย</span>
          <span>{r.pay}</span>
        </div>
        <hr />
        {r.wifi && (
          <div className="rc-wifi">
            <b>Wi-Fi</b>
            <span>ชื่อ: {r.wifi.ssid}</span>
            {r.wifi.pass && <span>รหัส: {r.wifi.pass}</span>}
          </div>
        )}
        <p className="rc-note-h">{RECEIPT.noticeTitle}</p>
        <p className="rc-note">{RECEIPT.notice}</p>
        <hr />
        <p className="rc-jp">ありがとうございました</p>
        <p className="rc-thanks">ขอบคุณที่อุดหนุน CODE-MATCHA</p>
      </article>
    </main>
  );
}
