"use client";

import { useEffect, useState } from "react";
import { ago, type ReviewSummary } from "@/lib/reviews";
import Star from "./Star";

// รีวิวจากลูกค้าในหน้าสั่ง (ไม่ระบุชื่อ) · ยังไม่มีรีวิวที่แสดงได้ = ไม่แสดงส่วนนี้
export default function ReviewStrip() {
  const [r, setR] = useState<ReviewSummary | null>(null);
  useEffect(() => {
    fetch("/api/reviews")
      .then((x) => (x.ok ? x.json() : null))
      .then(setR)
      .catch(() => {});
  }, []);
  if (!r || !r.count) return null;
  return (
    <section className="menu-section rv-strip" aria-label="รีวิวจากลูกค้า">
      <h2 className="section-title rv-title">
        รีวิวจากลูกค้า
        <span className="rv-avg">
          <Star on size={18} />
          <b>{r.avg.toFixed(1)}</b>
          <small>({r.count} รีวิว)</small>
        </span>
      </h2>
      {r.latest.length > 0 && (
        <ul className="rv-cards">
          {r.latest.map((v) => (
            <li key={v.id}>
              <span className="rv-row" aria-label={`${v.rating} ดาว`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} on={n <= v.rating} size={14} />
                ))}
              </span>
              <p>{v.comment}</p>
              <small>
                ลูกค้า · {ago(v.at)}
                {v.items && ` · ${v.items}`}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
