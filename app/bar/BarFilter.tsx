"use client";

import { useMemo, useState } from "react";
import { barCategories, barMatch, type BarItem } from "@/lib/bar";

type Filterable = Pick<BarItem, "name" | "detail" | "group" | "category" | "code">;

// สถานะตัวกรอง (หมวด + คำค้น) ใช้ร่วมกันทุกหน้าที่มีรายการของมาม่าบาร์
export function useBarFilter<T extends Filterable>(items: T[]) {
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const cats = useMemo(() => barCategories(items), [items]);
  const shown = useMemo(() => items.filter((i) => barMatch(i, cat, q)), [items, cat, q]);
  return { cat: cats.includes(cat) ? cat : "", setCat, q, setQ, cats, shown, total: items.length };
}

type Props = {
  f: ReturnType<typeof useBarFilter>;
  id: string; // ไม่ซ้ำในหน้า (ผูก label กับช่องค้นหา)
  tone?: "admin" | "shop";
  placeholder?: string;
  onEnter?: () => void; // กด Enter ในช่องค้นหา
};

// ช่องค้นหา + ปุ่มหมวดหมู่ · tone shop = หน้าลูกค้า, admin = หลังร้าน
export default function BarFilter({ f, id, tone = "admin", placeholder = "ค้นหาชื่อ หรือรหัส เช่น 012 บูลดัก ชีส", onEnter }: Props) {
  return (
    <div className={`bf bf-${tone}`}>
      <div className="bf-search">
        <label htmlFor={id} className="bf-sr">
          ค้นหาสินค้า
        </label>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input id={id} type="search" inputMode="search" value={f.q} placeholder={placeholder} onChange={(e) => f.setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } }} autoComplete="off" enterKeyHint="search" />
        {f.q && (
          <button type="button" className="bf-clear" aria-label="ล้างคำค้น" onClick={() => f.setQ("")}>
            ×
          </button>
        )}
      </div>
      {f.cats.length > 0 && (
        <div className="bf-cats" role="group" aria-label="หมวดหมู่">
          <button type="button" aria-pressed={!f.cat} onClick={() => f.setCat("")}>
            ทั้งหมด
          </button>
          {f.cats.map((c) => (
            <button type="button" key={c} aria-pressed={f.cat === c} onClick={() => f.setCat(f.cat === c ? "" : c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      {(f.q || f.cat) && (
        <p className="bf-count" role="status">
          {f.shown.length ? `พบ ${f.shown.length} จาก ${f.total} รายการ` : "ไม่พบรายการที่ค้นหา"}
        </p>
      )}
    </div>
  );
}
