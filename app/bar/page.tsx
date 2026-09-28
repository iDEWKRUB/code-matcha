"use client";

import type { Liff } from "@line/liff";
import { useCallback, useEffect, useRef, useState } from "react";
import { BAR_MAX_QTY, COOK_SECONDS, barIdFromQr, type BarItem } from "@/lib/bar";
import { POINTS, SHOP } from "@/lib/config";
import type { MenuItem, Payment } from "@/lib/menu";
import Loader from "../Loader";
import MenuArt from "../MenuArt";
import BarArt from "./BarArt";
import type { TrayScan } from "./scan";

type Hours = { openNow: boolean; openTime: string; closeTime: string; accepting: boolean };
type Pending = Payment & { status?: string };
type Done = { no: number; total: number; earned: number; points: number };
type Phase = "loading" | "error" | "home" | "scan" | "pay" | "done";

// ย่อรูปสลิปก่อนส่ง (รูปจากมือถือมักใหญ่หลาย MB)
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.9));
  } catch {
    return file;
  }
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.28);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
    navigator.vibrate?.([300, 150, 300]);
  } catch {}
}

const Svg = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const I = {
  back: "M15 5l-7 7 7 7",
  retake: "M4 12a8 8 0 0 1 14-5l2 2M20 5v4h-4M20 12a8 8 0 0 1-14 5l-2-2M4 19v-4h4",
  tray: "M3 15h18v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM6 15V8h5v7M13 15v-5h5v5",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M9 9h6v6H9z",
  bowl: "M5 11h14v2a7 7 0 0 1-14 0zM9 7c0-1 1-1 1-2M13 7c0-1 1-1 1-2",
  camera: "M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  image: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01",
  upload: "M12 16V4M7 9l5-5 5 5M5 20h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  timer: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2M10 2h4",
  home: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  menu: "M5 7h14M5 12h14M5 17h9",
  user: "M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c1.5-4 4.5-5 8-5s6.5 1 8 5",
  chat: "M4 5h16v11H9l-5 4z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
};

export default function BarPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [fatal, setFatal] = useState("");
  const [items, setItems] = useState<BarItem[]>([]);
  const [hours, setHours] = useState<Hours | null>(null);
  const [autoSlip, setAutoSlip] = useState(false);
  const [drinks, setDrinks] = useState<MenuItem[]>([]);
  const [tray, setTray] = useState<Record<string, number>>({});
  const [shot, setShot] = useState<TrayScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [picker, setPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [needFriend, setNeedFriend] = useState(false);
  const [pay, setPay] = useState<Pending | null>(null);
  const [uploading, setUploading] = useState(false);
  const [review, setReview] = useState<{ reason: string } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [cookEnd, setCookEnd] = useState<number | null>(null);
  const liff = useRef<Liff | null>(null);
  const beeped = useRef(false);

  const tok = () => (liff.current ? liff.current.getIDToken() : "dev");
  const byId = useCallback((id: string) => items.find((i) => i.id === id), [items]);

  useEffect(() => {
    (async () => {
      try {
        const barP = fetch("/api/bar", { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error("โหลดรายการไม่สำเร็จ");
          return r.json() as Promise<{ items: BarItem[]; hours: Hours; autoSlip: boolean }>;
        });
        const menuP = fetch("/api/menu", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : { menu: [] }))
          .catch(() => ({ menu: [] })) as Promise<{ menu: MenuItem[] }>;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
        if (liffId) {
          const l = (await import("@line/liff")).default;
          await l.init({ liffId });
          if (!l.isLoggedIn()) {
            l.login({ redirectUri: location.href });
            return;
          }
          liff.current = l;
        } else if (process.env.NODE_ENV === "production") throw new Error("ยังไม่ได้ตั้งค่า LIFF");
        const [bar, m] = await Promise.all([barP, menuP]);
        setItems(bar.items);
        setHours(bar.hours);
        setAutoSlip(bar.autoSlip);
        const d = m.menu.filter((x) => x.kind === "drink" && x.available);
        setDrinks([...d.filter((x) => x.recommended), ...d.filter((x) => !x.recommended)].slice(0, 4));
        // มีบิลมาม่าบาร์ค้างอยู่ → กลับไปหน้าจ่าย/รอตรวจต่อ
        const r = await fetch("/api/bar/orders", { headers: { Authorization: `Bearer ${tok()}` }, cache: "no-store" });
        const j = r.ok ? ((await r.json()) as { pending: Pending | null }) : { pending: null };
        if (j.pending) {
          setPay(j.pending);
          if (j.pending.status === "payment_review") setReview({ reason: "" });
          setPhase("pay");
        } else setPhase("home");
      } catch (e) {
        setFatal(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
        setPhase("error");
      }
    })();
  }, []);

  useEffect(() => {
    if (phase !== "pay" && !cookEnd) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase, cookEnd]);

  useEffect(() => {
    if (cookEnd && now >= cookEnd && !beeped.current) {
      beeped.current = true;
      beep();
    }
  }, [now, cookEnd]);

  // รอร้านตรวจสลิป: ถามสถานะทุก 4 วินาที
  useEffect(() => {
    if (phase !== "pay" || !review || !pay) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/bar/orders/${pay.id}`, { headers: { Authorization: `Bearer ${tok()}` }, cache: "no-store" }).catch(() => null);
      if (!r?.ok) return;
      const j = (await r.json()) as { status: string; no: number; total: number; earned: number; points?: number };
      if (j.status === "paid") {
        setDone({ no: j.no, total: j.total, earned: j.earned, points: j.points ?? 0 });
        setPhase("done");
      } else if (j.status === "cancelled") {
        setReview(null);
        setPay(null);
        setErr("ร้านตรวจไม่พบยอดโอน บิลนี้ถูกยกเลิก ถ้าโอนแล้วจริงแจ้งพนักงานได้เลย");
        setPhase("home");
      }
    }, 4000);
    return () => clearInterval(t);
  }, [phase, review, pay]);

  const lines = Object.entries(tray).filter(([id, q]) => q > 0 && byId(id));
  const count = lines.reduce((n, [, q]) => n + q, 0);
  const total = lines.reduce((n, [id, q]) => n + (byId(id)?.price ?? 0) * q, 0);
  const closed = !!hours && !hours.openNow;

  const setQty = (id: string, q: number) =>
    setTray((t) => {
      const n = { ...t };
      if (q <= 0) delete n[id];
      else n[id] = Math.min(BAR_MAX_QTY, q);
      return n;
    });

  async function onPhoto(file?: File) {
    if (!file) return;
    setScanning(true);
    setScanMsg("");
    try {
      const { scanTray } = await import("./scan");
      const s = await scanTray(file);
      const counts: Record<string, number> = {};
      let unknown = 0;
      for (const c of s.codes) {
        const id = barIdFromQr(c.text);
        if (id && byId(id)) counts[id] = (counts[id] ?? 0) + 1;
        else unknown++;
      }
      setShot(s);
      setTray(counts);
      const known = s.codes.length - unknown;
      setScanMsg(
        known === 0
          ? "ยังอ่าน QR ไม่เจอ ลองถ่ายใกล้ขึ้น ไม่ให้แสงสะท้อน หรือกดเพิ่มเอง"
          : `อ่าน QR ได้ ${known} ชิ้น${unknown ? ` · มี ${unknown} อันที่ไม่รู้จัก` : ""} · วางไม่ซ้อนกันนะ`,
      );
    } catch (e) {
      console.error(e);
      setScanMsg("อ่านรูปไม่สำเร็จ ลองถ่ายใหม่ หรือกดเพิ่มเอง");
    } finally {
      setScanning(false);
    }
  }

  async function checkout() {
    setSending(true);
    setErr("");
    setNeedFriend(false);
    try {
      const r = await fetch("/api/bar/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ lines: lines.map(([id, qty]) => ({ id, qty })) }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 403) setNeedFriend(true);
      if (!r.ok) throw new Error(j.error ?? "สั่งไม่สำเร็จ ลองใหม่อีกครั้ง");
      setPay(j as Pending);
      setReview(null);
      setPhase("pay");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "สั่งไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  }

  async function uploadSlip(file?: File) {
    if (!file || !pay) return;
    setUploading(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("slip", await shrink(file), "slip.jpg");
      const r = await fetch(`/api/bar/orders/${pay.id}/slip`, { method: "POST", headers: { Authorization: `Bearer ${tok()}` }, body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "ส่งสลิปไม่สำเร็จ");
      if (j.status === "paid") {
        setDone({ no: j.no, total: j.total, earned: j.earned, points: j.points });
        setTray({});
        setShot(null);
        setPhase("done");
      } else setReview({ reason: j.reason ?? "" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ส่งสลิปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function cancelBill() {
    if (!pay) return;
    const r = await fetch(`/api/orders/${pay.id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${tok()}` } });
    if (!r.ok) {
      setErr("ยกเลิกไม่ได้แล้ว (ส่งสลิปไปแล้ว)");
      return;
    }
    setPay(null);
    setPhase("scan");
  }

  function openOut(url: string) {
    if (liff.current?.isInClient() && url.startsWith("https://line.me")) liff.current.openWindow({ url, external: false });
    else location.href = url;
  }
  const addFriend = () => openOut(`https://line.me/R/ti/p/${encodeURIComponent(SHOP.lineOaId)}`);

  if (phase === "loading") return <Loader label="กำลังเตรียมมาม่าบาร์…" />;
  if (phase === "error")
    return (
      <main className="nb nb-center">
        <p>{fatal}</p>
        <button className="nb-btn" onClick={() => location.reload()}>ลองใหม่</button>
      </main>
    );

  const nav = (
    <nav className="nb-nav" aria-label="เมนูหลัก">
      <button className={phase === "home" ? "on" : ""} onClick={() => setPhase("home")}>
        <Svg d={I.home} />หน้าแรก
      </button>
      <a href="/">
        <Svg d={I.menu} />เมนูมัทฉะ
      </a>
      <button className="nb-nav-scan" onClick={() => setPhase("scan")} aria-label="สแกนถาด">
        <span>
          <Svg d={I.scan} size={26} />
        </span>
        สแกน
      </button>
      <a href="/member">
        <Svg d={I.user} />สมาชิก
      </a>
      <button onClick={addFriend}>
        <Svg d={I.chat} />แชทร้าน
      </button>
    </nav>
  );

  if (phase === "home")
    return (
      <main className="nb nb-home">
        <header className="nb-brand">
          <span className="nb-seal">暗号</span>
          <div>
            <b>CODE-MATCHA</b>
            <small>Matcha &amp; Working Space</small>
          </div>
        </header>
        <div className="nb-mode" role="group" aria-label="โหมดสั่ง">
          <a href="/">สั่งกลับบ้าน / ล่วงหน้า</a>
          <span className="on" aria-current="true">อยู่ที่ร้าน</span>
        </div>
        {err && <p className="nb-err" role="alert">{err}</p>}
        <section className="nb-hero">
          <p className="nb-kicker">SELF-SERVE NOODLE BAR</p>
          <h1>
            มาม่าบาร์
            <br />
            บริการตัวเองทั้งร้าน
          </h1>
          <ol className="nb-steps3">
            <li>
              <Svg d={I.tray} size={24} />วางบนถาด
            </li>
            <li>
              <Svg d={I.scan} size={24} />ถ่ายรูปสแกน
            </li>
            <li>
              <Svg d={I.bowl} size={24} />จ่าย &amp; ต้มเอง
            </li>
          </ol>
          <button className="nb-hero-cta" onClick={() => setPhase("scan")} disabled={closed}>
            {closed ? `ร้านเปิด ${hours?.openTime}–${hours?.closeTime} น.` : "เริ่มสแกนถาด"}
          </button>
        </section>
        {drinks.length > 0 && (
          <>
            <div className="nb-sec">
              <h2>มัทฉะที่บาร์</h2>
              <a href="/">ดูทั้งหมด</a>
            </div>
            <div className="nb-drinks">
              {drinks.map((d) => (
                <a key={d.id} href="/" className="nb-drink">
                  <span className="nb-drink-art">
                    <MenuArt item={d} size={72} />
                  </span>
                  <b>{d.name}</b>
                  <small>฿{d.promoPrice ?? d.price}</small>
                </a>
              ))}
            </div>
          </>
        )}
        {nav}
      </main>
    );

  if (phase === "scan")
    return (
      <main className="nb nb-scan">
        <header className="nb-bar dark">
          <button onClick={() => setPhase("home")} aria-label="ย้อนกลับ">
            <Svg d={I.back} />
          </button>
          <h1>สแกนถาด</h1>
          <label className={`nb-icon-btn${shot ? "" : " hide"}`} aria-label="ถ่ายใหม่">
            <Svg d={I.retake} />
            <input type="file" accept="image/*" capture="environment" onChange={(e) => (onPhoto(e.target.files?.[0]), (e.target.value = ""))} />
          </label>
        </header>
        <div className="nb-stage">
          {shot ? (
            <div className="nb-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.photo} alt="รูปถาดที่ถ่าย" />
              {shot.codes.map((c, k) => {
                const it = byId(barIdFromQr(c.text) ?? "");
                return (
                  <span
                    key={k}
                    className={`nb-box${it ? "" : " bad"}${(c.x + c.w / 2) / shot.width > 0.6 ? " r" : ""}`}
                    style={{ left: `${(c.x / shot.width) * 100}%`, top: `${(c.y / shot.height) * 100}%`, width: `${(c.w / shot.width) * 100}%`, height: `${(c.h / shot.height) * 100}%` }}
                  >
                    <em>{it ? it.name.replace(/^(ท็อปปิ้ง|มาม่า(รส)?)\s*/, "") : "ไม่รู้จัก"}</em>
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="nb-empty">
              <Svg d={I.tray} size={44} />
              <p>วางของบนถาดไม่ให้ซ้อนกัน หันสติ๊กเกอร์ QR ขึ้นทุกชิ้น แล้วถ่ายรูปเดียว</p>
              <label className="nb-btn light">
                <Svg d={I.camera} />
                ถ่ายรูปถาด
                <input type="file" accept="image/*" capture="environment" onChange={(e) => (onPhoto(e.target.files?.[0]), (e.target.value = ""))} />
              </label>
              <label className="nb-link-light">
                เลือกรูปจากอัลบั้ม
                <input type="file" accept="image/*" onChange={(e) => (onPhoto(e.target.files?.[0]), (e.target.value = ""))} />
              </label>
            </div>
          )}
          {scanning && <p className="nb-chip">กำลังอ่าน QR…</p>}
          {!scanning && scanMsg && <p className="nb-chip">{scanMsg}</p>}
        </div>
        <section className="nb-sheet">
          <div className="nb-sheet-head">
            <h2>รายการในถาด</h2>
            <button className="nb-link" onClick={() => setPicker(true)}>
              + เพิ่มเอง
            </button>
          </div>
          {lines.length === 0 && <p className="nb-muted">ยังไม่มีรายการ ถ่ายรูปถาดหรือกดเพิ่มเอง</p>}
          <ul className="nb-lines">
            {lines.map(([id, q]) => {
              const it = byId(id)!;
              return (
                <li key={id}>
                  <BarArt kind={it.kind} size={36} />
                  <div>
                    <b>{it.name}</b>
                    <small>฿{it.price}</small>
                  </div>
                  <button aria-label={`ลด ${it.name}`} onClick={() => setQty(id, q - 1)}>
                    <Svg d={I.minus} size={18} />
                  </button>
                  <span className="q">{q}</span>
                  <button aria-label={`เพิ่ม ${it.name}`} onClick={() => setQty(id, q + 1)} disabled={q >= BAR_MAX_QTY}>
                    <Svg d={I.plus} size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
          {err && (
            <p className="nb-err" role="alert">
              {err}
              {needFriend && (
                <button className="nb-link" onClick={addFriend}>
                  เพิ่มเพื่อน
                </button>
              )}
            </p>
          )}
          <button className="nb-cta" disabled={!count || sending || closed} onClick={checkout}>
            <span>{sending ? "กำลังสร้างบิล…" : closed ? "ร้านปิดอยู่" : "ไปชำระเงิน"}</span>
            <span>฿{total}</span>
          </button>
        </section>
        {picker && (
          <div className="nb-modal" role="dialog" aria-modal="true" aria-label="เพิ่มของเอง" onClick={() => setPicker(false)}>
            <div className="nb-pick" onClick={(e) => e.stopPropagation()}>
              <div className="nb-sheet-head">
                <h2>เพิ่มของเอง</h2>
                <button className="nb-link" onClick={() => setPicker(false)}>
                  เสร็จ
                </button>
              </div>
              <ul className="nb-lines">
                {items.map((it) => (
                  <li key={it.id}>
                    <BarArt kind={it.kind} size={36} />
                    <div>
                      <b>{it.name}</b>
                      <small>฿{it.price}</small>
                    </div>
                    {tray[it.id] ? (
                      <>
                        <button aria-label={`ลด ${it.name}`} onClick={() => setQty(it.id, tray[it.id] - 1)}>
                          <Svg d={I.minus} size={18} />
                        </button>
                        <span className="q">{tray[it.id]}</span>
                      </>
                    ) : null}
                    <button aria-label={`เพิ่ม ${it.name}`} onClick={() => setQty(it.id, (tray[it.id] ?? 0) + 1)}>
                      <Svg d={I.plus} size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    );

  if (phase === "pay" && pay) {
    const left = new Date(pay.expiresAt).getTime() - now;
    if (review)
      return (
        <main className="nb nb-pay">
          <div className="nb-wait">
            <span className="nb-spin" aria-hidden="true" />
            <h1>ส่งสลิปแล้ว รอร้านตรวจยอด</h1>
            <p className="nb-muted">
              บิล #{pay.no} · ฿{pay.total}
              {review.reason && (
                <>
                  <br />
                  ตรวจอัตโนมัติไม่ผ่าน: {review.reason}
                </>
              )}
              <br />
              พนักงานกำลังตรวจให้ หน้านี้จะเปลี่ยนเองเมื่อร้านยืนยัน
            </p>
            <label className={`nb-btn outline${uploading ? " busy" : ""}`}>
              {uploading ? "กำลังส่ง…" : "แนบสลิปใหม่"}
              <input type="file" accept="image/*" disabled={uploading} onChange={(e) => uploadSlip(e.target.files?.[0])} />
            </label>
            {err && <p className="nb-err" role="alert">{err}</p>}
          </div>
        </main>
      );
    return (
      <main className="nb nb-pay">
        <header className="nb-bar">
          <button onClick={cancelBill} aria-label="ยกเลิกบิล กลับไปแก้ถาด">
            <Svg d={I.back} />
          </button>
          <h1>ชำระเงิน</h1>
          <span />
        </header>
        <div className="nb-amount">
          <small>ยอดที่ต้องชำระ · บิล #{pay.no}</small>
          <b>฿{pay.total}</b>
        </div>
        <div className="nb-qr">
          <div className="nb-qr-head">
            <b>PromptPay</b>
            <small>CODE-MATCHA</small>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pay.qr} alt={`QR พร้อมเพย์ ยอด ${pay.total} บาท`} />
          <small>{left > 0 ? `QR นี้ใส่ยอดเงินไว้แล้ว · จองไว้อีก ${mmss(left)}` : "ถ้าโอนแล้ว ยังแนบสลิปได้"}</small>
        </div>
        <ol className="nb-num">
          <li>กดค้างที่ QR เพื่อบันทึกรูป แล้วสแกนจ่ายด้วยแอปธนาคาร</li>
          <li>{autoSlip ? "แนบสลิป ระบบตรวจยอดให้อัตโนมัติ" : "แนบสลิป รอร้านตรวจยอดสักครู่"}</li>
        </ol>
        <div className="nb-acts">
          {err && <p className="nb-err" role="alert">{err}</p>}
          <a className="nb-btn outline" href={pay.qr} download={`codematcha-${pay.no}.png`}>
            บันทึกรูป QR
          </a>
          <label className={`nb-btn solid${uploading ? " busy" : ""}`}>
            <Svg d={I.upload} size={20} />
            {uploading ? "กำลังตรวจสลิป…" : "แนบสลิป"}
            <input type="file" accept="image/*" disabled={uploading} onChange={(e) => uploadSlip(e.target.files?.[0])} />
          </label>
        </div>
      </main>
    );
  }

  if (phase === "done" && done) {
    const cookLeft = cookEnd ? cookEnd - now : 0;
    const toNext = POINTS.minRedeem - (done.points % POINTS.minRedeem || 0);
    return (
      <main className="nb nb-done">
        <div className="nb-ok">
          <span>
            <Svg d={I.check} size={38} />
          </span>
          <h1>ชำระเรียบร้อย</h1>
          <p>บิล #{done.no} · ฿{done.total} · ตรวจสลิปแล้ว</p>
        </div>
        <section className="nb-card">
          <h2>ไปต้มได้เลย</h2>
          <ol className="nb-cook">
            <li>ใส่เส้นลงถ้วย เติมน้ำร้อนถึงขีด</li>
            <li>ใส่ท็อปปิ้ง ปิดฝารอ</li>
          </ol>
          {cookEnd ? (
            <div className={`nb-timer${cookLeft <= 0 ? " end" : ""}`} role="timer" aria-live="polite">
              {cookLeft > 0 ? mmss(cookLeft) : "ได้เวลาแล้ว คนให้เข้ากันแล้วทานได้เลย"}
              <button className="nb-link" onClick={() => setCookEnd(null)}>
                {cookLeft > 0 ? "หยุด" : "ปิด"}
              </button>
            </div>
          ) : (
            <button
              className="nb-btn dark"
              onClick={() => {
                beeped.current = false;
                setNow(Date.now());
                setCookEnd(Date.now() + COOK_SECONDS * 1000);
              }}
            >
              <Svg d={I.timer} size={18} />
              เริ่มจับเวลา {COOK_SECONDS / 60} นาที
            </button>
          )}
        </section>
        {drinks[0] && (
          <a className="nb-upsell" href="/">
            <span className="nb-upsell-art">
              <MenuArt item={drinks[0]} size={56} />
            </span>
            <span>
              <b>คู่กับมัทฉะเย็นสักแก้ว?</b>
              <small>สั่งจากเมนูมัทฉะได้เลย</small>
            </span>
            <em>สั่ง</em>
          </a>
        )}
        <section className="nb-card">
          <div className="nb-sheet-head">
            <h2>แต้มสะสม</h2>
            <small className="nb-muted">ใช้ร่วมกับมัทฉะ</small>
          </div>
          <p className="nb-points">
            <b>+{done.earned}</b> แต้มจากบิลนี้ · รวม <b>{done.points}</b> แต้ม
          </p>
          <div className="nb-meter" aria-hidden="true">
            <span style={{ width: `${Math.min(100, ((done.points % POINTS.minRedeem) / POINTS.minRedeem) * 100)}%` }} />
          </div>
          <small className="nb-muted">
            {done.points >= POINTS.minRedeem ? `ใช้เป็นส่วนลดได้แล้ว (ครั้งละ ${POINTS.minRedeem} แต้มขึ้นไป)` : `อีก ${toNext} แต้ม ใช้เป็นส่วนลดได้`}
          </small>
        </section>
        <button
          className="nb-btn outline wide"
          onClick={() => {
            setDone(null);
            setCookEnd(null);
            setPhase("home");
          }}
        >
          กลับหน้าแรก
        </button>
      </main>
    );
  }
  return null;
}
