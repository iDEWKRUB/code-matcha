"use client";

import { useEffect, useMemo, useState } from "react";
import { POINTS } from "@/lib/config";
import { powderExtra, type MenuItem, type Powder } from "@/lib/menu";
import PowderThumb, { powderTone } from "../../PowderThumb";
import Seal from "../../Seal";

type Saved = { order: string[]; hidden: string[]; title: string; note: string };
const KEY = "menu-board-v1";
const DEFAULT_TITLE = "Matcha Menu";
const DEFAULT_NOTE = "ราคานี้ยังไม่รวมนมทางเลือกและท็อปปิ้ง";

// ลำดับตั้งต้น: เมนูแนะนำก่อน แล้วตามลำดับในร้าน
const byShop = (a: MenuItem, b: MenuItem) => Number(b.recommended) - Number(a.recommended) || a.sort - b.sort;

export default function MenuBoard({ menu, powders, qr }: { menu: MenuItem[]; powders: Powder[]; qr: string }) {
  const [order, setOrder] = useState<string[]>(() => [...menu].sort(byShop).map((m) => m.id));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [ready, setReady] = useState(false);

  // จำลำดับ/เมนูที่ซ่อนไว้ในเครื่องนี้ (เมนูใหม่ต่อท้าย เมนูที่ถูกลบหายไปเอง)
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
      if (s) {
        const ids = new Set(menu.map((m) => m.id));
        const kept = s.order.filter((id) => ids.has(id));
        const added = [...menu].sort(byShop).map((m) => m.id).filter((id) => !kept.includes(id));
        setOrder([...kept, ...added]);
        setHidden(new Set(s.hidden.filter((id) => ids.has(id))));
        setTitle(s.title || DEFAULT_TITLE);
        setNote(s.note ?? DEFAULT_NOTE);
      }
    } catch {}
    setReady(true);
  }, [menu]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ order, hidden: [...hidden], title, note } satisfies Saved));
    } catch {}
  }, [order, hidden, title, note, ready]);

  const byId = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  const rows = order.map((id) => byId.get(id)).filter((m): m is MenuItem => !!m);
  const shown = rows.filter((m) => !hidden.has(m.id));

  function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  }
  function toggle(id: string) {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setHidden(next);
  }
  function reset() {
    setOrder([...menu].sort(byShop).map((m) => m.id));
    setHidden(new Set());
    setTitle(DEFAULT_TITLE);
    setNote(DEFAULT_NOTE);
  }

  return (
    <div className="fm-page">
      <aside className="fm-tools">
        <a className="fm-back" href="/admin">
          ← กลับหลังร้าน
        </a>
        <h1>เมนูหน้าร้าน</h1>
        <p className="fm-hint">เรียงลำดับด้วยลูกศร ติ๊กออกเพื่อไม่พิมพ์เมนูนั้น แล้วกดพิมพ์ (A4 แนวตั้ง) · ระบบจำลำดับไว้ในเครื่องนี้</p>
        <label className="fm-field">
          หัวข้อ
          <input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="fm-field">
          หมายเหตุท้ายเมนู
          <input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
        </label>
        <ol className="fm-list">
          {rows.map((m, i) => (
            <li key={m.id} className={hidden.has(m.id) ? "off" : ""}>
              <span className="fm-arrows">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`เลื่อน ${m.name} ขึ้น`}>
                  ▲
                </button>
                <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`เลื่อน ${m.name} ลง`}>
                  ▼
                </button>
              </span>
              <label>
                <input type="checkbox" checked={!hidden.has(m.id)} onChange={() => toggle(m.id)} />
                <span>{m.name}</span>
              </label>
            </li>
          ))}
        </ol>
        <div className="fm-acts">
          <button className="fm-ghost" onClick={reset}>
            เรียงแบบเดิม
          </button>
          <button className="fm-print" onClick={() => window.print()} disabled={!shown.length}>
            พิมพ์เมนู
          </button>
        </div>
      </aside>

      <article className="fm-sheet" aria-label="ตัวอย่างเมนูที่จะพิมพ์">
        <header className="fm-head">
          <Seal size={58} />
          <div>
            <p className="fm-jp">いらっしゃいませ</p>
            <h2>CODE-MATCHA</h2>
            <p className="fm-title">{title}</p>
          </div>
        </header>

        <table className="fm-table">
          <thead>
            <tr>
              <th className="fm-menu-h">เมนู</th>
              {powders.map((p) => (
                <th key={p.id}>
                  <span className="fm-pw">
                    <PowderThumb powder={p} tone={powderTone(p, powders)} size={44} />
                    <b>{p.name}</b>
                    {p.note && <small>{p.note}</small>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.id}>
                <td className="fm-name">
                  {m.jp && <small>{m.jp}</small>}
                  <b>
                    {m.name}
                    {m.recommended && <em>แนะนำ</em>}
                  </b>
                </td>
                {powders.map((p) => (
                  <td key={p.id} className="fm-price">
                    {m.price + powderExtra(m, p)}
                    <span>฿</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="fm-foot">
          <div>
            {note && <p>{note}</p>}
            <p>
              สั่งผ่าน LINE ได้แต้มสะสม ทุก ฿{POINTS.bahtPerPoint} = 1 แต้ม · สแกน QR เพื่อสั่งล่วงหน้า
            </p>
          </div>
          <div className="fm-qr" dangerouslySetInnerHTML={{ __html: qr }} />
        </footer>
      </article>
    </div>
  );
}
