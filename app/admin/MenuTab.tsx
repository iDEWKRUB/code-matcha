"use client";

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

export default function MenuTab({ menu, setMenu, reload, onError }: Props) {
  async function toggle(m: MenuItem) {
    setMenu(menu.map((x) => (x.id === m.id ? { ...x, available: !m.available } : x)));
    const r = await fetch(`/api/admin/menu/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !m.available }),
    });
    if (!r.ok) onError("บันทึกสถานะเมนูไม่สำเร็จ");
    reload();
  }

  const selling = menu.filter((m) => m.available).length;

  return (
    <>
      <p className="lead">
        ขายอยู่ <b>{selling}</b> จาก {menu.length} เมนู — เมนูที่ปิดจะขึ้น &ldquo;หมดวันนี้&rdquo; ในหน้าสั่งของลูกค้าทันที
      </p>
      <ul className="menu-grid">
        {menu.map((m) => (
          <li key={m.id} className={`mcard${m.available ? "" : " off"}`}>
            <div className="mcard-art" style={{ "--tint": artTint(m) } as React.CSSProperties}>
              <MenuArt item={m} size={84} />
              <div className="flags">
                {m.recommended && <span className="flag rec">แนะนำ</span>}
                {m.promoPrice !== null && <span className="flag sale">โปร</span>}
              </div>
            </div>
            <div className="mcard-body">
              <p className="jp">{m.jp}</p>
              <p className="nm">{m.name}</p>
              <Price item={m} />
            </div>
            <button className="toggle" role="switch" aria-checked={m.available} onClick={() => toggle(m)}>
              <span className="knob" aria-hidden="true" />
              {m.available ? "มีขาย" : "หมด"}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
