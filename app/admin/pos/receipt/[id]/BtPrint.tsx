"use client";

import { useEffect, useRef, useState } from "react";
import { btSupported, drawReceipt, onPrinter, printErr, printReceipt, type BtReceipt, type PrinterState } from "@/lib/btPrinter";

// พิมพ์ใบเสร็จตรงเข้าเครื่องพิมพ์ Bluetooth 58 มม. (Chrome บน Mac/Windows/Android)
export default function BtPrint({ receipt }: { receipt: BtReceipt }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pr, setPr] = useState<PrinterState>({ name: "", connected: false });
  const prev = useRef<HTMLDivElement>(null);
  // เช็กในเบราว์เซอร์เท่านั้น (ฝั่งเซิร์ฟเวอร์ไม่มี navigator)
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(btSupported());
    return onPrinter(setPr);
  }, []);

  useEffect(() => {
    document.fonts.ready
      .then(() => drawReceipt(receipt))
      .then((cv) => {
        if (!prev.current) return;
        cv.className = "bt-prev";
        prev.current.replaceChildren(cv);
      })
      .catch((e) => setMsg(`วาดตัวอย่างไม่สำเร็จ: ${e instanceof Error ? e.message : e}`));
  }, [receipt]);

  async function print() {
    setBusy(true);
    setMsg(pr.name ? "กำลังพิมพ์…" : "เลือกเครื่องพิมพ์ในหน้าต่างที่เด้งขึ้นมา…");
    try {
      await printReceipt(receipt, (p) => setMsg(`กำลังพิมพ์… ${p}%`));
      setMsg("ส่งเข้าเครื่องพิมพ์แล้ว");
    } catch (e) {
      setMsg(printErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bt-box">
      <div className="bt-head">
        <b>เครื่องพิมพ์ Bluetooth 58 มม.{pr.connected && <small className="bt-on"> · เชื่อมแล้ว {pr.name}</small>}</b>
        <button className="bt-btn" onClick={print} disabled={busy || !supported}>
          {busy ? "กำลังพิมพ์…" : "พิมพ์ผ่าน Bluetooth"}
        </button>
      </div>
      {!supported && <p className="bt-msg bt-warn">เบราว์เซอร์นี้ใช้ Bluetooth ไม่ได้ (Safari / iPhone ใช้ไม่ได้) · เปิดหน้านี้ด้วย Google Chrome บน Mac / Windows / Android</p>}
      {msg && <p className="bt-msg">{msg}</p>}
      <p className="bt-msg">ตัวอย่างที่จะพิมพ์ (กว้าง 58 มม.)</p>
      <div ref={prev} className="bt-prev-wrap" />
    </section>
  );
}
