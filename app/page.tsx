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
  type Slot,
} from "@/lib/menu";
import Cup, { tintOf } from "./Cup";
import Seal from "./Seal";

const tint = (id: string) => ({ "--tint": tintOf(id) }) as React.CSSProperties;

type Opts = Omit<CartLine, "itemId">;
type Done = { no: number; pickupTime: string; total: number; ahead: number };

export default function OrderPage() {
  const [phase, setPhase] = useState<"loading" | "error" | "menu" | "done">("loading");
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
        setPhase("menu");
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
      setDone(j as Done);
      setCart([]);
      setNote("");
      setPickup("");
      setCheckout(false);
      setPhase("done");
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : "สั่งไม่สำเร็จ");
    } finally {
      setSending(false);
    }
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

  if (phase === "done" && done)
    return (
      <main className="app done">
        <div className="stamp">
          <div>
            <p className="k">受付</p>
            <p className="n">#{done.no}</p>
          </div>
        </div>
        <h2>รับออเดอร์แล้ว</h2>
        <p className="t">
          มารับได้เวลา <strong>{done.pickupTime} น.</strong> แจ้งเลข #{done.no} ที่เคาน์เตอร์
          <br />
          {done.ahead > 0 ? (
            <>
              ตอนนี้มีคิวก่อนหน้า <strong>{done.ahead} คิว</strong>
            </>
          ) : (
            "ตอนนี้ไม่มีคิวก่อนหน้า"
          )}
          <br />
          ชำระ ฿{done.total} ที่ร้าน เราจะส่ง LINE บอกเมื่อพร้อมรับ
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
      <p className="hint">ชำระเงินที่หน้าร้านตอนรับเครื่องดื่ม</p>

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
              {sending ? "กำลังส่ง…" : pickup ? `ยืนยันสั่ง ฿${total}` : "เลือกเวลารับก่อน"}
            </button>
            {sendErr && <p className="err" role="alert">{sendErr}</p>}
            {needLogin && liff.current && (
              <button className="ghost" onClick={relogin}>เข้าสู่ระบบ LINE ใหม่</button>
            )}
            <p className="small">ชำระเงินที่หน้าร้านตอนรับเครื่องดื่ม</p>
          </div>
        </>
      )}
    </main>
  );
}
