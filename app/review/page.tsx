"use client";

import { useEffect, useState } from "react";
import { MAX_REVIEW, RATING_LABEL } from "@/lib/reviews";
import Loader from "../Loader";
import Seal from "../Seal";
import Star from "./Star";

type Form = { no: number; items: string; rating: number; comment: string; isPublic: boolean; edited: boolean };
type State = { kind: "loading" } | { kind: "form"; f: Form } | { kind: "sent"; rating: number } | { kind: "error"; text: string };

// ลูกค้ากด "ให้คะแนนแก้วนี้" จากการ์ด LINE → รีวิวแบบไม่ระบุชื่อ (ร้านไม่เห็นชื่อ)
export default function ReviewPage() {
  const [s, setS] = useState<State>({ kind: "loading" });
  const [token, setToken] = useState("dev");
  const [orderId, setOrderId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const o = Number(new URLSearchParams(location.search).get("o"));
        setOrderId(o);
        let t = "dev";
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
        if (liffId) {
          const l = (await import("@line/liff")).default;
          await l.init({ liffId });
          if (!l.isLoggedIn()) {
            l.login({ redirectUri: location.href });
            return;
          }
          t = l.getIDToken() ?? "";
        } else if (process.env.NODE_ENV === "production") throw new Error("ยังไม่ได้ตั้งค่า LIFF");
        setToken(t);
        const r = await fetch("/api/reviews", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ orderId: o }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "เปิดหน้ารีวิวไม่สำเร็จ");
        setS({ kind: "form", f: { no: j.no, items: j.items, rating: j.review?.rating ?? 0, comment: j.review?.comment ?? "", isPublic: j.review?.isPublic ?? true, edited: !!j.review } });
      } catch (e) {
        setS({ kind: "error", text: e instanceof Error ? e.message : "เปิดหน้ารีวิวไม่สำเร็จ" });
      }
    })();
  }, []);

  async function send(f: Form) {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId, rating: f.rating, comment: f.comment, isPublic: f.isPublic }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "ส่งรีวิวไม่สำเร็จ");
      setS({ kind: "sent", rating: f.rating });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ส่งรีวิวไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (s.kind === "loading") return <Loader />;
  if (s.kind === "error" || s.kind === "sent")
    return (
      <main className="claim rv-page">
        <Seal size={64} />
        <p className="claim-jp">ありがとうございました</p>
        <h1>{s.kind === "sent" ? "ขอบคุณสำหรับรีวิว" : "รีวิวไม่ได้"}</h1>
        <p className="claim-sub">{s.kind === "sent" ? (s.rating >= 4 ? "ดีใจที่ชอบนะ แล้วแวะมาใหม่น้า" : "ร้านจะเอาไปปรับปรุงให้ดีขึ้นแน่นอน") : s.text}</p>
        <div className="claim-acts">
          <a className="claim-btn" href="/">
            สั่งแก้วต่อไป
          </a>
        </div>
      </main>
    );

  const f = s.f;
  const set = (p: Partial<Form>) => setS({ kind: "form", f: { ...f, ...p } });
  return (
    <main className="rv-page rv-form">
      <header className="rv-head">
        <Seal size={44} />
        <div>
          <h1>ให้คะแนนแก้วนี้</h1>
          <p>
            ออเดอร์ #{f.no} · {f.items}
          </p>
        </div>
      </header>
      <p className="rv-anon">ไม่ระบุชื่อ ร้านจะเห็นแค่คะแนนและข้อความ</p>

      <fieldset className="rv-stars">
        <legend>คะแนน</legend>
        <div>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} ดาว ${RATING_LABEL[n]}`} aria-pressed={f.rating === n} onClick={() => set({ rating: n })}>
              <Star on={n <= f.rating} size={44} />
            </button>
          ))}
        </div>
        <p className="rv-label" aria-live="polite">
          {f.rating ? RATING_LABEL[f.rating] : "แตะดาวเพื่อให้คะแนน"}
        </p>
      </fieldset>

      <label className="rv-text">
        <span>{f.rating && f.rating <= 3 ? "อยากให้ร้านปรับตรงไหน" : "เล่าให้ร้านฟังหน่อย"} (ไม่บังคับ)</span>
        <textarea
          rows={4}
          maxLength={MAX_REVIEW}
          value={f.comment}
          placeholder="เช่น หวานกำลังดี ผงหอมมาก / รอนานไปนิด"
          onChange={(e) => set({ comment: e.target.value })}
        />
        <small>
          {f.comment.length}/{MAX_REVIEW}
        </small>
      </label>

      <label className="rv-public">
        <input type="checkbox" checked={f.isPublic} onChange={(e) => set({ isPublic: e.target.checked })} />
        <span>แสดงรีวิวนี้ให้ลูกค้าคนอื่นเห็น (ไม่แสดงชื่อ)</span>
      </label>

      {err && (
        <p className="rv-err" role="alert">
          {err}
        </p>
      )}
      <button className="rv-send" disabled={busy || !f.rating} onClick={() => send(f)}>
        {busy ? "กำลังส่ง…" : f.edited ? "บันทึกรีวิวที่แก้" : "ส่งรีวิว"}
      </button>
    </main>
  );
}
