"use client";

import type { Liff } from "@line/liff";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_QTY,
  MILKS,
  POWDERS,
  SHOT_PRICE,
  SOFT_CREAM_PRICE,
  SWEET,
  TEMP_LABEL,
  hasPowder,
  lineDetail,
  linePrice,
  type CartLine,
  type MenuItem,
  type Payment,
  type Slot,
} from "@/lib/menu";
import Cup, { tintOf } from "./Cup";
import Seal from "./Seal";

const tint = (id: string) => ({ "--tint": tintOf(id) }) as React.CSSProperties;

type Opts = Omit<CartLine, "itemId">;
type Done = { no: number; pickupTime: string; total: number };

// ย่อรูปสลิปก่อนอัปโหลด (รูปจากมือถือมักใหญ่หลาย MB)
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function OrderPage() {
  const [phase, setPhase] = useState<"loading" | "error" | "menu" | "pay" | "done">("loading");
  const [pay, setPay] = useState<Payment | null>(null);
  const [payErr, setPayErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [fatal, setFatal] = useState("");
  const [name, setName] = useState("");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [edit, setEdit] = useState<MenuItem | null>(null);
  const [opts, setOpts] = useState<Opts | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [pickup, setPickup] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [needLogin, setNeedLogin] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const liff = useRef<Liff | null>(null);

  const loadMenu = useCallback(async () => {
    const r = await fetch("/api/menu", { cache: "no-store" });
    if (!r.ok) throw new Error("โหลดเมนูไม่สำเร็จ");
    const j = (await r.json()) as { menu: MenuItem[]; slots: Slot[] };
    setMenu(j.menu);
    setSlots(j.slots);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (liffId) {
          const l = (await import("@line/liff")).default;
          await l.init({ liffId });
          if (!l.isLoggedIn()) {
            l.login({ redirectUri: location.href });
            return;
          }
          liff.current = l;
          setName((await l.getProfile()).displayName);
        } else if (process.env.NODE_ENV !== "production") {
          setName("Dev (โหมดทดสอบ)");
        } else {
          throw new Error("ยังไม่ได้ตั้งค่า LIFF");
        }
        await loadMenu();
        // มีออเดอร์ที่ยังไม่จ่ายค้างอยู่ → พากลับไปหน้าจ่ายเงิน
        const token = liff.current ? liff.current.getIDToken() : "dev";
        const r = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const pending = r.ok ? ((await r.json()) as { pending: Payment | null }).pending : null;
        if (pending) {
          setPay(pending);
          setPhase("pay");
        } else setPhase("menu");
      } catch (e) {
        setFatal(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
        setPhase("error");
      }
    })();
  }, [loadMenu]);

  const close = useCallback(() => {
    setEdit(null);
    setCheckout(false);
  }, []);

  useEffect(() => {
    if (phase !== "pay") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  const byId = (id: string) => menu.find((m) => m.id === id);
  const cups = cart.reduce((n, l) => n + l.qty, 0);
  const priceOf = (l: CartLine) => {
    const it = byId(l.itemId);
    return it ? linePrice(it, l) : 0;
  };
  const total = cart.reduce((n, l) => n + priceOf(l), 0);

  function open(it: MenuItem) {
    setEdit(it);
    setOpts({
      temp: it.temps[0],
      sweet: 50,
      milk: it.milk ? "fresh" : null,
      powder: hasPowder(it) ? POWDERS[0].id : null,
      extraShot: false,
      softCream: false,
      qty: 1,
    });
  }

  async function openCheckout() {
    setSendErr("");
    setCheckout(true);
    loadMenu().catch(() => {}); // รีเฟรชที่ว่างของช่องเวลา
  }

  async function submit() {
    setSending(true);
    setSendErr("");
    try {
      const token = liff.current ? liff.current.getIDToken() : "dev";
      if (!token) {
        setNeedLogin(true);
        throw new Error("เซสชัน LINE หมดอายุ");
      }
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lines: cart, pickupTime: pickup, note }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) setNeedLogin(true);
      if (r.status === 409) {
        setPickup("");
        await loadMenu().catch(() => {});
      }
      if (!r.ok) throw new Error(j.error ?? "สั่งไม่สำเร็จ ลองใหม่อีกครั้ง");
      setPay(j as Payment);
      setPayErr("");
      setCart([]);
      setNote("");
      setPickup("");
      setCheckout(false);
      setNow(Date.now());
      setPhase("pay");
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : "สั่งไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  }

  async function uploadSlip(file: File | undefined) {
    if (!file || !pay) return;
    setUploading(true);
    setPayErr("");
    try {
      const token = liff.current ? liff.current.getIDToken() : "dev";
      const fd = new FormData();
      fd.append("slip", await shrink(file), "slip.jpg");
      const r = await fetch(`/api/orders/${pay.id}/slip`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) setNeedLogin(true);
      if (!r.ok) throw new Error(j.error ?? "ส่งสลิปไม่สำเร็จ ลองใหม่อีกครั้ง");
      setDone({ no: pay.no, pickupTime: pay.pickupTime, total: pay.total });
      setPay(null);
      setPhase("done");
    } catch (e) {
      setPayErr(e instanceof Error ? e.message : "ส่งสลิปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function cancelPay() {
    if (!pay) return;
    const token = liff.current ? liff.current.getIDToken() : "dev";
    await fetch(`/api/orders/${pay.id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    setPay(null);
    setPhase("menu");
    loadMenu().catch(() => {});
  }

  function relogin() {
    const l = liff.current;
    if (!l) return;
    l.logout();
    l.login({ redirectUri: location.href });
  }

  if (phase === "loading")
    return (
      <main className="center">
        <Seal size={56} />
        กำลังโหลด…
      </main>
    );

  if (phase === "error")
    return (
      <main className="center">
        <Seal size={56} />
        <p>{fatal}</p>
        <button className="ghost" onClick={() => location.reload()}>ลองใหม่</button>
      </main>
    );

  if (phase === "pay" && pay) {
    const left = new Date(pay.expiresAt).getTime() - now;
    return (
      <main className="app pay">
        <Seal size={44} />
        <h1>ชำระเงินเพื่อยืนยันออเดอร์ #{pay.no}</h1>
        <p className="sub">รับที่ร้านเวลา {pay.pickupTime} น.</p>
        <p className="amount">฿{pay.total}</p>
        <div className="qr-card">
          <span className="pp">PromptPay</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pay.qr} alt={`QR พร้อมเพย์ ยอด ${pay.total} บาท`} />
        </div>
        <p className={`timer${left <= 0 ? " late" : ""}`} role="timer">
          {left > 0 ? `จองคิวไว้ให้อีก ${mmss(left)} นาที` : "หมดเวลาจองคิวแล้ว ถ้าโอนแล้วยังแนบสลิปได้"}
        </p>
        <ol className="steps">
          <li>กดค้างที่ QR เพื่อบันทึกรูป หรือแคปหน้าจอ</li>
          <li>สแกนจ่ายด้วยแอปธนาคาร ยอด ฿{pay.total}</li>
          <li>กลับมาที่หน้านี้ แล้วแนบสลิปการโอน</li>
        </ol>
        <div className="acts">
          <label className={`primary upload${uploading ? " busy" : ""}`}>
            {uploading ? "กำลังส่งสลิป…" : "แนบสลิปการโอน"}
            <input type="file" accept="image/*" disabled={uploading} onChange={(e) => uploadSlip(e.target.files?.[0])} />
          </label>
          {payErr && <p className="err" role="alert">{payErr}</p>}
          {needLogin && liff.current && (
            <button className="ghost" onClick={relogin}>เข้าสู่ระบบ LINE ใหม่</button>
          )}
          <button className="ghost" onClick={cancelPay} disabled={uploading}>ยกเลิกออเดอร์</button>
        </div>
      </main>
    );
  }

  if (phase === "done" && done)
    return (
      <main className="app done">
        <div className="stamp">
          <div>
            <p className="k">受付</p>
            <p className="n">#{done.no}</p>
          </div>
        </div>
        <h2>ส่งสลิปแล้ว รอร้านตรวจยอด</h2>
        <p className="t">
          ยอด ฿{done.total} · รับที่ร้าน <strong>{done.pickupTime} น.</strong>
          <br />
          เมื่อร้านยืนยันการชำระเงิน จะแจ้งทาง LINE พร้อมจำนวนคิว
          <br />
          และแจ้งอีกครั้งเมื่อเครื่องดื่มพร้อมรับ
        </p>
        <div className="acts">
          {liff.current?.isInClient() && (
            <button className="primary" onClick={() => liff.current?.closeWindow()}>กลับไปที่แชท</button>
          )}
          <button
            className="ghost"
            onClick={() => {
              setPhase("menu");
              loadMenu().catch(() => {});
            }}
          >
            สั่งเพิ่ม
          </button>
        </div>
      </main>
    );

  return (
    <main className="app">
      <header className="hero">
        <div className="hero-in">
          <span className="hero-seal">
            <Seal size={52} />
          </span>
          <div>
            <p className="hero-jp">いらっしゃいませ</p>
            <h1>CODE-MACHA</h1>
            <p>สวัสดี {name} วันนี้รับอะไรดี?</p>
          </div>
        </div>
        <svg className="wave" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 22 Q50 2 100 22 T200 22 T300 22 T400 22 V40 H0 Z" />
        </svg>
      </header>

      <ul className="grid">
        {menu.map((m) => {
          const n = cart.filter((l) => l.itemId === m.id).reduce((a, l) => a + l.qty, 0);
          return (
            <li key={m.id}>
              <button className="card" style={tint(m.id)} onClick={() => open(m)} disabled={!m.available}>
                <div className="card-art">
                  <Cup itemId={m.id} temp={m.temps[0]} milk={m.milk ? "fresh" : null} size={104} />
                  {n > 0 && <span className="badge">{n}</span>}
                  {!m.available && <span className="soldout">หมดวันนี้</span>}
                </div>
                <p className="jp">{m.jp}</p>
                <p className="nm">{m.name}</p>
                <p className="ds">{m.description}</p>
                <div className="card-f">
                  <b>฿{m.price}</b>
                  {m.available && <span className="plus" aria-hidden="true">+</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint">ชำระผ่านพร้อมเพย์ก่อน ออเดอร์จึงเข้าคิว</p>

      {cups > 0 && !checkout && !edit && (
        <button key={cups} className="cartbar bump" onClick={openCheckout}>
          <span>ตะกร้า {cups} แก้ว</span>
          <span>฿{total}</span>
        </button>
      )}

      {edit && opts && (
        <>
          <div className="backdrop" onClick={close} />
          <div className="sheet" role="dialog" aria-label="เลือกตัวเลือก">
            <div className="grab" />
            <div className="sheet-art" style={tint(edit.id)}>
              <Cup
                key={`${edit.id}-${opts.temp}-${opts.milk}`}
                itemId={edit.id}
                temp={opts.temp}
                milk={opts.milk}
                sweet={opts.sweet}
                powder={opts.powder}
                extraShot={opts.extraShot}
                softCream={opts.softCream}
                animate
                size={150}
              />
            </div>
            <p className="jp" style={{ fontSize: 14 }}>{edit.jp}</p>
            <h2>{edit.name}</h2>
            <p className="ds">{edit.description}</p>

            {edit.temps.length > 1 && (
              <>
                <div className="lg">อุณหภูมิ</div>
                <div className="chips">
                  {edit.temps.map((t) => (
                    <button key={t} className="chip" aria-pressed={opts.temp === t} onClick={() => setOpts({ ...opts, temp: t, softCream: t === "iced" && opts.softCream })}>
                      {TEMP_LABEL[t]}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="lg">
              ความหวาน<span>{opts.sweet === 0 ? "ไม่หวาน" : `${opts.sweet}%`}</span>
            </div>
            <div className="gauge">
              {SWEET.map((s) => (
                <button key={s} aria-pressed={opts.sweet === s} aria-label={`หวาน ${s}%`} onClick={() => setOpts({ ...opts, sweet: s })}>
                  <i
                    className={opts.sweet > 0 && s <= opts.sweet ? "on" : opts.sweet === 0 && s === 0 ? "zero" : ""}
                    style={{ height: 8 + (s / 25) * 5 }}
                  />
                  <small>{s}</small>
                </button>
              ))}
            </div>

            {edit.milk && (
              <>
                <div className="lg">ชนิดนม</div>
                <div className="chips">
                  {MILKS.map((m) => (
                    <button key={m.id} className="chip" aria-pressed={opts.milk === m.id} onClick={() => setOpts({ ...opts, milk: m.id })}>
                      {m.label}
                      {m.price > 0 && <em>+{m.price}</em>}
                    </button>
                  ))}
                </div>
              </>
            )}

            {opts.powder && (
              <>
                <div className="lg">ผงมัทฉะ</div>
                <div className="chips">
                  {POWDERS.map((p) => (
                    <button key={p.id} className="chip" aria-pressed={opts.powder === p.id} onClick={() => setOpts({ ...opts, powder: p.id })}>
                      {p.label}
                      {p.price > 0 && <em>+{p.price}</em>}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="lg">ท็อปปิ้ง</div>
            <label className="row" style={{ marginTop: 0 }}>
              <span>
                เพิ่มช็อตมัทฉะ <span style={{ fontWeight: 400, color: "var(--stone)" }}>+{SHOT_PRICE}</span>
              </span>
              <input type="checkbox" checked={opts.extraShot} onChange={(e) => setOpts({ ...opts, extraShot: e.target.checked })} />
            </label>
            {opts.temp === "iced" && (
              <label className="row" style={{ marginTop: 0 }}>
                <span>
                  ท็อปซอฟต์ครีม <span style={{ fontWeight: 400, color: "var(--stone)" }}>+{SOFT_CREAM_PRICE}</span>
                </span>
                <input type="checkbox" checked={opts.softCream} onChange={(e) => setOpts({ ...opts, softCream: e.target.checked })} />
              </label>
            )}

            <div className="buy">
              <div className="stepper">
                <button disabled={opts.qty <= 1} aria-label="ลดจำนวน" onClick={() => setOpts({ ...opts, qty: opts.qty - 1 })}>−</button>
                <span>{opts.qty}</span>
                <button disabled={opts.qty >= MAX_QTY} aria-label="เพิ่มจำนวน" onClick={() => setOpts({ ...opts, qty: opts.qty + 1 })}>+</button>
              </div>
              <button
                className="primary"
                onClick={() => {
                  setCart([...cart, { itemId: edit.id, ...opts }]);
                  setEdit(null);
                }}
              >
                ใส่ตะกร้า ฿{linePrice(edit, { itemId: edit.id, ...opts })}
              </button>
            </div>
          </div>
        </>
      )}

      {checkout && (
        <>
          <div className="backdrop" onClick={close} />
          <div className="sheet" role="dialog" aria-label="ยืนยันออเดอร์">
            <div className="grab" />
            <h2>ออเดอร์ของคุณ</h2>
            <ul className="lines">
              {cart.map((l, i) => (
                <li key={i}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600 }}>
                      {byId(l.itemId)?.name} <span style={{ fontWeight: 400, color: "var(--stone)" }}>x{l.qty}</span>
                    </p>
                    <p className="ds">{lineDetail(l)}</p>
                  </div>
                  <p style={{ fontWeight: 600 }}>฿{priceOf(l)}</p>
                  <button
                    className="x"
                    aria-label="ลบรายการ"
                    onClick={() => {
                      const next = cart.filter((_, j) => j !== i);
                      setCart(next);
                      if (!next.length) setCheckout(false);
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            <div className="lg">เวลารับที่ร้าน (วันนี้)</div>
            {slots.length === 0 ? (
              <p className="ds">วันนี้ไม่มีรอบรับเหลือแล้ว</p>
            ) : (
              <div className="slots">
                {slots.map((s) => {
                  const full = s.remaining < cups;
                  return (
                    <button key={s.time} className="slot" disabled={full} aria-pressed={pickup === s.time} onClick={() => setPickup(s.time)}>
                      <b>{s.time}</b>
                      <small>{full ? "เต็ม" : `ว่าง ${s.remaining}`}</small>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="lg">หมายเหตุถึงร้าน</div>
            <textarea rows={2} maxLength={200} placeholder="เช่น แยกน้ำแข็ง, ขอหลอดกระดาษ" value={note} onChange={(e) => setNote(e.target.value)} />

            <button className="primary" style={{ marginTop: 20, minHeight: 56 }} disabled={!pickup || sending} onClick={submit}>
              {sending ? "กำลังส่ง…" : pickup ? `ไปชำระเงิน ฿${total}` : "เลือกเวลารับก่อน"}
            </button>
            {sendErr && <p className="err" role="alert">{sendErr}</p>}
            {needLogin && liff.current && (
              <button className="ghost" onClick={relogin}>เข้าสู่ระบบ LINE ใหม่</button>
            )}
            <p className="small">ถัดไปจะแสดง QR พร้อมเพย์ ระบบจองเวลารับไว้ให้ 10 นาที</p>
          </div>
        </>
      )}
    </main>
  );
}
