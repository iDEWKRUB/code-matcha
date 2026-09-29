"use client";

import { useCallback, useEffect, useState } from "react";
import { barFlags, TRAY_KEEP_DAYS, type BarItem, type BarScan } from "@/lib/bar";
import type { OrderItem } from "@/lib/menu";

type Bill = {
  id: number;
  no: number;
  at: string;
  name: string;
  items: OrderItem[];
  total: number;
  status: string;
  hasSlip: boolean;
  photo: string | null;
  scan: BarScan | null;
  termsAt: string | null;
  extra: number;
  extraNote: string;
};

const STATUS: Record<string, string> = { payment_review: "รอตรวจสลิป", cancelled: "ยกเลิก" };
const time = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

// บิลมาม่าบาร์รายวัน: รูปถาด + รายการ + ป้ายเตือน + บันทึกเรียกเก็บเพิ่ม
export default function BarBills({ items }: { items: BarItem[] }) {
  const [date, setDate] = useState(today);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [edit, setEdit] = useState<{ id: number; extra: string; note: string } | null>(null);
  const [err, setErr] = useState("");
  const name = (id: string) => items.find((i) => i.id === id)?.name ?? id;

  const load = useCallback(async (d: string) => {
    setBills(null);
    setErr("");
    const r = await fetch(`/api/admin/bar/orders?date=${d}`, { cache: "no-store" });
    if (r.status === 401) return location.reload();
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? "โหลดบิลไม่สำเร็จ");
    setBills(j.bills);
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  async function saveExtra() {
    if (!edit) return;
    const r = await fetch("/api/admin/bar/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: edit.id, extra: Number(edit.extra) || 0, note: edit.note }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? "บันทึกไม่สำเร็จ");
    setEdit(null);
    load(date);
  }

  const paid = (bills ?? []).filter((b) => !["payment_review", "cancelled"].includes(b.status));
  const shown = (bills ?? []).filter((b) => !onlyFlagged || barFlags(b.scan).some((f) => f.level === "warn"));
  const sold = new Map<string, number>();
  for (const b of paid) for (const i of b.items) sold.set(i.name, (sold.get(i.name) ?? 0) + i.qty);

  return (
    <section className="nba-card nba-noprint">
      <div className="nba-row-head">
        <h2>บิลมาม่าบาร์</h2>
        <input className="nba-date" type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="เลือกวันที่" />
      </div>
      {bills && (
        <div className="nba-sum">
          <span>
            จ่ายแล้ว <b>{paid.length}</b> บิล · <b>฿{paid.reduce((n, b) => n + b.total, 0).toLocaleString()}</b>
          </span>
          {sold.size > 0 && <span className="nba-muted">ขายไป: {[...sold].map(([n, q]) => `${n} ${q}`).join(" · ")}</span>}
          <label className="nba-check-inline">
            <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
            เฉพาะบิลน่าสงสัย
          </label>
        </div>
      )}
      {err && <p className="nba-err" role="alert">{err}</p>}
      {bills === null && !err && <p className="nba-muted">กำลังโหลด…</p>}
      {bills && shown.length === 0 && <p className="nba-muted">{onlyFlagged ? "ไม่มีบิลน่าสงสัยในวันนี้" : "ยังไม่มีบิลในวันนี้"}</p>}
      <ul className="nba-bills">
        {shown.map((b) => {
          const flags = barFlags(b.scan, name);
          return (
            <li key={b.id} className={flags.some((f) => f.level === "warn") ? "warn" : ""}>
              {b.photo ? (
                <a href={b.photo} target="_blank" rel="noreferrer" className="nba-bill-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.photo} alt={`รูปถาดบิล #${b.no}`} loading="lazy" />
                </a>
              ) : (
                <span className="nba-bill-photo none">ไม่มีรูป</span>
              )}
              <div className="nba-bill-body">
                <div className="nba-bill-head">
                  <b>
                    #{b.no} · {b.name}
                  </b>
                  <span className="nba-muted">{time(b.at)}</span>
                  <span className={`nba-st ${STATUS[b.status] ? "" : "ok"}`}>{STATUS[b.status] ?? "ชำระแล้ว"}</span>
                </div>
                <p className="nba-bill-items">{b.items.map((i) => `${i.name} ×${i.qty}`).join(" · ")}</p>
                <p className="nba-bill-meta">
                  <b>฿{b.total}</b>
                  {b.scan && <span> · ลูกค้านับได้ {b.scan.declared} ชิ้น</span>}
                  {b.termsAt && <span> · ยอมรับเงื่อนไข {time(b.termsAt)}</span>}
                  {b.hasSlip && (
                    <>
                      {" · "}
                      <a href={`/api/admin/orders/${b.id}/slip`} target="_blank" rel="noreferrer">
                        ดูสลิป
                      </a>
                    </>
                  )}
                </p>
                {flags.length > 0 && (
                  <div className="nba-flags">
                    {flags.map((f, k) => (
                      <span key={k} className={`nba-flag ${f.level}`}>
                        {f.text}
                      </span>
                    ))}
                  </div>
                )}
                {edit?.id === b.id ? (
                  <div className="nba-extra-form">
                    <input type="number" min={0} inputMode="numeric" placeholder="เรียกเก็บเพิ่ม (บาท)" value={edit.extra} onChange={(e) => setEdit({ ...edit, extra: e.target.value })} />
                    <input placeholder="หมายเหตุ เช่น กุ้งเกิน 1 ถ้วย" maxLength={200} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
                    <button className="nba-primary" onClick={saveExtra}>
                      บันทึก
                    </button>
                    <button className="nba-ghost" onClick={() => setEdit(null)}>
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <div className="nba-extra">
                    {b.extra > 0 && (
                      <span className="nba-flag warn">
                        เรียกเก็บเพิ่ม ฿{b.extra}
                        {b.extraNote ? ` · ${b.extraNote}` : ""}
                      </span>
                    )}
                    <button className="nba-ghost" onClick={() => setEdit({ id: b.id, extra: b.extra ? String(b.extra) : "", note: b.extraNote })}>
                      {b.extra > 0 ? "แก้เรียกเก็บเพิ่ม" : "บันทึกเรียกเก็บเพิ่ม"}
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="nba-muted">รูปถาดเก็บไว้ {TRAY_KEEP_DAYS} วัน แล้วลบอัตโนมัติ (รายการและยอดเงินยังอยู่)</p>
    </section>
  );
}
