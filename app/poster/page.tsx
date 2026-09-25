import type { Metadata } from "next";
import { orderQrSvg, orderUrl } from "@/lib/qr";
import Icon from "../Icon";
import Seal from "../Seal";
import PosterCups from "./PosterCups";

export const metadata: Metadata = { title: "CODE-MACHA โปสเตอร์สแกนสั่ง" };

// โปสเตอร์ A5 สำหรับพิมพ์ตั้งเคาน์เตอร์ (เปิดหน้านี้แล้วกด Ctrl+P)
export default async function Poster() {
  const svg = await orderQrSvg();
  return (
    <main className="poster-page">
      <article className="poster">
        <header className="poster-top">
          <Seal size={54} />
          <p className="poster-jp">いらっしゃいませ</p>
          <h1>CODE-MACHA</h1>
          <p className="poster-tag">สั่งมัทฉะล่วงหน้า ไม่ต้องต่อคิว</p>
        </header>

        <div className="poster-qr">
          <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="scan">
            <span className="line-badge">LINE</span> สแกนเพื่อสั่งเลย
          </p>
        </div>

        <ol className="poster-steps">
          <li>
            <b>1</b>สแกน QR
          </li>
          <li>
            <b>2</b>เลือกเมนู &amp; เวลารับ
          </li>
          <li>
            <b>3</b>จ่ายพร้อมเพย์ แล้วมารับ
          </li>
        </ol>

        <PosterCups />
        <p className="poster-foot">
          <Icon name="gift" size={13} /> ทุก ฿25 รับ 1 แต้ม ใช้แทนเงินสดได้ · {orderUrl().replace("https://", "")}
        </p>
      </article>
    </main>
  );
}
