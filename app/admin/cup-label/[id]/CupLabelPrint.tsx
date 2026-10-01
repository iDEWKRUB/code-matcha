"use client";

import { useEffect, useState } from "react";
import WishLabel from "../../bar/WishLabel";

type Dir = "h" | "v" | "v2";

// ใช้ค่าตำแหน่ง/ทิศเดียวกับหน้าพิมพ์สติ๊กเกอร์ในมาม่าบาร์ (จำไว้ในเครื่องนี้)
export default function CupLabelPrint(p: { no: number; qr: string; wishQr: string; cups: number; forCup: string }) {
  const [copies, setCopies] = useState(1);
  // ดวงที่เหลือในแถว: เติมสติ๊กเกอร์อวยพรทั่วไป (ใช้ติดแก้วอื่นได้) หรือเว้นว่าง
  const [fill, setFill] = useState(true);
  const [dir, setDir] = useState<Dir>("h");
  const [tune, setTune] = useState({ x: 0, y: 0, gap: 3 });
  useEffect(() => {
    try {
      const d = localStorage.getItem("adm-wish-dir");
      if (d === "v" || d === "v2") setDir(d);
      const t = JSON.parse(localStorage.getItem("adm-sticker-tune") ?? "null");
      if (t) setTune({ x: Number(t.x) || 0, y: Number(t.y) || 0, gap: Number.isFinite(t.gap) ? t.gap : 3 });
      if (localStorage.getItem("cupm-fill") === "0") setFill(false);
    } catch {}
  }, []);
  function pickDir(d: Dir) {
    setDir(d);
    try {
      localStorage.setItem("adm-wish-dir", d);
    } catch {}
  }
  function pickFill(f: boolean) {
    setFill(f);
    try {
      localStorage.setItem("cupm-fill", f ? "1" : "0");
    } catch {}
  }

  const rows = Math.ceil(copies / 3);
  const tag = `#${p.no}`;

  return (
    <main className="cupm-page">
      <section className="cupm-tools nba-noprint">
        <h1>สติ๊กเกอร์ข้อความบนแก้ว · ออเดอร์ {tag}</h1>
        {p.forCup && (
          <p className="cupm-for">
            ลูกค้าให้ติดที่: <b>{p.forCup}</b>
          </p>
        )}
        <p className="nba-muted">ข้อความของลูกค้าถูกเข้ารหัส ร้านมองไม่เห็น · ติดดวงที่มีเลข {tag} บนแก้วของออเดอร์นี้ คนได้แก้วสแกนแล้วข้อความจะขึ้นพร้อมน้องมัทฉะ</p>
        <div className="cupm-row">
          <label>
            จำนวนดวง
            <input type="number" min={1} max={9} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(9, Number(e.target.value) || 1)))} />
          </label>
          {p.cups > 1 && copies < p.cups && (
            <button className="nba-ghost" onClick={() => setCopies(Math.min(9, p.cups))}>
              ให้ครบ {p.cups} แก้ว
            </button>
          )}
        </div>
        <div className="nba-layout" role="group" aria-label="ทิศสติ๊กเกอร์">
          <button aria-pressed={dir === "h"} onClick={() => pickDir("h")}>
            แนวนอน
          </button>
          <button aria-pressed={dir === "v"} onClick={() => pickDir("v")}>
            แนวตั้ง (หมุนซ้าย)
          </button>
          <button aria-pressed={dir === "v2"} onClick={() => pickDir("v2")}>
            แนวตั้ง (หมุนขวา)
          </button>
        </div>
        {copies % 3 !== 0 && (
          <div className="nba-layout" role="group" aria-label="ดวงที่เหลือในแถว">
            <button aria-pressed={fill} onClick={() => pickFill(true)}>
              ดวงที่เหลือ: QR อวยพรทั่วไป
            </button>
            <button aria-pressed={!fill} onClick={() => pickFill(false)}>
              เว้นว่าง
            </button>
          </div>
        )}
        <div className="nba-acts">
          <button className="nba-ghost" onClick={() => window.close()}>
            ปิด
          </button>
          <button className="nba-primary" onClick={() => window.print()}>
            พิมพ์ {rows} แถว
          </button>
        </div>
        <p className="nba-muted">ตั้งตำแหน่งดวง (เลื่อนซ้าย/ขวา, ระยะห่าง) ได้ที่ มาม่าบาร์ › สติ๊กเกอร์ QR · หน้านี้ใช้ค่าเดียวกัน</p>
      </section>

      <div
        className="nbs-roll"
        aria-label="ตัวอย่างสติ๊กเกอร์ม้วน"
        style={{ "--lx": `${tune.x}mm`, "--ly": `${tune.y}mm`, "--gx": `${tune.gap}mm` } as React.CSSProperties}
      >
        {Array.from({ length: rows }, (_, r) => (
          <div className="nbs-row" key={r}>
            {[0, 1, 2].map((c) => {
              const k = r * 3 + c;
              if (k < copies)
                return (
                  <div className={`nbs-lb wish ${dir}`} key={c}>
                    <WishLabel qr={p.qr} tag={tag} />
                  </div>
                );
              return fill ? (
                <div className={`nbs-lb wish ${dir}`} key={c}>
                  <WishLabel qr={p.wishQr} />
                </div>
              ) : (
                <div className="nbs-lb empty" key={c} />
              );
            })}
          </div>
        ))}
      </div>
    </main>
  );
}
