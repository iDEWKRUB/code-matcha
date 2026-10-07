"use client";

import { useEffect, useState } from "react";
import { ago, type AdminReview } from "@/lib/reviews";
import Star from "../review/Star";

// รีวิวทั้งหมดสำหรับร้าน (ไม่มีชื่อลูกค้า) · กรองดาว · ซ่อน/แสดงในหน้าลูกค้า
export default function ReviewsPanel() {
  const [list, setList] = useState<AdminReview[] | null>(null);
  const [err, setErr] = useState("");
  const [only, setOnly] = useState<number | "low" | null>(null);

  useEffect(() => {
    fetch("/api/admin/reviews", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "โหลดรีวิวไม่สำเร็จ");
        setList(j.reviews);
      })
      .catch((e) => setErr(e.message));
  }, []);

  async function toggle(v: AdminReview) {
    const r = await fetch("/api/admin/reviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: v.id, hidden: !v.hidden }) });
    if (r.ok) setList((l) => l && l.map((x) => (x.id === v.id ? { ...x, hidden: !v.hidden } : x)));
  }

  const all = list ?? [];
  const avg = all.length ? all.reduce((n, v) => n + v.rating, 0) / all.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: all.filter((v) => v.rating === n).length }));
  const shown = all.filter((v) => (only === null ? true : only === "low" ? v.rating <= 3 : v.rating === only));

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
                <div className="rvp-acts">
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
