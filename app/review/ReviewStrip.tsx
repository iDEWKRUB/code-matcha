"use client";

import { ago } from "@/lib/reviews";
import Star from "./Star";
import { useReviews } from "./useReviews";

// ป้ายคะแนนรวมบนหัวหน้าเว็บ (แตะแล้วเลื่อนลงไปส่วนรีวิว) · ยังไม่มีรีวิว = ไม่แสดง
export function RatingBadge() {
  const r = useReviews();
  if (!r || !r.count) return null;
  return (
    <a className="rv-badge" href="#reviews" aria-label={`คะแนนร้าน ${r.avg.toFixed(1)} จาก 5 · ${r.count} รีวิว`}>
      <Star on size={15} />
      <b>{r.avg.toFixed(1)}</b>
      <span>· {r.count} รีวิว ›</span>
    </a>
  );
}

// รีวิวจากลูกค้าในหน้าสั่ง (ไม่ระบุชื่อ) + คำตอบจากร้าน · ยังไม่มีรีวิวที่แสดงได้ = ไม่แสดงส่วนนี้
export default function ReviewStrip() {
  const r = useReviews();
  if (!r || !r.count) return null;
  const max = Math.max(1, ...r.dist);
  return (
    <section className="menu-section rv-strip" id="reviews" aria-label="รีวิวจากลูกค้า">
      <h2 className="section-title">รีวิวจากลูกค้า</h2>
      <div className="rv-sum">
        <div className="rv-big">
          <b>{r.avg.toFixed(1)}</b>
          <span className="rv-row" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} on={n <= Math.round(r.avg)} size={16} />
            ))}
          </span>
          <small>{r.count} รีวิว</small>
        </div>
        <ul className="rv-dist" aria-label="จำนวนรีวิวแต่ละระดับดาว">
          {[5, 4, 3, 2, 1].map((n) => (
            <li key={n}>
              <span>{n}</span>
              <i>
                <em style={{ width: `${(r.dist[n - 1] / max) * 100}%` }} />
              </i>
              <small>{r.dist[n - 1]}</small>
            </li>
          ))}
        </ul>
      </div>
      {r.latest.length > 0 && (
        <ul className="rv-cards">
          {r.latest.map((v) => (
            <li key={v.id}>
              <span className="rv-row" aria-label={`${v.rating} ดาว`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} on={n <= v.rating} size={14} />
                ))}
              </span>
              {v.comment && <p>{v.comment}</p>}
              <small>
                ลูกค้า · {ago(v.at)}
                {v.items && ` · ${v.items}`}
              </small>
              {v.reply && (
                <div className="rv-reply">
                  <b>ตอบกลับจากร้าน</b>
                  <p>{v.reply}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
