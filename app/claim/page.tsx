"use client";

import { useEffect, useState } from "react";
import Loader from "../Loader";
import Seal from "../Seal";

type State = { kind: "loading" } | { kind: "ok"; earned: number; points: number; review: string | null } | { kind: "error"; text: string };

// ลูกค้าหน้าร้านสแกน QR บนใบเสร็จ (เปิดผ่าน LIFF) → รับแต้มของบิลนั้นเข้าบัตรสมาชิก
export default function ClaimPage() {
  const [s, setS] = useState<State>({ kind: "loading" });

  useEffect(() => {
    (async () => {
      try {
        const t = new URLSearchParams(location.search).get("t") ?? "";
        let token = "dev";
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
        if (liffId) {
          const l = (await import("@line/liff")).default;
          await l.init({ liffId });
          if (!l.isLoggedIn()) {
            l.login({ redirectUri: location.href });
            return;
          }
          token = l.getIDToken() ?? "";
        } else if (process.env.NODE_ENV === "production") throw new Error("ยังไม่ได้ตั้งค่า LIFF");
        const r = await fetch("/api/pos/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ t }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "รับแต้มไม่สำเร็จ");
        setS({ kind: "ok", earned: j.earned, points: j.points, review: j.reviewToken ?? null });
      } catch (e) {
        setS({ kind: "error", text: e instanceof Error ? e.message : "รับแต้มไม่สำเร็จ" });
      }
    })();
  }, []);

  if (s.kind === "loading") return <Loader />;
  return (
    <main className="claim">
      <Seal size={64} />
      <p className="claim-jp">ありがとうございました</p>
      {s.kind === "ok" ? (
        <>
          <h1>รับแต้มเรียบร้อย</h1>
          <p className="claim-pts">
            <b>+{s.earned}</b> แต้ม
          </p>
          <p className="claim-sub">แต้มสะสมทั้งหมด {s.points.toLocaleString()} แต้ม · ใช้แทนเงินสดได้ตั้งแต่ 50 แต้ม</p>
        </>
      ) : (
        <>
          <h1>รับแต้มไม่ได้</h1>
          <p className="claim-sub">{s.text}</p>
        </>
      )}
      <div className="claim-acts">
        {s.kind === "ok" && s.review && (
          <a className="claim-btn" href={`/review?b=${s.review}`}>
            ให้คะแนนบิลนี้ (ไม่ระบุชื่อ)
          </a>
        )}
        <a className={`claim-btn${s.kind === "ok" && s.review ? " ghost" : ""}`} href="/member">
          ดูบัตรสมาชิก
        </a>
        <a className="claim-btn ghost" href="/">
          สั่งมัทฉะล่วงหน้า
        </a>
      </div>
    </main>
  );
}
