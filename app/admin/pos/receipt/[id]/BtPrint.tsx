"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

// ข้อมูลใบเสร็จสำหรับวาดลงกระดาษ 58 มม.
export type BtReceipt = {
  no: string;
  when: string;
  label: string;
  items: { name: string; qty: number; price: string; detail: string }[];
  subtotal: string;
  promo: { code: string; amount: string } | null;
  total: string;
  pay: string;
  cash: { received: string; change: string } | null;
  claim: { url: string; earn: number; days: number } | null;
  reviewUrl: string;
};

const W = 384; // หัวพิมพ์ 58 มม. = 48 มม. x 8 จุด/มม.
const PAD = 6;

// เซอร์วิส BLE ที่เครื่องพิมพ์ความร้อนจีนมักใช้ (ลองทุกตัว เจอช่องเขียนตัวแรกก็ใช้)
const SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ae30-0000-1000-8000-00805f9b34fb",
];

type Char = { properties: { write: boolean; writeWithoutResponse: boolean }; writeValue: (b: BufferSource) => Promise<void>; writeValueWithoutResponse?: (b: BufferSource) => Promise<void> };

async function drawReceipt(r: BtReceipt): Promise<HTMLCanvasElement> {
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  const c = document.createElement("canvas");
  c.width = W;
  c.height = 2400;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, W, c.height);
  g.fillStyle = "#000";
  g.textBaseline = "top";
  let y = 10;
  const set = (size: number, bold = false) => (g.font = `${bold ? 700 : 500} ${size}px ${font}`);
  // ตัดบรรทัดที่ช่องว่างก่อน (คำอังกฤษไม่ขาดกลางคำ) ถ้าคำยาวเกินบรรทัดค่อยตัดทีละตัวอักษร
  const wrap = (s: string, max: number) => {
    const out: string[] = [];
    let line = "";
    for (const word of s.split(" ").map((w, i, a) => (i < a.length - 1 ? w + " " : w))) {
      if (g.measureText(line + word).width <= max) {
        line += word;
        continue;
      }
      if (line) out.push(line.trimEnd());
      line = "";
      for (const ch of [...word]) {
        if (g.measureText(line + ch).width > max && line) {
          out.push(line);
          line = ch;
        } else line += ch;
      }
    }
    if (line.trim()) out.push(line.trimEnd());
    return out;
  };
  const row = (l: string, rr: string, size = 22, bold = false) => {
    set(size, bold);
    const rw = rr ? g.measureText(rr).width : 0;
    const lines = wrap(l, W - PAD * 2 - rw - 10);
    lines.forEach((t, i) => g.fillText(t, PAD, y + i * (size + 6)));
    if (rr) g.fillText(rr, W - PAD - rw, y);
    y += lines.length * (size + 6) + 2;
  };
  const center = (s: string, size: number, bold = false) => {
    set(size, bold);
    for (const t of wrap(s, W - PAD * 2)) {
      g.fillText(t, (W - g.measureText(t).width) / 2, y);
      y += size + 6;
    }
  };
  const hr = () => {
    y += 4;
    for (let x = PAD; x < W - PAD; x += 8) g.fillRect(x, y, 4, 2);
    y += 10;
  };
  const qr = async (url: string, title: string, sub: string) => {
    const q = document.createElement("canvas");
    await QRCode.toCanvas(q, url, { margin: 0, width: 150, errorCorrectionLevel: "M" });
    g.drawImage(q, PAD, y);
    const x = PAD + 162;
    set(20, true);
    let ty = y + 8;
    for (const t of wrap(title, W - x - PAD)) {
      g.fillText(t, x, ty);
      ty += 26;
    }
    set(16);
    for (const t of wrap(sub, W - x - PAD)) {
      g.fillText(t, x, ty);
      ty += 22;
    }
    y += Math.max(150, ty - y) + 6;
  };

  // หัว: ตรา 暗号 + ชื่อร้าน
  const s = 64;
  const sx = (W - s) / 2;
  g.beginPath();
  if (g.roundRect) g.roundRect(sx, y, s, s, 8);
  else g.rect(sx, y, s, s);
  g.fill();
  g.fillStyle = "#fff";
  g.font = `700 24px "Yu Mincho", "Hiragino Mincho ProN", serif`;
  for (const [i, ch] of ["暗", "号"].entries()) g.fillText(ch, sx + (s - g.measureText(ch).width) / 2, y + 6 + i * 28);
  g.fillStyle = "#000";
  y += s + 8;
  center("CODE-MATCHA", 28, true);
  center("Matcha & Working Space", 18);
  hr();
  row(`ใบเสร็จ ${r.no}`, "", 20);
  row(r.when, "", 20);
  if (r.label) row(`${r.label} · ทานที่ร้าน`, "", 20);
  hr();
  for (const i of r.items) {
    row(`${i.name} ×${i.qty}`, i.price, 22);
    if (i.detail) row(i.detail, "", 17);
  }
  hr();
  row("รวม", r.subtotal);
  if (r.promo) row(`โค้ด ${r.promo.code}`, `-${r.promo.amount}`);
  row("ยอดสุทธิ", `฿${r.total}`, 28, true);
  row("ชำระโดย", r.pay, 20);
  if (r.cash) {
    row("รับเงิน", r.cash.received, 20);
    row("เงินทอน", r.cash.change, 20);
  }
  if (r.claim) {
    hr();
    await qr(r.claim.url, `รับ ${r.claim.earn} แต้มใน LINE`, `ใช้ได้ครั้งเดียว ภายใน ${r.claim.days} วัน`);
  }
  if (r.reviewUrl) {
    hr();
    await qr(r.reviewUrl, "ให้คะแนนบิลนี้", "ไม่ระบุชื่อ · ทุกคะแนนเรานำไปปรับปรุง");
  }
  hr();
  center("ありがとうございました", 20);
  center("ขอบคุณที่แวะมา CODE-MATCHA", 20);
  y += 10;

  const out = document.createElement("canvas");
  out.width = W;
  out.height = Math.ceil(y);
  out.getContext("2d")!.drawImage(c, 0, 0);
  return out;
}

// แปลงภาพเป็นคำสั่ง ESC/POS (GS v 0 พิมพ์เป็นภาพขาวดำ) แบ่งทีละแถบ
function escpos(cv: HTMLCanvasElement): Uint8Array {
  const { width, height } = cv;
  const px = cv.getContext("2d")!.getImageData(0, 0, width, height).data;
  const bw = width / 8;
  const parts: number[] = [0x1b, 0x40]; // รีเซ็ตเครื่อง
  const BAND = 96;
  for (let top = 0; top < height; top += BAND) {
    const h = Math.min(BAND, height - top);
    parts.push(0x1d, 0x76, 0x30, 0, bw & 0xff, bw >> 8, h & 0xff, h >> 8);
    for (let yy = top; yy < top + h; yy++)
      for (let b = 0; b < bw; b++) {
        let v = 0;
        for (let k = 0; k < 8; k++) {
          const i = (yy * width + b * 8 + k) * 4;
          const lum = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
          if (lum < 150) v |= 0x80 >> k;
        }
        parts.push(v);
      }
  }
  parts.push(0x1b, 0x64, 4); // เลื่อนกระดาษ 4 บรรทัดให้ฉีกได้
  return Uint8Array.from(parts);
}

async function findChar(server: { getPrimaryServices: () => Promise<{ getCharacteristics: () => Promise<Char[]> }[]> }): Promise<Char | null> {
  for (const svc of await server.getPrimaryServices()) {
    for (const ch of await svc.getCharacteristics()) if (ch.properties.writeWithoutResponse || ch.properties.write) return ch;
  }
  return null;
}

// พิมพ์ใบเสร็จตรงเข้าเครื่องพิมพ์ Bluetooth 58 มม. (Chrome บน Mac/Windows/Android)
export default function BtPrint({ receipt }: { receipt: BtReceipt }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const prev = useRef<HTMLDivElement>(null);
  // เช็กในเบราว์เซอร์เท่านั้น (ฝั่งเซิร์ฟเวอร์ไม่มี navigator)
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported("bluetooth" in navigator);
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
    setMsg("เลือกเครื่องพิมพ์ในหน้าต่างที่เด้งขึ้นมา…");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bt = (navigator as any).bluetooth;
      const dev = await bt.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES });
      setMsg(`กำลังเชื่อมต่อ ${dev.name ?? "เครื่องพิมพ์"}…`);
      const server = await dev.gatt.connect();
      const ch = await findChar(server);
      if (!ch) throw new Error("เครื่องนี้ไม่เปิดช่องรับข้อมูลทาง Bluetooth แบบที่เว็บใช้ได้");
      const data = escpos(await drawReceipt(receipt));
      const CHUNK = 180;
      for (let i = 0; i < data.length; i += CHUNK) {
        const part = data.slice(i, i + CHUNK);
        if (ch.properties.writeWithoutResponse && ch.writeValueWithoutResponse) {
          await ch.writeValueWithoutResponse(part);
          await new Promise((r) => setTimeout(r, 20));
        } else await ch.writeValue(part);
        setMsg(`กำลังพิมพ์… ${Math.min(100, Math.round(((i + CHUNK) / data.length) * 100))}%`);
      }
      setMsg("ส่งเข้าเครื่องพิมพ์แล้ว");
      setTimeout(() => dev.gatt.disconnect(), 1500);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg(/cancel|chosen/i.test(m) ? "ยกเลิกการเลือกเครื่อง" : `พิมพ์ไม่สำเร็จ: ${m}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bt-box">
      <div className="bt-head">
        <b>เครื่องพิมพ์ Bluetooth 58 มม.</b>
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
