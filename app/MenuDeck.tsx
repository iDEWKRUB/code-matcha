"use client";

import { useEffect, useRef, useState } from "react";
import type { MenuItem } from "@/lib/menu";
import MenuArt, { artTint } from "./MenuArt";

export type DeckGroup = { id: string; label: string; items: MenuItem[] };

const STEP = 112; // ระยะห่างการ์ดแต่ละใบ (px)

// เลือกเมนูแบบการ์ดสไลด์: ปัดซ้าย-ขวา ใบกลางเรืองแสง · แตะการ์ด/กดปุ่ม = เปิดหน้าตัวเลือกเดิม
// ไม่มีลากลง: ใน LINE การลากลงคือท่าปิดหน้าเว็บ (ลากแนวตั้งปล่อยให้เลื่อนหน้าตามปกติ)
// มีรูปจริงใช้รูปจริง ไม่มีรูปใช้การ์ตูน · เมนูหมดเป็นสีเทาเลือกไม่ได้
export default function MenuDeck({
  groups,
  count,
  onPick,
  onShowAll,
}: {
  groups: DeckGroup[];
  count: (id: string) => number; // จำนวนแก้วในตะกร้า (โชว์ป้ายบนการ์ด)
  onPick: (m: MenuItem) => void;
  onShowAll: () => void;
}) {
  const [g, setG] = useState(groups[0]?.id ?? "");
  const group = groups.find((x) => x.id === g) ?? groups[0];
  const list = group?.items ?? [];
  const [cur, setCur] = useState(0);
  const [drag, setDrag] = useState<number | null>(null); // ระยะลากแนวนอน (px)
  const start = useRef<{ x: number; y: number; mode: "x" | "y" | null; id: number } | null>(null);

  // เปลี่ยนหมวด: เริ่มที่ใบที่ 2 (มีการ์ดทั้งสองข้าง) หรือใบแรกถ้ามีใบเดียว
  useEffect(() => {
    setCur(Math.min(1, Math.max(0, list.length - 1)));
  }, [g, list.length]);

  if (!group || !list.length) return null;
  const at = Math.min(cur, list.length - 1);
  const m = list[at];
  const go = (i: number) => setCur((i + list.length) % list.length);
  const pick = (it: MenuItem) => {
    if (it.available) onPick(it);
  };

  function down(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest(".dk-arrow")) return;
    start.current = { x: e.clientX, y: e.clientY, mode: null, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

  }
  function move(e: React.PointerEvent) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.mode && Math.hypot(dx, dy) > 8) s.mode = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (s.mode === "x") setDrag(dx);
  }
  function up(e: React.PointerEvent) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    setDrag(null);
    const dx = e.clientX - s.x;
    if (s.mode === "x" && Math.abs(dx) > 40) return go(at + (dx < 0 ? 1 : -1));
    if (!s.mode) {
      const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
      if (hit) {
        const i = Number(hit.dataset.i);
        if (i === at) pick(m);
        else go(i);
      }
    }
  }

  const f = drag ? -drag / STEP : 0;
  return (
    <section className="dk" aria-label="เลือกเมนู">
      <h2 className="dk-q">วันนี้เลือกแก้วไหนดี?</h2>
      {groups.length > 1 && (
        <div className="dk-tabs" role="group" aria-label="หมวดเมนู">
          {groups.map((x) => (
            <button key={x.id} type="button" aria-pressed={x.id === group.id} onClick={() => setG(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      )}
      <div
        className={`dk-deck${drag ? " drag" : ""}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(at - 1);
          if (e.key === "ArrowRight") go(at + 1);
          if (e.key === "Enter") pick(m);
        }}
        aria-roledescription="carousel"
      >
        {list.map((it, i) => {
          const d = i - at - f, a = Math.abs(d), on = i === at;
          const n = count(it.id);
          const photo = it.photoUrl && it.kind !== "food";
          return (
            <div
              key={it.id}
              data-i={i}
              className={`dk-card${a < 0.5 ? " on" : ""}${it.available ? "" : " out"}`}
              style={{
                transform: `translateX(${d * STEP}px) translateY(${a * 14}px) translateZ(${-a * 110}px) rotateY(${-d * 16}deg)`,
                opacity: a > 2.4 ? 0 : 1 - a * 0.25,
                zIndex: 10 - Math.round(a),
              }}
              aria-hidden={!on}
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.photoUrl!} alt={it.name} draggable={false} loading={a < 2 ? "eager" : "lazy"} />
              ) : (
                <span className="dk-toon" style={{ "--tint": artTint(it) } as React.CSSProperties}>
                  <MenuArt item={it} size={120} />
                </span>
              )}
              <span className="dk-price">
                {it.promoPrice !== null ? (
                  <>
                    <s>฿{it.price}</s> ฿{it.promoPrice}
                  </>
                ) : (
                  <>฿{it.price}</>
                )}
              </span>
              {it.recommended && <span className="dk-flag">แนะนำ</span>}
              {n > 0 && <span className="dk-n">{n}</span>}
              {!it.available && <span className="dk-out">หมดวันนี้</span>}
            </div>
          );
        })}
        {list.length > 1 && (
          <>
            <button type="button" className="dk-arrow prev" aria-label="แก้วก่อนหน้า" onClick={() => go(at - 1)}>
              ‹
            </button>
            <button type="button" className="dk-arrow next" aria-label="แก้วถัดไป" onClick={() => go(at + 1)}>
              ›
            </button>
          </>
        )}
      </div>
      <div className="dk-info" aria-live="polite">
        <small>{m.jp}</small>
        <b>
          {m.name} · ฿{m.promoPrice ?? m.price}
        </b>
        {m.description && <p>{m.description}</p>}
      </div>
      {list.length > 1 && (
        <div className="dk-dots" aria-hidden="true">
          {list.map((it, i) => (
            <i key={it.id} className={i === at ? "on" : undefined} />
          ))}
        </div>
      )}
      <button type="button" className="dk-pick" onClick={() => pick(m)} disabled={!m.available}>
        {m.available ? "เลือกแก้วนี้" : "หมดวันนี้"}
      </button>
      <button type="button" className="dk-all" onClick={onShowAll}>
        ดูเมนูทั้งหมด ({groups.reduce((s, x) => s + x.items.length, 0)})
      </button>
    </section>
  );
}
