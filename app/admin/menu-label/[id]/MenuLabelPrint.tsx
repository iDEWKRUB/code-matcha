"use client";

import { useEffect, useState } from "react";
import { SEAL_GLYPHS, type CupSticker } from "@/lib/cupSticker";

const MAX = 50;

// ตรา 暗号 หมึกดำ (เส้นพร้อมพิมพ์)
function Seal({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="2" y="2" width="96" height="96" rx="12" fill="#000" />
      <rect x="7" y="7" width="86" height="86" rx="8" fill="none" stroke="#fff" strokeWidth="2.4" />
      <path d={SEAL_GLYPHS} fill="#fff" />
    </svg>
  );
}

function Label({ s, qr }: { s: CupSticker; qr: string }) {
  return (
    <div className="cupst">
      <b className="cupst-name">{s.name}</b>
      {s.jp && <span className="cupst-jp">{s.jp}</span>}
      {s.desc && <span className="cupst-desc">{s.desc}</span>}
      <span className="cupst-foot">
        <span className="cupst-brand">
          <Seal className="cupst-seal" />
          <span>
            <b>CODE-MATCHA</b>
            <small>
              <i aria-hidden="true" />
              {s.tag}
            </small>
          </span>
        </span>
        <span className="cupst-qr">
          <span className="cupst-qrw">
            <span dangerouslySetInnerHTML={{ __html: qr }} />
            <Seal className="cupst-qseal" />
          </span>
          <small>scan for a wish</small>
        </span>
      </span>
    </div>
  );
}

// เลื่อนตำแหน่งดวงได้ (จำไว้ในเครื่องนี้) เผื่อเครื่องพิมพ์วางดวงเหลื่อม
export default function MenuLabelPrint({ sticker, qr }: { sticker: CupSticker; qr: string }) {
  const [n, setN] = useState(1);
  const [tune, setTune] = useState({ x: 0, y: 0 });
  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem("cupst-tune") ?? "null");
      if (t) setTune({ x: Number(t.x) || 0, y: Number(t.y) || 0 });
    } catch {}
  }, []);
  function saveTune(t: { x: number; y: number }) {
    setTune(t);
    try {
      localStorage.setItem("cupst-tune", JSON.stringify(t));
    } catch {}
  }
  const clamp = (v: number) => Math.max(1, Math.min(MAX, Math.round(v) || 1));

  return (
    <main className="cupm-page cupst-page">
      <section className="cupm-tools nba-noprint">
        <h1>สติ๊กเกอร์ติดแก้ว 5×5 ซม. · {sticker.name}</h1>
        <p className="nba-muted">พิมพ์ด้วยเครื่องพิมพ์สติ๊กเกอร์ (หมึกดำ) · 1 ดวงต่อหน้า · ตั้งขนาดกระดาษในเครื่องพิมพ์เป็น 50 × 50 มม. ระยะขอบ 0</p>
        <div className="cupst-count" role="group" aria-label="จำนวนดวง">
          <button type="button" onClick={() => setN(clamp(n - 1))} aria-label="ลดจำนวน">
            −
          </button>
          <label>
            <input id="cupst-n" inputMode="numeric" value={n} onChange={(e) => setN(clamp(Number(e.target.value.replace(/\D/g, ""))))} />
            ดวง
          </label>
          <button type="button" onClick={() => setN(clamp(n + 1))} aria-label="เพิ่มจำนวน">
            +
          </button>
          {[5, 10, 20].map((k) => (
            <button type="button" key={k} className="cupst-quick" aria-pressed={n === k} onClick={() => setN(k)}>
              {k}
            </button>
          ))}
        </div>
        <div className="nba-tune">
          <label>
            เลื่อนซ้าย/ขวา (มม.)
            <input id="cupst-x" type="number" step="0.5" value={tune.x} onChange={(e) => saveTune({ ...tune, x: Number(e.target.value) || 0 })} />
          </label>
          <label>
            เลื่อนขึ้น/ลง (มม.)
            <input id="cupst-y" type="number" step="0.5" value={tune.y} onChange={(e) => saveTune({ ...tune, y: Number(e.target.value) || 0 })} />
          </label>
        </div>
        <div className="nba-acts">
          <button className="nba-ghost" onClick={() => window.close()}>
            ปิด
          </button>
          <button className="nba-primary" onClick={() => window.print()}>
            พิมพ์ {n} ดวง
          </button>
        </div>
      </section>

      <div className="cupst-pages" style={{ "--cx": `${tune.x}mm`, "--cy": `${tune.y}mm` } as React.CSSProperties}>
        {Array.from({ length: n }, (_, i) => (
          <div className="cupst-sheet" key={i}>
            <Label s={sticker} qr={qr} />
          </div>
        ))}
      </div>
    </main>
  );
}
