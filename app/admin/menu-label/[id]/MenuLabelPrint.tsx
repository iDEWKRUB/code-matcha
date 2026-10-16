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
  // cols = ดวงต่อแถวของม้วน (1 หรือ 2) · gap = ช่องว่างระหว่างดวง · edge = ขอบกระดาษรองซ้าย/ขวา (มม.)
  const [tune, setTune] = useState({ x: 0, y: 0, cols: 2, gap: 2, edge: 1 });
  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem("cupst-tune") ?? "null");
      if (t)
        setTune({
          x: Number(t.x) || 0,
          y: Number(t.y) || 0,
          cols: t.cols === 1 ? 1 : 2,
          gap: Number.isFinite(t.gap) ? t.gap : 2,
          edge: Number.isFinite(t.edge) ? t.edge : 1,
        });
    } catch {}
  }, []);
  function saveTune(t: typeof tune) {
    setTune(t);
    try {
      localStorage.setItem("cupst-tune", JSON.stringify(t));
    } catch {}
  }
  const clamp = (v: number) => Math.max(1, Math.min(MAX, Math.round(v) || 1));
  const cols = tune.cols;
  const pageW = cols === 2 ? 100 + tune.gap + tune.edge * 2 : 50;
  const rows = Math.ceil(n / cols);

  return (
    <main className="cupm-page cupst-page">
      <section className="cupm-tools nba-noprint">
        <h1>สติ๊กเกอร์ติดแก้ว 5×5 ซม. · {sticker.name}</h1>
        <div className="nba-layout" role="group" aria-label="ม้วนสติ๊กเกอร์">
          <button aria-pressed={cols === 2} onClick={() => saveTune({ ...tune, cols: 2 })}>
            ม้วน 2 ดวงคู่ (กว้าง ~10 ซม.)
          </button>
          <button aria-pressed={cols === 1} onClick={() => saveTune({ ...tune, cols: 1 })}>
            ม้วนดวงเดียว (กว้าง 5 ซม.)
          </button>
        </div>
        <p className="nba-muted">
          ตั้งขนาดกระดาษในหน้าพิมพ์เป็น <b>{pageW.toFixed(1).replace(/.0$/, "")} × 50 มม.</b> · Pages per sheet = 1 · Margins = None
          {cols === 2 && " · พิมพ์ทีละแถว แถวละ 2 ดวง"}
        </p>
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
          {cols === 2 && (
            <>
              <label>
                ช่องว่างระหว่างดวง (มม.)
                <input id="cupst-gap" type="number" step="0.5" min="0" value={tune.gap} onChange={(e) => saveTune({ ...tune, gap: Math.max(0, Number(e.target.value) || 0) })} />
              </label>
              <label>
                ขอบซ้าย/ขวาของม้วน (มม.)
                <input id="cupst-edge" type="number" step="0.5" min="0" value={tune.edge} onChange={(e) => saveTune({ ...tune, edge: Math.max(0, Number(e.target.value) || 0) })} />
              </label>
            </>
          )}
        </div>
        <div className="nba-acts">
          <button className="nba-ghost" onClick={() => window.close()}>
            ปิด
          </button>
          <button className="nba-primary" onClick={() => window.print()}>
            พิมพ์ {n} ดวง{cols === 2 ? ` (${rows} แถว)` : ""}
          </button>
        </div>
      </section>

      {/* ขนาดหน้าตามม้วนที่เลือก (Chrome ใช้ขนาดนี้ตอนพิมพ์) */}
      <style>{`@page cupsticker { size: ${pageW}mm 50mm; margin: 0; }`}</style>
      <div
        className="cupst-pages"
        style={{ "--cx": `${tune.x}mm`, "--cy": `${tune.y}mm`, "--cgap": `${tune.gap}mm`, "--cedge": `${tune.edge}mm`, "--pw": `${pageW}mm` } as React.CSSProperties}
      >
        {Array.from({ length: rows }, (_, r) => (
          <div className={`cupst-sheet${cols === 2 ? " two" : ""}`} key={r}>
            {Array.from({ length: cols }, (_, c) =>
              r * cols + c < n ? <Label key={c} s={sticker} qr={qr} /> : <span key={c} className="cupst-blank" />,
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
