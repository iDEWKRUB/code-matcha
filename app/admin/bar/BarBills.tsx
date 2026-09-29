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
  termsVersion: number | null;
  paidAt: string | null;
  autoPaid: boolean;
  extra: number;
  extraNote: string;
  extraItems: ExtraItem[];
  extraStatus: ExtraStatus;
  extraSentAt: string | null;
  extraSlip: string | null;
  extraPaidAt: string | null;
  extraAuto: boolean;
};
type Edit = { bill: Bill; qty: Record<string, number>; note: string; busy: boolean; err: string };
type Filter = "all" | "flag" | "due" | "cancel";
type Dot = "done" | "now" | "wait" | "fail" | "skip";

const PAID = ["pending", "preparing", "ready", "completed"];
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) : "");
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
const short = (n: string) => n.replace(/^(ท็อปปิ้ง|มาม่า(รส)?)\s*/, "");
const count = (r: Record<string, number> | undefined) => Object.values(r ?? {}).reduce((n, q) => n + q, 0);
const isWarn = (b: Bill) => barFlags(b.scan).some((f) => f.level === "warn");
const isDue = (b: Bill) => b.extraStatus === "due" || b.extraStatus === "review";

function statusPill(b: Bill) {
  if (b.status === "cancelled") return { cls: "bad", text: "ยกเลิก" };
  if (b.status === "payment_review") return { cls: "wait", text: "รอตรวจสลิป" };
  if (isDue(b)) return { cls: "wait", text: EXTRA_LABEL[b.extraStatus] };
  return { cls: "ok", text: b.extraStatus === "paid" ? "ชำระครบ (รวมเพิ่ม)" : "ชำระแล้ว" };
}

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

const Ico = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const CHECK = "M5 12.5l4.5 4.5L19 7.5";
const CROSS = "M6 6l12 12M18 6 6 18";

// บิลมาม่าบาร์รายวัน: สรุป + รายการบิล → กดดูรายละเอียดพร้อมไทม์ไลน์ 4 ขั้น
export default function BarBills({ items }: { items: BarItem[] }) {
  const [date, setDate] = useState(today);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<number | null>(null);
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
    setOpenId(null);
    load(date);
  }, [date, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !edit && setOpenId(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [edit]);

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
    if (action === "confirm" && !confirm(`ยืนยันว่าได้รับเงินเพิ่ม ฿${b.extra} แล้ว? ระบบจะส่งข้อความขอบคุณให้ลูกค้า`)) return;
    try {
      await act({ id: b.id, action });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }

  const all = bills ?? [];
  const paid = all.filter((b) => PAID.includes(b.status));
  const sold = new Map<string, number>();
  for (const b of paid) {
    for (const i of b.items) sold.set(i.name, (sold.get(i.name) ?? 0) + i.qty);
    if (b.extraStatus !== "none") for (const i of b.extraItems) sold.set(i.name, (sold.get(i.name) ?? 0) + i.qty);
  }
  const lists: Record<Filter, Bill[]> = {
    all,
    flag: all.filter(isWarn),
    due: all.filter(isDue),
    cancel: all.filter((b) => b.status === "cancelled"),
  };
  const shown = lists[filter];
  const open = all.find((b) => b.id === openId) ?? null;
  const editTotal = edit ? items.reduce((n, i) => n + (edit.qty[i.id] ?? 0) * i.price, 0) : 0;
  const openEdit = (b: Bill) => setEdit({ bill: b, qty: suggest(b), note: b.extraNote, busy: false, err: "" });

  return (
    <section className="nba-card nba-noprint bb">
      <div className="nba-row-head">
        <div>
          <h2>บิลมาม่าบาร์</h2>
          <p className="nba-muted">กดที่บิลเพื่อดูรูปถาดและไทม์ไลน์</p>
        </div>
        <input className="nba-date" type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="เลือกวันที่" />
      </div>

      <div className="bb-tiles">
        <div>
          <small>บิลที่จ่ายแล้ว</small>
          <b>{paid.length}</b>
        </div>
        <div>
          <small>ยอดขาย</small>
          <b>฿{paid.reduce((n, b) => n + b.total + (b.extraStatus === "paid" ? b.extra : 0), 0).toLocaleString()}</b>
        </div>
        <div className={lists.flag.length ? "warn" : ""}>
          <small>บิลน่าสงสัย</small>
          <b>{lists.flag.length}</b>
        </div>
        <div className={lists.due.length ? "due" : ""}>
          <small>ค้างชำระเพิ่ม</small>
          <b>฿{lists.due.reduce((n, b) => n + b.extra, 0).toLocaleString()}</b>
        </div>
      </div>

      <div className="bb-filters" role="tablist" aria-label="กรองบิล">
        {(
          [
            ["all", "ทั้งหมด"],
            ["flag", "น่าสงสัย"],
            ["due", "ค้างชำระเพิ่ม"],
            ["cancel", "ยกเลิก"],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>
            {label} <em>{lists[k].length}</em>
          </button>
        ))}
      </div>
      {sold.size > 0 && <p className="nba-muted bb-sold">ออกจากบาร์วันนี้: {[...sold].map(([n, q]) => `${short(n)} ${q}`).join(" · ")}</p>}

      {err && <p className="nba-err" role="alert">{err}</p>}
      {bills === null && !err && <p className="nba-muted">กำลังโหลด…</p>}
      {bills && shown.length === 0 && <p className="bb-empty">ไม่มีบิลในหมวดนี้</p>}

      <ul className="bb-list">
        {shown.map((b) => {
          const pill = statusPill(b);
          return (
            <li key={b.id}>
              <button className={`bb-row${isWarn(b) ? " warn" : ""}${b.status === "cancelled" ? " off" : ""}`} onClick={() => setOpenId(b.id)}>
                {b.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="bb-thumb" src={b.photo} alt="" loading="lazy" />
                ) : (
                  <span className="bb-thumb none">ไม่มีรูป</span>
                )}
                <span className="bb-main">
                  <span className="bb-top">
                    <b>#{b.no}</b> {b.name} <small>{time(b.at)}</small>
                  </span>
                  <span className="bb-items">{b.items.map((i) => `${short(i.name)} ×${i.qty}`).join(" · ")}</span>
                  {isWarn(b) && <span className="bb-warn">น่าสงสัย · {barFlags(b.scan, name).filter((f) => f.level === "warn").length} จุด</span>}
                </span>
                <span className="bb-side">
                  <b>฿{b.total}</b>
                  <span className={`bb-pill ${pill.cls}`}>{pill.text}</span>
                  {b.extraStatus !== "none" && <small className={b.extraStatus === "paid" ? "ok" : "due"}>+฿{b.extra}</small>}
                </span>
                <Ico d="M9 5l7 7-7 7" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="nba-muted">รูปถาดเก็บไว้ {TRAY_KEEP_DAYS} วัน แล้วลบอัตโนมัติ (รายการและยอดเงินยังอยู่)</p>

      {open && <Detail b={open} name={name} onClose={() => setOpenId(null)} onEdit={() => openEdit(open)} onQuick={(a) => quick(open, a)} />}

      {edit && (
        <div className="nba-modal bb-top-layer" role="dialog" aria-modal="true" aria-label={`เรียกเก็บเพิ่ม บิล #${edit.bill.no}`}>
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
                    ลูกค้านับได้ {edit.bill.scan.declared} ชิ้น · ระบบอ่านได้ {count(edit.bill.scan.detected)} ชิ้น
                  </div>
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
          </div>
        </div>
      )}
    </section>
  );
}

// แผงรายละเอียดบิล: รูปถาด + รายการ + ป้ายเตือน + ไทม์ไลน์ 1-2-3-4
function Detail({ b, name, onClose, onEdit, onQuick }: { b: Bill; name: (id: string) => string; onClose: () => void; onEdit: () => void; onQuick: (a: "cancel" | "confirm") => void }) {
  const flags = barFlags(b.scan, name);
  const isPaid = PAID.includes(b.status);
  const pill = statusPill(b);

  const steps: { dot: Dot; title: string; at?: string | null; body: React.ReactNode }[] = [
    {
      dot: "done",
      title: "สแกนถาด & ยอมรับเงื่อนไข",
      at: b.at,
      body: (
        <>
          {b.scan ? (
            <p>
              ระบบอ่านได้ <b>{count(b.scan.detected)}</b> ชิ้น · ลูกค้านับ <b>{b.scan.declared}</b> ชิ้น · จ่าย <b>{count(b.scan.final)}</b> ชิ้น
              {b.scan.unknown > 0 && ` · QR ไม่รู้จัก ${b.scan.unknown}`}
            </p>
          ) : (
            <p>ไม่มีข้อมูลการสแกน</p>
          )}
          {b.termsAt && (
            <p className="nba-muted">
              ติ๊กยอมรับเงื่อนไข{b.termsVersion ? ` (ฉบับ ${b.termsVersion})` : ""} เวลา {time(b.termsAt)}
            </p>
          )}
        </>
      ),
    },
    b.status === "cancelled"
      ? { dot: "fail", title: "ชำระเงิน · ยกเลิก", body: <p>บิลนี้ถูกยกเลิก (ลูกค้ายกเลิกเอง หรือร้านตรวจไม่พบยอดโอน)</p> }
      : b.status === "payment_review"
        ? {
            dot: "now",
            title: `ชำระเงิน ฿${b.total} · รอตรวจสลิป`,
            body: (
              <>
                <p>ลูกค้าแนบสลิปแล้ว แต่ระบบตรวจอัตโนมัติไม่ผ่าน · ยืนยันที่หน้า &quot;ออเดอร์วันนี้&quot;</p>
                {b.hasSlip && <SlipLink href={`/api/admin/orders/${b.id}/slip`} />}
              </>
            ),
          }
        : {
            dot: "done",
            title: `ชำระเงิน ฿${b.total}`,
            at: b.paidAt,
            body: (
              <>
                <p>{b.autoPaid ? "ตรวจสลิปอัตโนมัติผ่าน (SlipOK)" : "ร้านตรวจและยืนยันสลิปเอง"}</p>
                {b.hasSlip && <SlipLink href={`/api/admin/orders/${b.id}/slip`} />}
              </>
            ),
          },
    !isPaid
      ? { dot: "wait", title: "ตรวจถาด / เรียกเก็บเพิ่ม", body: <p className="nba-muted">ทำได้หลังบิลชำระแล้ว</p> }
      : b.extraStatus === "none"
        ? {
            dot: "skip",
            title: "ตรวจถาด / เรียกเก็บเพิ่ม",
            body: (
              <>
                <p className="nba-muted">ยังไม่มีการเรียกเก็บเพิ่ม{flags.some((f) => f.level === "warn") ? " · บิลนี้มีจุดน่าสงสัย ตรวจรูปถาดก่อนนะ" : ""}</p>
                <div className="bb-acts">
                  <button className="nba-ghost" onClick={onEdit}>
                    เรียกเก็บเพิ่ม
                  </button>
                </div>
              </>
            ),
          }
        : {
            dot: "done",
            title: `เรียกเก็บเพิ่ม ฿${b.extra}`,
            at: b.extraSentAt,
            body: (
              <>
                <p>{b.extraItems.length ? b.extraItems.map((i) => `${i.name} ×${i.qty}`).join(" · ") : "ยังไม่ได้เลือกรายการ"}</p>
                {b.extraNote && <p className="nba-muted">หมายเหตุ: {b.extraNote}</p>}
                <p className="nba-muted">{b.extraSentAt ? "แจ้งลูกค้าทาง LINE แล้ว" : "ยังไม่ได้แจ้งลูกค้า"}</p>
                {b.extraStatus === "due" && (
                  <div className="bb-acts">
                    <button className="nba-ghost" onClick={onEdit}>
                      แก้ &amp; ส่งแจ้งใหม่
                    </button>
                    <button className="nba-ghost" onClick={() => onQuick("cancel")}>
                      ยกเลิกเรียกเก็บ
                    </button>
                  </div>
                )}
              </>
            ),
          },
    b.extraStatus === "none" || !isPaid
      ? { dot: isPaid ? "skip" : "wait", title: "ชำระเพิ่ม", body: <p className="nba-muted">{isPaid ? "ไม่มียอดค้าง" : "—"}</p> }
      : b.extraStatus === "due"
        ? { dot: "now", title: `ชำระเพิ่ม ฿${b.extra} · รอลูกค้า`, body: <p>ลูกค้ายังไม่ได้ชำระ · ลูกค้ากดจ่ายได้จากการ์ด LINE หรือประวัติการมากิน</p> }
        : b.extraStatus === "review"
          ? {
              dot: "now",
              title: `ชำระเพิ่ม ฿${b.extra} · รอตรวจสลิป`,
              body: (
                <>
                  <p>ลูกค้าแนบสลิปแล้ว ระบบตรวจอัตโนมัติไม่ผ่าน · เช็กยอดในแอปธนาคาร</p>
                  <div className="bb-acts">
                    {b.extraSlip && <SlipLink href={b.extraSlip} label="ดูสลิปชำระเพิ่ม" />}
                    <button className="nba-primary" onClick={() => onQuick("confirm")}>
                      ยืนยันรับเงินเพิ่มแล้ว
                    </button>
                  </div>
                </>
              ),
            }
          : {
              dot: "done",
              title: `ชำระเพิ่ม ฿${b.extra} · ครบแล้ว`,
              at: b.extraPaidAt,
              body: (
                <>
                  <p>{b.extraAuto ? "ตรวจสลิปอัตโนมัติผ่าน (SlipOK)" : "ร้านยืนยันรับเงินเอง"} · ส่งข้อความขอบคุณ + ขออภัยให้ลูกค้าแล้ว</p>
                  {b.extraSlip && <SlipLink href={b.extraSlip} label="ดูสลิปชำระเพิ่ม" />}
                </>
              ),
            },
  ];

  return (
    <div className="bb-overlay" onClick={onClose}>
      <aside className="bb-drawer" role="dialog" aria-modal="true" aria-label={`บิล #${b.no}`} onClick={(e) => e.stopPropagation()}>
        <header className="bb-dhead">
          <div>
            <h3>
              บิล #{b.no} · {b.name}
            </h3>
            <span className={`bb-pill ${pill.cls}`}>{pill.text}</span>
          </div>
          <button className="bb-close" onClick={onClose} aria-label="ปิด">
            <Ico d={CROSS} size={20} />
          </button>
        </header>
        {b.photo ? (
          <a className="bb-photo" href={b.photo} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.photo} alt={`รูปถาดบิล #${b.no}`} />
            <span>แตะเพื่อดูรูปเต็ม</span>
          </a>
        ) : (
          <div className="bb-photo none">ไม่มีรูปถาด (บิลก่อนมีระบบ หรือครบ {TRAY_KEEP_DAYS} วันแล้ว)</div>
        )}
        <div className="bb-block">
          <h4>รายการที่จ่าย</h4>
          <ul className="bb-lines">
            {b.items.map((i, k) => (
              <li key={k}>
                <span>
                  {i.name} ×{i.qty}
                </span>
                <span>฿{i.price}</span>
              </li>
            ))}
            {b.extraItems.map((i) => (
              <li key={`x${i.id}`} className="extra">
                <span>
                  + {i.name} ×{i.qty} <small>เรียกเก็บเพิ่ม</small>
                </span>
                <span>฿{i.price * i.qty}</span>
              </li>
            ))}
            <li className="bb-sum">
              <span>รวม</span>
              <span>฿{b.total + (b.extraStatus !== "none" ? b.extra : 0)}</span>
            </li>
          </ul>
          {flags.length > 0 && (
            <div className="nba-flags">
              {flags.map((f, k) => (
                <span key={k} className={`nba-flag ${f.level}`}>
                  {f.text}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="bb-block">
          <h4>ไทม์ไลน์</h4>
          <ol className="bb-tl">
            {steps.map((s, i) => (
              <li key={i} className={`bbs-${s.dot}`}>
                <span className="bb-dot" aria-hidden="true">
                  {s.dot === "done" ? <Ico d={CHECK} size={16} /> : s.dot === "fail" ? <Ico d={CROSS} size={14} /> : i + 1}
                </span>
                <div className="bb-step">
                  <div className="bb-step-head">
                    <b>{s.title}</b>
                    {s.at && <small>{time(s.at)}</small>}
                  </div>
                  {s.body}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}

const SlipLink = ({ href, label = "ดูสลิป" }: { href: string; label?: string }) => (
  <a className="nba-ghost bb-slip" href={href} target="_blank" rel="noreferrer">
    {label}
  </a>
);
