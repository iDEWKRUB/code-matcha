"use client";

import { useEffect, useState } from "react";
import type { ReviewSummary } from "@/lib/reviews";

// ดึงสรุปรีวิวครั้งเดียวต่อการเปิดหน้า (หัวหน้าเว็บกับส่วนรีวิวใช้ร่วมกัน)
let cache: Promise<ReviewSummary | null> | null = null;
const load = () =>
  (cache ??= fetch("/api/reviews")
    .then((r) => (r.ok ? (r.json() as Promise<ReviewSummary>) : null))
    .catch(() => null));

export function useReviews() {
  const [r, setR] = useState<ReviewSummary | null>(null);
  useEffect(() => {
    let live = true;
    load().then((x) => live && setR(x));
    return () => {
      live = false;
    };
  }, []);
  return r;
}
