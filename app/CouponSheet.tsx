"use client";

import { useState } from "react";
import Icon from "./Icon";

export type Offer = {
  code: string;
  kind: "percent" | "amount";
  value: number;
  maxDiscount: number | null;
  minSpend: number;
  newCustomersOnly: boolean;
  label: string;
  expiresOn: string | null;
  timeFrom: string | null;
  nowOk: boolean;
};

const FILTERS = [
  ["all", "ทั้งหมด"],
  ["percent", "ลดเป็น %"],
  ["amount", "ลดเป็นบาท"],
  ["time", "เฉพาะช่วงเวลา"],
] as const;
type Filter = (typeof FILTERS)[number][0];

export const offerValue = (o: Pick<Offer, "kind" | "value">) => (o.kind === "percent" ? `${o.value}%` : `฿${o.value}`);

// หน้าคูปองทั้งหมด (เมื่อร้านมีโค้ดหลายใบ) · เก็บได้ครั้งละ 1 ใบ ระบบใส่ให้ตอนชำระเงิน
export default function CouponSheet({ offers, kept, onKeep, onClose }: { offers: Offer[]; kept: string; onKeep: (code: string) => void; onClose: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const list = offers
    .filter((o) => filter === "all" || (filter === "time" ? !!o.timeFrom : o.kind === filter))
    .sort((a, b) => Number(b.nowOk) - Number(a.nowOk));
  const keptOffer = offers.find((o) => o.code === kept);

  return (
    <div className="cps" role="dialog" aria-label="คูปองทั้งหมด">
      <header className="cps-top">
        <button type="button" className="cps-back" aria-label="ปิด" onClick={onClose}>
          <Icon name="close" size={20} />
        </button>
        <h2>คูปอง</h2>
        <span>{offers.length} ใบ</span>
      </header>

      {keptOffer && (
        <div className="cps-kept">
          <div>
            <b>ใช้ให้อัตโนมัติตอนชำระเงิน</b>
            <small>
              {keptOffer.code} · {keptOffer.label.split(" · ")[0]}
            </small>
          </div>
          <button type="button" onClick={() => onKeep("")}>
            เอาออก
          </button>
        </div>
      )}

      <div className="cps-chips" role="group" aria-label="กรองคูปอง">
        {FILTERS.map(([k, t]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {t}
          </button>
        ))}
      </div>

      <div className="cps-list">
        {list.length === 0 && <p className="cps-empty">ไม่มีคูปองในหมวดนี้</p>}
        {list.map((o) => {
          const parts = o.label.split(" · ");
          const on = kept === o.code;
          return (
            <article key={o.code} className="cps-tk">
              <div className="cps-stub">
                <small>ลด</small>
                <b>{offerValue(o)}</b>
              </div>
              <div className="cps-body">
                <b>{parts[0]}</b>
                <small>{[...parts.slice(1), o.expiresOn ? `ถึง ${o.expiresOn.slice(8)}/${o.expiresOn.slice(5, 7)}` : ""].filter(Boolean).join(" · ") || "ใช้ได้ทุกวัน"}</small>
                <div className="cps-foot">
                  <code>{o.code}</code>
                  <button type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => onKeep(on ? "" : o.code)}>
                    {on ? "เก็บแล้ว ✓" : o.nowOk ? "เก็บ" : `เก็บไว้ · ใช้ได้ ${o.timeFrom} น.`}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
