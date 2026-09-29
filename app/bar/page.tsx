"use client";

import type { Liff } from "@line/liff";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BAR_MAX_QTY,
  COOK_SECONDS,
  EXTRA_LABEL,
  TERMS,
  TERMS_VERSION,
  TRAY_KEEP_DAYS,
  barIdFromQr,
  type BarItem,
  type ExtraItem,
  type ExtraStatus,
} from "@/lib/bar";
import { SHOP } from "@/lib/config";
import type { OrderItem, Payment } from "@/lib/menu";
import Icon from "../Icon";
import Seal from "../Seal";
import BarLoader from "./BarLoader";
import PayHowTo from "./PayHowTo";
import BarArt from "./BarArt";
import Slurp from "./Slurp";
import type { TrayScan } from "./scan";

type Hours = { openNow: boolean; openTime: string; closeTime: string; accepting: boolean };
type Pending = Payment & { status?: string };
type Done = { no: number; total: number; earned: number; points: number };
type Phase = "loading" | "error" | "home" | "scan" | "pay" | "done" | "history" | "extra";
type Bill = {
  id: number;
  no: number;
  at: string;
  items: OrderItem[];
  total: number;
  paid: boolean;
  photo: string | null;
  extra: number;
  extraNote: string;
  extraStatus: ExtraStatus;
};
type Extra = {
  id: number;
  no: number;
  at: string;
  items: OrderItem[];
  total: number;
  photo: string | null;
  extra: number;
  extraItems: ExtraItem[];
  note: string;
  status: ExtraStatus;
  qr: string | null;
};

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
  phone: "M8.5 2.5h7a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 19V5a2.5 2.5 0 0 1 2.5-2.5ZM9.5 7.5h2v2h-2zM12.5 7.5h2v2h-2zM9.5 10.5h2v2h-2zM10 17h4",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 8v5M12 16h.01",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  next: "M9 5l7 7-7 7",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
};

export default function BarPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [fatal, setFatal] = useState("");
  const [items, setItems] = useState<BarItem[]>([]);
  const [hours, setHours] = useState<Hours | null>(null);
  const [autoSlip, setAutoSlip] = useState(false);
  const [name, setName] = useState("");
  const [points, setPoints] = useState(0);
  const [tray, setTray] = useState<Record<string, number>>({});
  const [shot, setShot] = useState<TrayScan | null>(null);
  const [detected, setDetected] = useState<Record<string, number>>({});
  const [unknownQr, setUnknownQr] = useState(0);
  const [unreadable, setUnreadable] = useState(0);
  const [agree, setAgree] = useState<boolean[]>(TERMS.map(() => false));
  const [history, setHistory] = useState<Bill[] | null>(null);
  const [extra, setExtra] = useState<Extra | null>(null);
  const [extraErr, setExtraErr] = useState("");
  const [extraBusy, setExtraBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [picker, setPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [needFriend, setNeedFriend] = useState(false);
  const [pay, setPay] = useState<Pending | null>(null);
  const [uploading, setUploading] = useState(false);
  const [review, setReview] = useState<{ reason: string } | null>(null);
  // บิลใหม่: ดูวิธีจ่ายก่อน กดรับทราบแล้วค่อยเห็นยอด + QR
  const [howto, setHowto] = useState(false);
  const [qrCard, setQrCard] = useState<{ file: File; url: string } | null>(null);
  const [qrView, setQrView] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
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
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
        if (liffId) {
          const l = (await import("@line/liff")).default;
          await l.init({ liffId });
          if (!l.isLoggedIn()) {
            l.login({ redirectUri: location.href });
            return;
          }
          liff.current = l;
          l.getProfile()
            .then((p) => setName(p.displayName))
            .catch(() => {});
        } else if (process.env.NODE_ENV === "production") throw new Error("ยังไม่ได้ตั้งค่า LIFF");
        else setName("Dev (โหมดทดสอบ)");
        const bar = await barP;
        setItems(bar.items);
        setHours(bar.hours);
        setAutoSlip(bar.autoSlip);
        // มีบิลมาม่าบาร์ค้างอยู่ → กลับไปหน้าจ่าย/รอตรวจต่อ
        const r = await fetch("/api/bar/orders", { headers: { Authorization: `Bearer ${tok()}` }, cache: "no-store" });
        const j = r.ok ? ((await r.json()) as { pending: Pending | null; points: number }) : { pending: null, points: 0 };
        setPoints(j.points ?? 0);
        // เปิดจากการ์ด LINE: "แจ้งยอดชำระเพิ่ม" → หน้าชำระเพิ่ม, "ได้รับชำระเพิ่ม" → ประวัติ
        const q = new URLSearchParams(location.search);
        const extraId = Number(q.get("extra"));
        if (Number.isInteger(extraId) && extraId > 0) openExtra(extraId);
        else if (q.get("history")) openHistory();
        else if (j.pending) {
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

  // กดรับทราบ → นับ 5 4 3 2 1 แล้วไปหน้า QR
  useEffect(() => {
    if (countdown === null) return;
    const t = setTimeout(() => {
      if (countdown > 1) setCountdown(countdown - 1);
      else {
        setCountdown(null);
        setHowto(false);
        window.scrollTo(0, 0);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // เตรียมรูป QR สำหรับบันทึก (ทำไว้ก่อน เพื่อให้กดแชร์ได้ทันทีในจังหวะที่ลูกค้ากด)
  useEffect(() => {
    if (!pay?.qr) return setQrCard(null);
    let url = "";
    let live = true;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 720;
      c.height = 980;
      const g = c.getContext("2d");
      if (!g) return;
      g.fillStyle = "#F3EFE4";
      g.fillRect(0, 0, 720, 980);
      g.fillStyle = "#2F4A2A";
      g.fillRect(0, 0, 720, 150);
      g.textAlign = "center";
      g.fillStyle = "#F3EFE4";
      g.font = "800 46px sans-serif";
      g.fillText("CODE-MATCHA", 360, 78);
      g.font = "500 26px sans-serif";
      g.fillStyle = "#C9DBAE";
      g.fillText(`มาม่าบาร์ · บิล #${pay.no}`, 360, 120);
      g.fillStyle = "#fff";
      g.fillRect(90, 190, 540, 540);
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 110, 210, 500, 500);
      g.fillStyle = "#1C2118";
      g.font = "500 28px sans-serif";
      g.fillText("ยอดที่ต้องชำระ (ใส่ไว้ใน QR แล้ว)", 360, 800);
      g.fillStyle = "#2F4A2A";
      g.font = "800 84px sans-serif";
      g.fillText(`฿${pay.total.toLocaleString()}`, 360, 895);
      g.fillStyle = "#8a8574";
      g.font = "400 22px sans-serif";
      g.fillText("สแกนจ่ายในแอปธนาคาร แล้วแนบสลิปในหน้ามาม่าบาร์", 360, 945);
      c.toBlob((b) => {
        if (!b || !live) return;
        url = URL.createObjectURL(b);
        setQrCard({ file: new File([b], `codematcha-${pay.no}.png`, { type: "image/png" }), url });
      }, "image/png");
    };
    img.src = pay.qr;
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [pay?.qr, pay?.no, pay?.total]);

  // บันทึกรูป QR: เบราว์เซอร์ LINE ไม่รองรับลิงก์ดาวน์โหลด → ใช้เมนูแชร์ของมือถือ ถ้าไม่มีก็เปิดรูปใหญ่ให้กดค้าง/แคปหน้าจอ
  function saveQr() {
    if (!qrCard) return setQrView(true);
    const data = { files: [qrCard.file] };
    if (typeof navigator.canShare === "function" && navigator.canShare(data)) {
      navigator.share(data).catch((e) => {
        if (e?.name !== "AbortError") setQrView(true);
      });
    } else if (!liff.current?.isInClient()) {
      const a = document.createElement("a");
      a.href = qrCard.url;
      a.download = qrCard.file.name;
      a.click();
    } else setQrView(true);
  }

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

  // รายการหรือรูปเปลี่ยน → ต้องติ๊กยอมรับใหม่ (ยืนยันกับรายการสุดท้ายจริง ๆ)
  useEffect(() => setAgree(TERMS.map(() => false)), [tray, shot]);

  const lines = Object.entries(tray).filter(([id, q]) => q > 0 && byId(id));
  const count = lines.reduce((n, [, q]) => n + q, 0);
  const total = lines.reduce((n, [id, q]) => n + (byId(id)?.price ?? 0) * q, 0);
  const closed = !!hours && !hours.openNow;
  const agreed = agree.every(Boolean);
  const ctaHint = !count
    ? "ยังไม่มีรายการ"
    : !shot
      ? "ถ่ายรูปถาดก่อน"
      : !agreed
        ? "ติ๊กยอมรับเงื่อนไขก่อน"
        : "";

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
      setDetected(counts);
      setUnknownQr(unknown);
      setUnreadable(s.bad.length);
      const known = s.codes.length - unknown;
      setScanMsg(
        s.bad.length
          ? `มี QR อ่านไม่ออก ${s.bad.length} จุด (กรอบแดง) · ถ่ายใหม่ให้ชัดขึ้นนะ`
          : known === 0
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

  async function openExtra(id: number) {
    setExtra(null);
    setExtraErr("");
    setPhase("extra");
    const r = await fetch(`/api/bar/orders/${id}/extra`, { headers: { Authorization: `Bearer ${tok()}` }, cache: "no-store" }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) return setExtraErr(j.error ?? "โหลดข้อมูลไม่สำเร็จ");
    setExtra(j as Extra);
  }

  async function payExtra(file?: File) {
    if (!file || !extra) return;
    setExtraBusy(true);
    setExtraErr("");
    try {
      const fd = new FormData();
      fd.append("slip", await shrink(file), "slip.jpg");
      const r = await fetch(`/api/bar/orders/${extra.id}/extra`, { method: "POST", headers: { Authorization: `Bearer ${tok()}` }, body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "ส่งสลิปไม่สำเร็จ");
      setExtra({ ...extra, status: j.status, qr: j.status === "paid" ? null : extra.qr });
      if (j.status === "review" && j.reason) setExtraErr(`ตรวจอัตโนมัติไม่ผ่าน: ${j.reason} · ร้านจะตรวจสลิปให้`);
    } catch (e) {
      setExtraErr(e instanceof Error ? e.message : "ส่งสลิปไม่สำเร็จ");
    } finally {
      setExtraBusy(false);
    }
  }

  async function openHistory() {
    setHistory(null);
    setPhase("history");
    const r = await fetch("/api/bar/history", { headers: { Authorization: `Bearer ${tok()}` }, cache: "no-store" }).catch(() => null);
    const j = r?.ok ? ((await r.json()) as { bills: Bill[] }) : { bills: [] };
    setHistory(j.bills);
  }

  async function checkout() {
    setSending(true);
    setErr("");
    setNeedFriend(false);
    try {
      if (!shot) throw new Error("ถ่ายรูปถาดก่อนนะ");
      const fd = new FormData();
      fd.append("lines", JSON.stringify(lines.map(([id, qty]) => ({ id, qty }))));
      fd.append("scan", JSON.stringify({ detected, unknown: unknownQr, unreadable }));
      fd.append("declared", String(count));
      fd.append("accept", String(TERMS_VERSION));
      fd.append("photo", await (await fetch(shot.photo)).blob(), "tray.jpg");
      const r = await fetch("/api/bar/orders", { method: "POST", headers: { Authorization: `Bearer ${tok()}` }, body: fd });
      const j = await r.json().catch(() => ({}));
      if (r.status === 403) setNeedFriend(true);
      if (!r.ok) throw new Error(j.error ?? "สั่งไม่สำเร็จ ลองใหม่อีกครั้ง");
      setPay(j as Pending);
      setReview(null);
      setHowto(true);
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
        setDetected({});
        setUnreadable(0);
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

  if (phase === "loading") return <BarLoader label="กำลังเตรียมมาม่าบาร์…" />;
  if (phase === "error")
    return (
      <main className="nb nb-center">
        <p>{fatal}</p>
        <button className="nb-btn" onClick={() => location.reload()}>ลองใหม่</button>
      </main>
    );

  if (phase === "home")
    return (
      <main className="nb nb-home">
        <header className="hero">
          <div className="hero-in">
            <span className="hero-seal">
              <Seal size={52} />
            </span>
            <div>
              <p className="hero-jp">いらっしゃいませ</p>
              <h1>CODE-MATCHA</h1>
              <p>สวัสดี {name} วันนี้ต้มมาม่ากันไหม?</p>
              <a className="points-chip" href="/member">
                <Icon name="gift" size={15} /> แต้มสะสม {points.toLocaleString()} แต้ม · บัตรสมาชิก ›
              </a>
            </div>
          </div>
          <svg className="wave" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 22 Q50 2 100 22 T200 22 T300 22 T400 22 V40 H0 Z" />
          </svg>
        </header>
        <div className="nb-mode" role="group" aria-label="โหมดสั่ง">
          <a href="/">สั่งกลับบ้าน / ล่วงหน้า</a>
          <span className="on" aria-current="true">อยู่ที่ร้าน</span>
        </div>
        {err && <p className="nb-err" role="alert">{err}</p>}
        <section className="nb-hero">
          <div className="nb-hero-text">
            <p className="nb-kicker">SELF-SERVE NOODLE BAR</p>
            <h2>
              มาม่าบาร์
              <br />
              บริการตัวเองทั้งร้าน
            </h2>
            <button className="nb-hero-cta" onClick={() => setPhase("scan")} disabled={closed}>
              {!closed && <Svg d={I.scan} size={20} />}
              {closed ? `ร้านเปิด ${hours?.openTime}–${hours?.closeTime} น.` : "เริ่มสแกนถาด"}
            </button>
          </div>
          <svg className="nb-hero-art" width="92" height="92" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M16 12c-2-3 2-4 0-7M24 12c-2-3 2-4 0-7M32 12c-2-3 2-4 0-7" fill="none" stroke="#C9DBAE" strokeWidth="1.8" strokeLinecap="round" />
            <ellipse cx="24" cy="20" rx="17" ry="4.5" fill="#E9A23B" />
            <path d="M13 19c2-2 3 2 5 0s3 2 5 0 3 2 5 0 3 2 5 0" fill="none" stroke="#FFE7A8" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M7 20c1 11 8 17 17 17s16-6 17-17c-4 3-10 4.5-17 4.5S11 23 7 20z" fill="#FDFAF3" />
            <path d="M9 28c4 3 9 4.5 15 4.5s11-1.5 15-4.5" stroke="#B8412C" strokeWidth="3" fill="none" />
          </svg>
        </section>
        <section className="nb-howto" aria-labelledby="nb-howto-h">
          <h2 id="nb-howto-h">วิธีใช้มาม่าบาร์</h2>
          <ol>
            <li>
              <span><Svg d={I.tray} size={20} /></span>หยิบใส่ถาด
            </li>
            <li>
              <span><Svg d={I.camera} size={20} /></span>ถ่ายรูป<br />1 รูป
            </li>
            <li>
              <span><Svg d={I.phone} size={20} /></span>จ่าย &amp;<br />แนบสลิป
            </li>
            <li>
              <span><Svg d={I.bowl} size={20} /></span>ต้มกิน<br />ได้เลย
            </li>
          </ol>
        </section>
        <p className="nb-tip">
          <Svg d={I.info} size={16} />
          สแกนไม่ติด กด + เพิ่มเอง ได้ หรือเรียกพนักงานที่เคาน์เตอร์
        </p>
        <button className="nb-histbtn" onClick={openHistory}>
          <Svg d={I.receipt} size={20} />
          <span>ประวัติการมากิน</span>
          <Svg d={I.next} size={18} />
        </button>
      </main>
    );

  if (phase === "history")
    return (
      <main className="nb nb-history">
        <header className="nb-bar">
          <button onClick={() => setPhase("home")} aria-label="ย้อนกลับ">
            <Svg d={I.back} />
          </button>
          <h1>ประวัติการมากิน</h1>
          <span />
        </header>
        {history === null ? (
          <p className="nb-muted nb-pad">กำลังโหลด…</p>
        ) : history.length === 0 ? (
          <p className="nb-muted nb-pad">ยังไม่มีประวัติ มาต้มมาม่ากันเลย!</p>
        ) : (
          <ul className="nb-bills">
            {history.map((b) => (
              <li key={b.id}>
                {b.photo ? (
                  <a href={b.photo} target="_blank" rel="noreferrer" className="nb-bill-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.photo} alt={`รูปถาดบิล #${b.no}`} loading="lazy" />
                  </a>
                ) : (
                  <span className="nb-bill-photo none">ไม่มีรูป</span>
                )}
                <div className="nb-bill-body">
                  <div className="nb-bill-head">
                    <b>บิล #{b.no}</b>
                    <span className={`nb-chip-s ${b.paid ? "ok" : "wait"}`}>{b.paid ? "ชำระแล้ว" : "รอร้านตรวจ"}</span>
                  </div>
                  <small className="nb-muted">
                    {new Date(b.at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })}
                  </small>
                  <p className="nb-bill-items">{b.items.map((i) => `${i.name} ×${i.qty}`).join(" · ")}</p>
                  <b className="nb-bill-total">฿{b.total}</b>
                  {b.extraStatus !== "none" && b.extra > 0 && (
                    <button className={`nb-extra-row ${b.extraStatus}`} onClick={() => openExtra(b.id)}>
                      <span>
                        {EXTRA_LABEL[b.extraStatus]} ฿{b.extra}
                      </span>
                      <span>{b.extraStatus === "due" ? "ชำระ ›" : "ดู ›"}</span>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="nb-muted nb-pad">เก็บประวัติพร้อมรูปถาดย้อนหลัง {TRAY_KEEP_DAYS} วัน</p>
      </main>
    );

  if (phase === "extra")
    return (
      <main className="nb nb-extra">
        <header className="nb-bar">
          <button onClick={openHistory} aria-label="ไปประวัติการมากิน">
            <Svg d={I.back} />
          </button>
          <h1>{extra ? `ชำระยอดเพิ่ม · บิล #${extra.no}` : "ชำระยอดเพิ่ม"}</h1>
          <span />
        </header>
        {!extra ? (
          <p className={extraErr ? "nb-err nb-pad" : "nb-muted nb-pad"}>{extraErr || "กำลังโหลด…"}</p>
        ) : (
          <>
            <section className="nb-ex-card">
              {extra.photo ? (
                <a href={extra.photo} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={extra.photo} alt={`รูปถาดบิล #${extra.no}`} />
                </a>
              ) : (
                <p className="nb-muted nb-pad">รูปถาดถูกลบตามระยะเวลาเก็บแล้ว</p>
              )}
              <div className="nb-ex-rows">
                <div className="nb-ex-row">
                  <span className="nb-muted">จ่ายแล้ว ({extra.items.map((i) => `${i.name.replace(/^(ท็อปปิ้ง|มาม่า(รส)?)\s*/, "")} ×${i.qty}`).join(", ")})</span>
                  <span>฿{extra.total}</span>
                </div>
                <div className="nb-muted">รายการในถาดที่ยังไม่ได้ชำระ</div>
                {extra.extraItems.map((i) => (
                  <div className="nb-ex-row" key={i.id}>
                    <span>
                      {i.name} ×{i.qty}
                    </span>
                    <span>฿{i.price * i.qty}</span>
                  </div>
                ))}
                {extra.note && <div className="nb-muted">ร้าน: {extra.note}</div>}
              </div>
            </section>
            <div className="nb-ex-amount">
              <small>{extra.status === "paid" ? "ชำระเพิ่มแล้ว" : "ยอดชำระเพิ่ม"}</small>
              <b className={extra.status === "paid" ? "ok" : ""}>฿{extra.extra}</b>
            </div>
            {extra.status === "paid" ? (
              <p className="nb-ex-done">
                <Svg d={I.check} size={20} />
                ได้รับชำระเพิ่มแล้ว ขอบคุณครับ
              </p>
            ) : (
              <>
                {extra.qr && (
                  <div className="nb-ex-qr">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={extra.qr} alt={`QR พร้อมเพย์ ยอด ${extra.extra} บาท`} />
                    <div>
                      <b>PromptPay</b>
                      <span>1. กดค้างที่ QR บันทึกรูป แล้วสแกนจ่าย</span>
                      <span>2. {autoSlip ? "แนบสลิป ระบบตรวจยอดให้อัตโนมัติ" : "แนบสลิป ร้านจะตรวจยอดให้"}</span>
                    </div>
                  </div>
                )}
                {extra.status === "review" && <p className="nb-warn nb-ex-note">แนบสลิปแล้ว รอร้านตรวจ ถ้าแนบผิดรูปแนบใหม่ได้</p>}
                {extraErr && <p className="nb-err nb-ex-note" role="alert">{extraErr}</p>}
                <div className="nb-acts">
                  <label className={`nb-btn solid${extraBusy ? " busy" : ""}`}>
                    <Svg d={I.upload} size={20} />
                    {extraBusy ? "กำลังตรวจสลิป…" : extra.status === "review" ? "แนบสลิปใหม่" : "แนบสลิป"}
                    <input type="file" accept="image/*" disabled={extraBusy} onChange={(e) => payExtra(e.target.files?.[0])} />
                  </label>
                  <button className="nb-link" onClick={addFriend}>
                    ไม่ตรงกับที่หยิบ? ทักแชทร้าน
                  </button>
                </div>
              </>
            )}
          </>
        )}
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
              {shot.bad.map((c, k) => (
                <span
                  key={`b${k}`}
                  className={`nb-box unread${(c.x + c.w / 2) / shot.width > 0.6 ? " r" : ""}`}
                  style={{ left: `${(c.x / shot.width) * 100}%`, top: `${(c.y / shot.height) * 100}%`, width: `${(c.w / shot.width) * 100}%`, height: `${(c.h / shot.height) * 100}%` }}
                >
                  <em>อ่านไม่ออก</em>
                </span>
              ))}
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
              <small className="nb-empty-note">รูปนี้ร้านเก็บไว้เป็นหลักฐานของบิล</small>
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
          {shot && count > 0 && (
            <div className="nb-count">
              <div>
                <b>รวมในถาด {count} ชิ้น</b>
                <small>เช็กว่าตรงกับของที่หยิบมา ถ้าไม่ครบกด + เพิ่มเอง</small>
              </div>
              <b className="nb-count-sum">฿{total}</b>
            </div>
          )}
          {shot && unreadable > 0 && (
            <p className="nb-alert" role="alert">
              <Svg d={I.retake} size={20} />
              <span>
                <b>มี QR อ่านไม่ออก {unreadable} จุด (กรอบแดงในรูป)</b>
                กดปุ่มถ่ายใหม่มุมขวาบน ถ่ายให้ชัด ไม่ให้แสงสะท้อน หรือกด + เพิ่มเอง ให้ครบตามของในถาด
              </span>
            </p>
          )}
          {shot && count > 0 && (
            <p className="nb-alert" role="note">
              <Svg d={I.info} size={20} />
              <span>
                <b>ร้านเก็บรูปถาดทุกบิลและนับสต๊อกทุกวัน</b>
                หากพบของในถาดไม่ตรงกับที่จ่าย ร้านจะเรียกเก็บเงินย้อนหลังตามจำนวนจริง กรุณาตรวจรายการให้ครบก่อนชำระ
              </span>
            </p>
          )}
          {shot && count > 0 && (
            <fieldset className="nb-terms">
              <legend>ก่อนชำระเงิน</legend>
              {TERMS.map((t, i) => (
                <label key={i}>
                  <input type="checkbox" checked={agree[i]} onChange={(e) => setAgree((a) => a.map((v, k) => (k === i ? e.target.checked : v)))} />
                  <span>{t}</span>
                </label>
              ))}
            </fieldset>
          )}
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
          <button className="nb-cta" disabled={!!ctaHint || sending || closed} onClick={checkout}>
            <span>{sending ? "กำลังสร้างบิล…" : closed ? "ร้านปิดอยู่" : ctaHint || "ไปชำระเงิน"}</span>
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
    if (howto)
      return (
        <main className="nb nb-pay2 pp-intro">
          <header className="nb-bar">
            <button onClick={cancelBill} aria-label="ยกเลิกบิล กลับไปแก้ถาด">
              <Svg d={I.back} />
            </button>
            <h1>วิธีชำระเงิน</h1>
            <span />
          </header>
          <div className="hw-head">
            <small>บิล #{pay.no} · ก่อนจ่าย ดูการ์ตูนนี้ก่อนนะ</small>
            <h2>จ่ายง่าย ๆ 3 ขั้น</h2>
          </div>
          <PayHowTo auto={autoSlip} big />
          <div className="pp-dock">
            <button className="nb-btn solid pp-attach" onClick={() => setCountdown(5)} disabled={countdown !== null}>
              <Svg d={I.check} size={20} />
              รับทราบ ไปหน้าชำระเงิน
            </button>
          </div>
          {countdown !== null && (
            <div className="hw-count" role="status" aria-live="assertive">
              <div className="hw-ring">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#E4DDCB" strokeWidth="8" />
                  <circle className="hw-arc" cx="60" cy="60" r="52" fill="none" stroke="#2F4A2A" strokeWidth="8" strokeLinecap="round" />
                </svg>
                <b key={countdown}>{countdown}</b>
              </div>
              <p>กำลังเตรียม QR ของคุณ…</p>
              <small>ยอด ฿{pay.total.toLocaleString()} · บิล #{pay.no}</small>
            </div>
          )}
        </main>
      );
    return (
      <main className="nb nb-pay2">
        <header className="nb-bar">
          <button onClick={cancelBill} aria-label="ยกเลิกบิล กลับไปแก้ถาด">
            <Svg d={I.back} />
          </button>
          <h1>ชำระเงิน</h1>
          <span />
        </header>

        <section className="pp-hero">
          <span className="pp-seal">
            <Seal size={40} />
          </span>
          <div className="pp-hero-txt">
            <small>
              มาม่าบาร์ · บิล #{pay.no}
              {count > 0 && ` · ${count} ชิ้น`}
            </small>
            <span>ยอดที่ต้องชำระ</span>
            <b>฿{pay.total.toLocaleString()}</b>
          </div>
          <span className={`pp-timer${left > 0 ? "" : " late"}`} role="timer">
            <Svg d={I.timer} size={15} />
            {left > 0 ? `จองไว้อีก ${mmss(left)}` : "ยังแนบสลิปได้"}
          </span>
        </section>

        <section className="pp-qr">
          <div className="pp-qr-head">
            <span className="pp-thaiqr">THAI QR PAYMENT</span>
            <b>PromptPay</b>
          </div>
          <div className="pp-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pay.qr} alt={`QR พร้อมเพย์ ยอด ${pay.total} บาท`} />
            <i className="pp-c pp-tl" />
            <i className="pp-c pp-tr" />
            <i className="pp-c pp-bl" />
            <i className="pp-c pp-br" />
            <i className="pp-line" aria-hidden="true" />
          </div>
          <p className="pp-to">
            จ่ายให้ <b>CODE-MATCHA</b> · ยอดใส่ไว้ใน QR แล้ว <b>฿{pay.total}</b>
          </p>
          <button className="pp-save" onClick={saveQr}>
            <Svg d={I.download} size={18} />
            บันทึกรูป QR
          </button>
          <small className="pp-hint">หรือแคปหน้าจอนี้ แล้วเลือกรูปในแอปธนาคารก็ได้</small>
        </section>

        <button className="pp-again" onClick={() => setHowto(true)}>
          <Svg d={I.info} size={16} />
          ดูวิธีจ่ายอีกครั้ง
        </button>

        {qrView && qrCard && (
          <div className="pp-view" role="dialog" aria-label="รูป QR สำหรับบันทึก" onClick={() => setQrView(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCard.url} alt={`QR พร้อมเพย์ ยอด ${pay.total} บาท`} onClick={(e) => e.stopPropagation()} />
            <p>
              <b>กดค้างที่รูป</b> แล้วเลือก &quot;บันทึกรูปภาพ&quot;
              <br />
              หรือ <b>แคปหน้าจอ</b> ตอนนี้เลยก็ได้
            </p>
            <button className="nb-btn outline" onClick={() => setQrView(false)}>
              เสร็จแล้ว
            </button>
          </div>
        )}

        <div className="pp-dock">
          {err && <p className="nb-err" role="alert">{err}</p>}
          <label className={`nb-btn solid pp-attach${uploading ? " busy" : ""}`}>
            <Svg d={I.upload} size={20} />
            {uploading ? "กำลังตรวจสลิป…" : "โอนแล้ว · แนบสลิป"}
            <input type="file" accept="image/*" disabled={uploading} onChange={(e) => uploadSlip(e.target.files?.[0])} />
          </label>
          <button className="pp-cancel" onClick={cancelBill} disabled={uploading}>
            ยกเลิกบิล กลับไปแก้ถาด
          </button>
        </div>

        {uploading && (
          <div className="pp-checking" role="status" aria-live="polite">
            <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
              <rect x="30" y="18" width="52" height="74" rx="6" fill="#fff" stroke="#1C2118" strokeWidth="3" />
              <rect x="40" y="30" width="32" height="5" rx="2.5" fill="#8FA86A" />
              <rect x="40" y="42" width="24" height="4" rx="2" fill="#CFC6AF" />
              <rect x="40" y="52" width="28" height="4" rx="2" fill="#CFC6AF" />
              <rect x="40" y="70" width="20" height="10" rx="2" fill="#1C2118" opacity=".85" />
              <g className="pp-glass">
                <circle cx="74" cy="66" r="18" fill="rgba(201,219,174,.35)" stroke="#2F4A2A" strokeWidth="5" />
                <path d="M87 79l14 14" stroke="#2F4A2A" strokeWidth="7" strokeLinecap="round" />
              </g>
            </svg>
            <b>กำลังตรวจสลิป…</b>
            <small>{autoSlip ? "ระบบกำลังเช็กยอดกับธนาคาร 2–3 วินาที" : "กำลังส่งสลิปให้ร้าน"}</small>
          </div>
        )}
      </main>
    );
  }

  if (phase === "done" && done) {
    const cookLeft = cookEnd ? cookEnd - now : 0;
    return (
      <main className="nb nb-done">
        <div className="nb-ok">
          <p className="nb-paid">
            <Svg d={I.check} size={16} />
            ชำระเรียบร้อย · บิล #{done.no} · ฿{done.total}
          </p>
          <Slurp size={250} />
          <h1>Enjoy! ต้มกินให้อร่อยนะ</h1>
          <p>ไปต้มมาม่าที่บาร์ได้เลย</p>
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
        <a className="nb-btn solid wide" href="/">
          <Svg d={I.home} size={20} />
          กลับหน้าหลัก
        </a>
      </main>
    );
  }
  return null;
}
