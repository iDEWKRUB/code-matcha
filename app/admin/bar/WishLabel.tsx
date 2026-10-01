// สติ๊กเกอร์อวยพร: QR (แก้ผิดได้สูง) + ตรา 暗号 กลาง QR + ชื่อร้าน · tag = ป้ายเล็กมุมบน (เช่นเลขออเดอร์ของสติ๊กเกอร์ข้อความ)
export default function WishLabel({ qr, tag }: { qr: string; tag?: string }) {
  return (
    <span className="wl">
      <span className="wl-qr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="QR คำอวยพร" />}
        <span className="wl-seal" aria-hidden="true">
          暗<br />号
        </span>
      </span>
      <b>
        CODE-MATCHA{tag && <i className="wl-tag">{tag}</i>}
      </b>
    </span>
  );
}
