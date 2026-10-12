"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { SEAL_GLYPHS } from "@/lib/cupSticker";

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
  g.strokeStyle = "#000";
  g.textBaseline = "top";
  let y = 14;
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
  const row = (l: string, rr: string, size = 21, bold = false, indent = 0) => {
    set(size, bold);
    const rw = rr ? g.measureText(rr).width : 0;
    const lines = wrap(l, W - PAD * 2 - indent - rw - 12);
    lines.forEach((t, i) => g.fillText(t, PAD + indent, y + i * (size + 5)));
    if (rr) g.fillText(rr, W - PAD - rw, y);
    y += lines.length * (size + 5) + 3;
  };
  const center = (s: string, size: number, bold = false, spacing = 0) => {
    set(size, bold);
    g.letterSpacing = `${spacing}px`;
    for (const t of wrap(s, W - PAD * 2)) {
      g.fillText(t, (W - g.measureText(t).width) / 2, y);
      y += size + 6;
    }
    g.letterSpacing = "0px";
  };
  const dash = () => {
    y += 6;
    for (let x = PAD; x < W - PAD; x += 7) g.fillRect(x, y, 4, 2);
    y += 12;
  };
  const rule = (h = 2) => {
    y += 6;
    g.fillRect(PAD, y, W - PAD * 2, h);
    y += h + 10;
  };
  const rrect = (x: number, yy: number, w: number, h: number, rad: number) => {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, yy, w, h, rad);
    else g.rect(x, yy, w, h);
  };

  // หัว: ตรา 暗号 พื้นขาว ขอบดำคู่ ตัวพู่กันสีดำ
  const S = 84, sx = (W - S) / 2;
  rrect(sx, y, S, S, 10);
  g.lineWidth = 4;
  g.stroke();
  rrect(sx + 6, y + 6, S - 12, S - 12, 6);
  g.lineWidth = 1.5;
  g.stroke();
  g.save();
  g.translate(sx, y);
  g.scale(S / 100, S / 100);
  g.fill(new Path2D(SEAL_GLYPHS));
  g.restore();
  y += S + 12;
  center("CODE-MATCHA", 30, true, 3);
  center("MATCHA | WORKING SPACE", 15, false, 3);
  center("W.Place 3 ซ.กรุงเทพนนท์ 8", 16);
  rule(3);
  row(`ใบเสร็จ ${r.no}`, "", 19);
  row(r.when, r.label ? `${r.label} · ทานที่ร้าน` : "", 19);
  dash();
  for (const i of r.items) {
    row(`${i.name}`, i.price, 22, true);
    row(`x${i.qty}${i.detail ? "  ·  " + i.detail : ""}`, "", 17, false, 14);
    y += 4;
  }
  dash();
  row("รวม", r.subtotal, 20);
  if (r.promo) row(`โค้ด ${r.promo.code}`, `-${r.promo.amount}`, 20);
  // ยอดสุทธิ: แถบดำ ตัวขาว
  y += 6;
  g.fillRect(PAD, y, W - PAD * 2, 50);
  g.fillStyle = "#fff";
  set(22, true);
  g.fillText("ยอดสุทธิ", PAD + 12, y + 13);
  set(30, true);
  const tt = `฿${r.total}`;
  g.fillText(tt, W - PAD - 12 - g.measureText(tt).width, y + 8);
  g.fillStyle = "#000";
  y += 62;
  row("ชำระโดย", r.pay, 19);
  if (r.cash) {
    row("รับเงิน", r.cash.received, 19);
    row("เงินทอน", r.cash.change, 19);
  }
  if (r.claim) {
    dash();
    const q = document.createElement("canvas");
    await QRCode.toCanvas(q, r.claim.url, { margin: 0, width: 168, errorCorrectionLevel: "M" });
    center(`สแกนรับ ${r.claim.earn} แต้มใน LINE`, 21, true);
    y += 4;
    g.drawImage(q, (W - 168) / 2, y);
    y += 176;
    center(`ใช้ได้ครั้งเดียว ภายใน ${r.claim.days} วัน · ครั้งหน้าสั่งล่วงหน้าผ่าน LINE ได้เลย`, 15);
  }
  rule(3);
  g.font = `500 21px "Yu Mincho", "Hiragino Mincho ProN", serif`;
  const jp = "ありがとうございました";
  g.fillText(jp, (W - g.measureText(jp).width) / 2, y);
  y += 30;
  center("ขอบคุณที่แวะมา CODE-MATCHA", 18);
  y += 12;

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
