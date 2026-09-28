"use client";

import { useState } from "react";
import type { MenuItem } from "@/lib/menu";
import MenuArt, { artTint } from "../MenuArt";

type Props = {
  menu: MenuItem[];
  setMenu: (m: MenuItem[]) => void;
  reload: () => void;
  onError: (msg: string) => void;
};

export function Price({ item }: { item: MenuItem }) {
  return item.promoPrice !== null ? (
    <span className="price">
      <s>฿{item.price}</s> <b className="promo">฿{item.promoPrice}</b>
    </span>
  ) : (
    <span className="price">
      <b>฿{item.price}</b>
    </span>
  );
}

type Patch = Partial<Pick<MenuItem, "available" | "hidden">>;

export default function MenuTab({ menu, setMenu, reload, onError }: Props) {
  const [busy, setBusy] = useState(false);

  // อัปเดตหลายเมนูพร้อมกัน (แสดงผลทันที แล้วบันทึกทีละเมนู)
  async function update(changes: { m: MenuItem; patch: Patch }[]) {
    if (!changes.length) return;
    setMenu(menu.map((x) => ({ ...x, ...changes.find((c) => c.m.id === x.id)?.patch })));
    setBusy(true);
    const results = await Promise.all(
      changes.map(({ m, patch }) =>
        fetch(`/api/admin/menu/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).then((r) => r.ok),
      ),
    );
    setBusy(false);
    if (results.some((ok) => !ok)) onError("บันทึกสถานะเมนูไม่สำเร็จ");
    reload();
  }

  const shown = menu.filter((m) => !m.hidden);
  const selling = shown.filter((m) => m.available).length;
  const soldOutShown = shown.filter((m) => !m.available);
  const hidden = menu.filter((m) => m.hidden);

  return (
    <>
      <div className="menu-lead">
        <p className="lead">
          ลูกค้าเห็น <b>{shown.length}</b> เมนู (มีขาย {selling}) · ซ่อนอยู่ {hidden.length} เมนู
          <br />
          <small>
            <b>หมด</b> = ลูกค้ายังเห็นพร้อมป้าย &ldquo;หมดวันนี้&rdquo; · <b>ซ่อน</b> = ลูกค้าไม่เห็นเมนูนั้นเลย
          </small>
        </p>
        <div className="menu-bulk">
          <button
            className="btn ghost-sm"
            disabled={busy || soldOutShown.length === 0}
            onClick={() => update(soldOutShown.map((m) => ({ m, patch: { hidden: true } })))}
          >
            ซ่อนเมนูที่หมดทั้งหมด{soldOutShown.length ? ` (${soldOutShown.length})` : ""}
          </button>
          <button className="btn ghost-sm" disabled={busy || hidden.length === 0} onClick={() => update(hidden.map((m) => ({ m, patch: { hidden: false } })))}>
            แสดงทั้งหมด{hidden.length ? ` (${hidden.length})` : ""}
          </button>
        </div>
      </div>
      <ul className="menu-grid">
        {menu.map((m) => (
          <li key={m.id} className={`mcard${m.available ? "" : " off"}${m.hidden ? " is-hidden" : ""}`}>
            <div className="mcard-art" style={{ "--tint": artTint(m) } as React.CSSProperties}>
              <MenuArt item={m} size={84} />
              <div className="flags">
                {m.hidden && <span className="flag hid">ซ่อนอยู่</span>}
                {m.recommended && <span className="flag rec">แนะนำ</span>}
                {m.promoPrice !== null && <span className="flag sale">โปร</span>}
              </div>
            </div>
            <div className="mcard-body">
              <p className="jp">{m.jp}</p>
              <p className="nm">{m.name}</p>
              <Price item={m} />
            </div>
            <div className="mcard-switches">
              <button className="toggle" role="switch" aria-checked={m.available} onClick={() => update([{ m, patch: { available: !m.available } }])}>
                <span className="knob" aria-hidden="true" />
                {m.available ? "มีขาย" : "หมด"}
              </button>
              <button className="toggle vis" role="switch" aria-checked={!m.hidden} onClick={() => update([{ m, patch: { hidden: !m.hidden } }])}>
                <span className="knob" aria-hidden="true" />
                {m.hidden ? "ซ่อน" : "แสดง"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
