"use client";

import { useCallback, useEffect, useState } from "react";
import { barFlags, EXTRA_LABEL, TRAY_KEEP_DAYS, type BarItem, type BarScan, type ExtraItem, type ExtraStatus } from "@/lib/bar";
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
  extraItems: ExtraItem[];
  extraStatus: ExtraStatus;
  extraSentAt: string | null;
  extraSlip: string | null;
};
type Edit = { bill: Bill; qty: Record<string, number>; note: string; busy: boolean; err: string };

const STATUS: Record<string, string> = { payment_review: "รอตรวจสลิป", cancelled: "ยกเลิก" };
const PAID = ["pending", "preparing", "ready", "completed"];
const time = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

// ค่าเริ่มต้นของรายการที่ขาด: ที่เคยเรียกเก็บไว้ หรือถ้ายังไม่มี = ของที่ระบบอ่านได้แต่ลูกค้าลดจำนวนเอง
function suggest(b: Bill) {
  if (b.extraItems.length) return Object.fromEntries(b.extraItems.map((i) => [i.id, i.qty]));
  const q: Record<string, number> = {};
  for (const [id, d] of Object.entries(b.scan?.detected ?? {})) {
    const miss = d - (b.scan?.final[id] ?? 0);
    if (miss > 0) q[id] = miss;
  }
  return q;
}

// บิลมาม่าบาร์รายวัน: รูปถาด + รายการ + ป้ายเตือน + เรียกเก็บเพิ่ม
export default function BarBills({ items }: { items: BarItem[] }) {
  const [date, setDate] = useState(today);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [err, setErr] = useState("");
  const name = (id: string) => items.find((i) => i.id === id)?.name ?? id;

  const load = useCallback(async (d: string) => {
    setErr("");
    const r = await fetch(`/api/admin/bar/orders?date=${d}`, { cache: "no-store" });
    if (r.status === 401) return location.reload();
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? "โหลดบิลไม่สำเร็จ");
    setBills(j.bills);
  }, []);

  useEffect(() => {
    setBills(null);
    load(date);
  }, [date, load]);

  async function act(body: Record<string, unknown>) {
    const r = await fetch("/api/admin/bar/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? "บันทึกไม่สำเร็จ");
    await load(date);
  }

  async function send() {
    if (!edit) return;
    const picked = Object.entries(edit.qty).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty }));
    if (edit.bill.extraSentAt && !confirm("ส่งแจ้งลูกค้าทาง LINE อีกครั้ง?")) return;
    setEdit({ ...edit, busy: true, err: "" });
    try {
      await act({ id: edit.bill.id, action: "send", items: picked, note: edit.note });
      setEdit(null);
    } catch (e) {
      setEdit((x) => x && { ...x, busy: false, err: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" });
    }
  }

  async function quick(b: Bill, action: "cancel" | "confirm") {
    if (action === "cancel" && !confirm(`ยกเลิกการเรียกเก็บเพิ่มบิล #${b.no}?`)) return;
    try {
      await act({ id: b.id, action });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }

  const paid = (bills ?? []).filter((b) => PAID.includes(b.status));
  const shown = (bills ?? []).filter((b) => !onlyFlagged || barFlags(b.scan).some((f) => f.level === "warn"));
  const sold = new Map<string, number>();
  for (const b of paid) {
    for (const i of b.items) sold.set(i.name, (sold.get(i.name) ?? 0) + i.qty);
    if (b.extraStatus !== "none") for (const i of b.extraItems) sold.set(i.name, (sold.get(i.name) ?? 0) + i.qty);
  }
  const extraDue = paid.filter((b) => b.extraStatus === "due" || b.extraStatus === "review").reduce((n, b) => n + b.extra, 0);
  const editTotal = edit ? items.reduce((n, i) => n + (edit.qty[i.id] ?? 0) * i.price, 0) : 0;

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
            {extraDue > 0 && <span className="nba-due"> · ค้างชำระเพิ่ม ฿{extraDue}</span>}
          </span>
          {sold.size > 0 && <span className="nba-muted">ออกจากบาร์: {[...sold].map(([n, q]) => `${n} ${q}`).join(" · ")}</span>}
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
          const canCharge = PAID.includes(b.status);
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
                {canCharge && (
                  <div className="nba-extra">
                    {b.extraStatus !== "none" && (
                      <span className={`nba-flag ${b.extraStatus === "paid" ? "ok" : "warn"}`}>
                        {EXTRA_LABEL[b.extraStatus]} ฿{b.extra}
                        {b.extraItems.length > 0 && ` · ${b.extraItems.map((i) => `${i.name} ×${i.qty}`).join(", ")}`}
                        {b.extraStatus === "due" && (b.extraSentAt ? ` · แจ้ง LINE แล้ว ${time(b.extraSentAt)}` : " · ยังไม่ได้แจ้งลูกค้า")}
                      </span>
                    )}
                    {b.extraSlip && (
                      <a className="nba-ghost" href={b.extraSlip} target="_blank" rel="noreferrer">
                        ดูสลิปชำระเพิ่ม
                      </a>
                    )}
                    {b.extraStatus === "review" && (
                      <button className="nba-primary" onClick={() => quick(b, "confirm")}>
                        ยืนยันรับเงินเพิ่มแล้ว
                      </button>
                    )}
                    {(b.extraStatus === "none" || b.extraStatus === "due") && (
                      <button className="nba-ghost" onClick={() => setEdit({ bill: b, qty: suggest(b), note: b.extraNote, busy: false, err: "" })}>
                        {b.extraStatus === "none" ? "เรียกเก็บเพิ่ม" : "แก้ & ส่งแจ้งใหม่"}
                      </button>
                    )}
                    {b.extraStatus === "due" && (
                      <button className="nba-ghost" onClick={() => quick(b, "cancel")}>
                        ยกเลิกเรียกเก็บ
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="nba-muted">รูปถาดเก็บไว้ {TRAY_KEEP_DAYS} วัน แล้วลบอัตโนมัติ (รายการและยอดเงินยังอยู่)</p>

      {edit && (
        <div className="nba-modal" role="dialog" aria-modal="true" aria-label={`เรียกเก็บเพิ่ม บิล #${edit.bill.no}`}>
          <div className="nba-form nba-xform">
            <div className="nba-row-head">
              <h2>เรียกเก็บเพิ่ม · บิล #{edit.bill.no}</h2>
              <span className="nba-muted">
                {edit.bill.name} · {time(edit.bill.at)}
              </span>
            </div>
            <div className="nba-xsum">
              {edit.bill.photo ? (
                <a href={edit.bill.photo} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={edit.bill.photo} alt="รูปถาด" />
                </a>
              ) : (
                <span className="nba-bill-photo none">ไม่มีรูป</span>
              )}
              <div>
                <div>
                  จ่ายแล้ว <b>฿{edit.bill.total}</b> · {edit.bill.items.reduce((n, i) => n + i.qty, 0)} ชิ้น
                </div>
                {edit.bill.scan && (
                  <div className="nba-muted">
                    ลูกค้านับได้ {edit.bill.scan.declared} ชิ้น · ระบบอ่านได้ {Object.values(edit.bill.scan.detected).reduce((n, q) => n + q, 0)} ชิ้น
                  </div>
                )}
                {edit.bill.photo && (
                  <a href={edit.bill.photo} target="_blank" rel="noreferrer">
                    ดูรูปใหญ่
                  </a>
                )}
              </div>
            </div>
            <div className="nba-muted nba-xlabel">เลือกรายการที่อยู่ในถาดแต่ยังไม่ได้จ่าย</div>
            <ul className="nba-xlist">
              {items.map((i) => {
                const q = edit.qty[i.id] ?? 0;
                const set = (n: number) => setEdit({ ...edit, qty: { ...edit.qty, [i.id]: Math.max(0, Math.min(50, n)) } });
                return (
                  <li key={i.id} className={q ? "on" : ""}>
                    <span>
                      {i.name} <small>฿{i.price}</small>
                    </span>
                    <button aria-label={`ลด ${i.name}`} onClick={() => set(q - 1)} disabled={!q}>
                      −
                    </button>
                    <b>{q}</b>
                    <button aria-label={`เพิ่ม ${i.name}`} onClick={() => set(q + 1)}>
                      +
                    </button>
                  </li>
                );
              })}
            </ul>
            <label>
              หมายเหตุถึงลูกค้า (ไม่บังคับ)
              <input value={edit.note} maxLength={200} placeholder="เช่น ตรวจจากรูปถาดพบท็อปปิ้ง 2 ถ้วยที่ยังไม่ได้ชำระ" onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
            </label>
            <div className="nba-xtotal">
              <span>ยอดเรียกเก็บเพิ่ม</span>
              <b>฿{editTotal}</b>
            </div>
            {edit.err && <p className="nba-err" role="alert">{edit.err}</p>}
            <div className="nba-acts">
              <button className="nba-ghost" onClick={() => setEdit(null)} disabled={edit.busy}>
                ยกเลิก
              </button>
              <button className="nba-primary" onClick={send} disabled={edit.busy || editTotal <= 0}>
                {edit.busy ? "กำลังส่ง…" : "บันทึก & แจ้งลูกค้าทาง LINE"}
              </button>
            </div>
            <p className="nba-muted">หลังส่ง บิลจะขึ้น &quot;ค้างชำระเพิ่ม&quot; จนกว่าลูกค้าจ่าย · ยกเลิกการเรียกเก็บได้ภายหลัง</p>
          </div>
        </div>
      )}
    </section>
  );
}
