"use client";

import { useEffect, useState } from "react";
import { MAX_REPLY, ago, type AdminReview } from "@/lib/reviews";
import Star from "../review/Star";

// รีวิวทั้งหมดสำหรับร้าน (ไม่มีชื่อลูกค้า) · กรองดาว · ซ่อน/แสดงในหน้าลูกค้า
export default function ReviewsPanel() {
  const [list, setList] = useState<AdminReview[] | null>(null);
  const [err, setErr] = useState("");
  const [only, setOnly] = useState<number | "low" | "noreply" | null>(null);
  // กล่องตอบกลับที่เปิดอยู่: id รีวิว → ข้อความที่กำลังพิมพ์
  const [draft, setDraft] = useState<{ id: number; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/reviews", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "โหลดรีวิวไม่สำเร็จ");
        setList(j.reviews);
      })
      .catch((e) => setErr(e.message));
  }, []);

  async function saveReply(v: AdminReview, text: string) {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/reviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: v.id, reply: text }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "บันทึกไม่สำเร็จ");
      setList((l) => l && l.map((x) => (x.id === v.id ? { ...x, reply: j.reply, repliedAt: j.repliedAt } : x)));
      setDraft(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(v: AdminReview) {
    const r = await fetch("/api/admin/reviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: v.id, hidden: !v.hidden }) });
    if (r.ok) setList((l) => l && l.map((x) => (x.id === v.id ? { ...x, hidden: !v.hidden } : x)));
  }

  const all = list ?? [];
  const avg = all.length ? all.reduce((n, v) => n + v.rating, 0) / all.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: all.filter((v) => v.rating === n).length }));
  const shown = all.filter((v) => (only === null ? true : only === "low" ? v.rating <= 3 : only === "noreply" ? !v.reply : v.rating === only));
  const waiting = all.filter((v) => !v.reply).length;

  return (
    <section className="panel rvp">
      <header>
        <h2>รีวิวจากลูกค้า (ไม่ระบุชื่อ)</h2>
        <p>จาก LINE (ปุ่มในการ์ดออเดอร์พร้อม) และหน้าร้าน (QR บนใบเสร็จ) · ร้านซ่อนรีวิวจากหน้าลูกค้าได้ แต่แก้ข้อความไม่ได้</p>
      </header>
      {err && <p className="report-empty">{err}</p>}
      {list && !all.length && <p className="report-empty">ยังไม่มีรีวิว · รีวิวแรกจะมาหลังลูกค้าได้แก้วและกดให้คะแนน</p>}
      {all.length > 0 && (
        <>
          <div className="rvp-top">
            <div className="rvp-avg">
              <b>{avg.toFixed(1)}</b>
              <span className="rv-row">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} on={n <= Math.round(avg)} size={18} />
                ))}
              </span>
              <small>{all.length} รีวิว</small>
            </div>
            <ul className="rvp-dist">
              {dist.map((d) => (
                <li key={d.n}>
                  <span>{d.n} ดาว</span>
                  <i style={{ width: `${all.length ? (d.c / all.length) * 100 : 0}%` }} />
                  <b>{d.c}</b>
                </li>
              ))}
            </ul>
          </div>
          <div className="seg rvp-seg" role="group" aria-label="กรองรีวิว">
            <button aria-pressed={only === null} onClick={() => setOnly(null)}>
              ทั้งหมด
            </button>
            <button aria-pressed={only === "low"} onClick={() => setOnly("low")}>
              ต้องปรับปรุง (1–3 ดาว)
            </button>
            <button aria-pressed={only === 5} onClick={() => setOnly(5)}>
              5 ดาว
            </button>
            <button aria-pressed={only === "noreply"} onClick={() => setOnly("noreply")}>
              ยังไม่ตอบ ({waiting})
            </button>
          </div>
          <ul className="rvp-list">
            {shown.map((v) => (
              <li key={v.id} className={v.hidden ? "off" : undefined}>
                <div className="rvp-meta">
                  <span className="rv-row" aria-label={`${v.rating} ดาว`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} on={n <= v.rating} size={14} />
                    ))}
                  </span>
                  <small>
                    {v.source === "pos" ? "หน้าร้าน" : `#${v.orderNo}`} · {ago(v.at)} · {v.items}
                  </small>
                </div>
                <p>{v.comment || <span className="rvp-none">ให้คะแนนอย่างเดียว ไม่ได้เขียนข้อความ</span>}</p>
                {draft?.id === v.id ? (
                  <div className="rvp-replybox">
                    <label htmlFor={`reply-${v.id}`}>ตอบกลับจากร้าน (ลูกค้าคนอื่นเห็นด้วยถ้ารีวิวนี้แสดงอยู่)</label>
                    <textarea
                      id={`reply-${v.id}`}
                      rows={3}
                      maxLength={MAX_REPLY}
                      value={draft.text}
                      placeholder={v.rating <= 3 ? "เช่น ขอโทษที่ให้รอนานนะ ร้านเพิ่มคนช่วงเที่ยงแล้ว" : "เช่น ขอบคุณมากเลย แล้วแวะมาใหม่นะ"}
                      onChange={(e) => setDraft({ id: v.id, text: e.target.value })}
                    />
                    <div className="rvp-acts">
                      <small>
                        {draft.text.length}/{MAX_REPLY}
                      </small>
                      <button className="ghost-btn" disabled={saving} onClick={() => setDraft(null)}>
                        ยกเลิก
                      </button>
                      <button className="btn primary-sm" disabled={saving || !draft.text.trim()} onClick={() => saveReply(v, draft.text)}>
                        {saving ? "กำลังบันทึก…" : "บันทึกคำตอบ"}
                      </button>
                    </div>
                  </div>
                ) : (
                  v.reply && (
                    <div className="rv-reply">
                      <b>ตอบกลับจากร้าน · {v.repliedAt ? ago(v.repliedAt) : ""}</b>
                      <p>{v.reply}</p>
                    </div>
                  )
                )}
                <div className="rvp-acts">
                  {draft?.id !== v.id && (
                    <>
                      <button className="ghost-btn" onClick={() => setDraft({ id: v.id, text: v.reply })}>
                        {v.reply ? "แก้คำตอบ" : "ตอบกลับ"}
                      </button>
                      {v.reply && (
                        <button className="ghost-btn" disabled={saving} onClick={() => saveReply(v, "")}>
                          ลบคำตอบ
                        </button>
                      )}
                    </>
                  )}
                  {!v.isPublic ? (
                    <span className="rvp-tag">ลูกค้าขอไม่แสดงต่อคนอื่น</span>
                  ) : (
                    <button className="ghost-btn" onClick={() => toggle(v)}>
                      {v.hidden ? "แสดงในหน้าลูกค้า" : "ซ่อนจากหน้าลูกค้า"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
