"use client";

import { useEffect, useState } from "react";
import { barHoursText, type BarHours } from "@/lib/bar";

// เปิด/ปิดมาม่าบาร์ให้ลูกค้าเห็น + เวลาเปิดของมาม่าบาร์ (แยกจากมัทฉะ)
export default function BarHoursPanel() {
  const [h, setH] = useState<BarHours | null>(null);
  const [open, setOpen] = useState("14:00");
  const [close, setClose] = useState("23:59");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function apply(j: BarHours) {
    setH(j);
    setOpen(j.openTime);
    setClose(j.closeTime);
  }

  useEffect(() => {
    fetch("/api/admin/bar/hours", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(apply)
      .catch(() => setMsg({ ok: false, text: "โหลดเวลาเปิดไม่สำเร็จ" }));
  }, []);

  async function save(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/bar/hours", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) return location.reload();
      if (!r.ok) throw new Error(j.error ?? "บันทึกไม่สำเร็จ");
      apply(j);
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  }

  if (!h) return <section className="nba-card bh">{msg ? <p className="nba-err">{msg.text}</p> : <p className="nba-muted">กำลังโหลด…</p>}</section>;
  const changed = open !== h.openTime || close !== h.closeTime;
  const overnight = !h.allDay && close < open;

  return (
    <section className="nba-card bh nba-noprint">
      <div className="nba-row-head">
        <div>
          <h2>เปิดขายมาม่าบาร์</h2>
          <p className="nba-muted">
            {h.enabled ? "ลูกค้าเห็นปุ่มมาม่าบาร์ในหน้าสั่งมัทฉะแล้ว" : "ปิดอยู่: ลูกค้าไม่เห็นปุ่มมาม่าบาร์ (ยังทดสอบจากลิงก์ลับได้)"}
          </p>
        </div>
        <button
          className={`bh-toggle${h.enabled ? " on" : ""}`}
          role="switch"
          aria-checked={h.enabled}
          aria-label="เปิดขายมาม่าบาร์"
          disabled={busy}
          onClick={() => {
            if (!h.enabled && !confirm("เปิดมาม่าบาร์ให้ลูกค้าเห็นเลยไหม?")) return;
            save({ enabled: !h.enabled }, h.enabled ? "ปิดมาม่าบาร์แล้ว ลูกค้าไม่เห็นปุ่ม" : "เปิดมาม่าบาร์แล้ว ลูกค้าเห็นปุ่มแล้ว");
          }}
        >
          <i />
          {h.enabled ? "เปิดขาย" : "ปิดอยู่"}
        </button>
      </div>

      <div className="bh-hours">
        <div className="bh-mode" role="group" aria-label="ช่วงเวลาเปิด">
          <button aria-pressed={!h.allDay} disabled={busy} onClick={() => h.allDay && save({ allDay: false }, "ตั้งเป็นเปิดตามเวลาแล้ว")}>
            ตามเวลา
          </button>
          <button aria-pressed={h.allDay} disabled={busy} onClick={() => !h.allDay && save({ allDay: true }, "ตั้งเป็นเปิด 24 ชม. แล้ว")}>
            24 ชม.
          </button>
        </div>
        {!h.allDay && (
          <div className="bh-times">
            <label>
              เปิด
              <input type="time" value={open} onChange={(e) => setOpen(e.target.value)} />
            </label>
            <label>
              ปิด
              <input type="time" value={close} onChange={(e) => setClose(e.target.value)} />
            </label>
            <button className="nba-primary" disabled={busy || !changed} onClick={() => save({ openTime: open, closeTime: close }, "บันทึกเวลาเปิดแล้ว")}>
              บันทึกเวลา
            </button>
          </div>
        )}
      </div>
      <p className="nba-muted">
        ตอนนี้: <b className={h.openNow ? "bh-now on" : "bh-now"}>{h.openNow ? "เปิดอยู่" : "นอกเวลาเปิด"}</b> · {barHoursText(h)}
        {overnight && " (ข้ามเที่ยงคืน)"} · เวลาของมัทฉะตั้งแยกที่ &quot;ตั้งค่าร้าน&quot;
      </p>
      {msg && <p className={msg.ok ? "hint-ok" : "nba-err"} role="status">{msg.text}</p>}
    </section>
  );
}
