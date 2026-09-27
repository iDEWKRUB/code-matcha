"use client";

import type { Liff } from "@line/liff";
import { useCallback, useEffect, useRef, useState } from "react";
import { POINTS, tierOf } from "@/lib/config";
import type { MenuItem } from "@/lib/menu";
import type { Coupon, HistoryRow, Reward } from "@/lib/member";
import Cup from "../Cup";
import Icon from "../Icon";
import MenuArt, { artTint } from "../MenuArt";
import Seal from "../Seal";

type Member = {
  memberNo: string;
  since: string | null;
  balance: number;
  earned: number;
  used: number;
  history: HistoryRow[];
  coupons: Coupon[];
  rewards: Reward[];
  art: Record<string, MenuItem>;
};
type View = "rewards" | "coupons" | "history";

const dateTH = (s: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "2-digit" }) =>
  new Date(s).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", ...o });
const pts = (n: number) => n.toLocaleString();

// กล่องของขวัญการ์ตูน (ใช้กับของขวัญที่ไม่ได้ผูกกับเมนู)
function GiftArt({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 200 250" aria-hidden="true">
      <path d="M100 78 C78 40 44 50 58 72 C66 84 88 80 100 78 C112 80 134 84 142 72 C156 50 122 40 100 78Z" fill="#d9432b" stroke="#1c2419" strokeWidth="5" strokeLinejoin="round" />
      <rect x="40" y="110" width="120" height="112" rx="12" fill="#9db54a" stroke="#1c2419" strokeWidth="5" />
      <rect x="30" y="80" width="140" height="38" rx="10" fill="#b8cf64" stroke="#1c2419" strokeWidth="5" />
      <rect x="88" y="80" width="24" height="142" fill="#d9432b" stroke="#1c2419" strokeWidth="5" />
      <ellipse cx="72" cy="158" rx="4.5" ry="6" fill="#1c2419" />
      <ellipse cx="128" cy="158" rx="4.5" ry="6" fill="#1c2419" />
      <circle cx="73.5" cy="155.5" r="1.6" fill="#fff" />
      <circle cx="129.5" cy="155.5" r="1.6" fill="#fff" />
      <path d="M62 180 Q70 186 78 180M122 180 Q130 186 138 180" fill="none" stroke="#f29c9c" strokeWidth="6" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

function RewardArt({ reward, art, size }: { reward: Reward; art: Record<string, MenuItem>; size: number }) {
  const item = reward.menuItemId ? art[reward.menuItemId] : undefined;
  return (
    <span className="rw-art" style={{ background: item ? artTint(item) : "#eef4dc" }}>
      {item ? <MenuArt item={item} size={size} /> : <GiftArt size={size} />}
    </span>
  );
}

export default function MemberPage() {
  const liff = useRef<Liff | null>(null);
  const [name, setName] = useState("");
  const [picture, setPicture] = useState<string | null>(null);
  const [m, setM] = useState<Member | null>(null);
  const [fatal, setFatal] = useState("");
  const [view, setView] = useState<View>("rewards");
  const [pick, setPick] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);

  const token = () => (liff.current ? liff.current.getIDToken() : "dev");

  const load = useCallback(async () => {
    const r = await fetch("/api/member", { headers: { Authorization: `Bearer ${token()}` }, cache: "no-store" });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "โหลดบัตรสมาชิกไม่สำเร็จ");
    setM(await r.json());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
        if (liffId) {
          const l = (await import("@line/liff")).default;
          await l.init({ liffId });
          if (!l.isLoggedIn()) {
            l.login({ redirectUri: location.href });
            return;
          }
          liff.current = l;
          const p = await l.getProfile();
          setName(p.displayName);
          setPicture(p.pictureUrl ?? null);
        } else if (process.env.NODE_ENV !== "production") {
          setName("Dev (โหมดทดสอบ)");
        } else throw new Error("ยังไม่ได้ตั้งค่า LIFF");
        await load();
      } catch (e) {
        setFatal(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      }
    })();
  }, [load]);

  async function redeem() {
    if (!pick) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/member/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ rewardId: pick.id, name }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "แลกไม่สำเร็จ ลองใหม่อีกครั้ง");
      setM(j.member);
      setPick(null);
      setCoupon(j.coupon);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "แลกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (fatal)
    return (
      <main className="app member">
        <p className="banner" role="alert" style={{ margin: 20 }}>
          {fatal}
        </p>
      </main>
    );
  if (!m)
    return (
      <main className="app member">
        <p className="mb-loading">กำลังเปิดบัตรสมาชิก…</p>
      </main>
    );

  const { tier, next } = tierOf(m.earned);
  const progress = next ? Math.min(100, Math.round(((m.earned - tier.from) / (next.from - tier.from)) * 100)) : 100;
  const waiting = m.coupons.filter((c) => c.status === "waiting");

  return (
    <main className="app member">
      <header className="mb-top">
        <span className="mb-avatar">{picture ? <img src={picture} alt="" /> : <Icon name="star" size={20} />}</span>
        <div>
          <b>{name}</b>
          <span>
            <Icon name="star" size={13} filled /> {pts(m.balance)} แต้ม
          </span>
        </div>
        <a href="/" className="mb-order">
          <Icon name="cup" size={16} /> สั่งเครื่องดื่ม
        </a>
      </header>

      <section className={`mcard t-${tier.id}`} aria-label={`บัตรสมาชิกระดับ ${tier.name}`}>
        <svg className="mcard-waves" viewBox="0 0 120 60" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <pattern id="seigaiha" width="20" height="10" patternUnits="userSpaceOnUse">
              <g fill="none" stroke="currentColor" strokeWidth=".6">
                <circle cx="10" cy="10" r="9" />
                <circle cx="10" cy="10" r="6" />
                <circle cx="10" cy="10" r="3" />
                <circle cx="0" cy="5" r="9" />
                <circle cx="0" cy="5" r="6" />
                <circle cx="0" cy="5" r="3" />
                <circle cx="20" cy="5" r="9" />
                <circle cx="20" cy="5" r="6" />
                <circle cx="20" cy="5" r="3" />
              </g>
            </pattern>
          </defs>
          <rect width="120" height="60" fill="url(#seigaiha)" />
        </svg>
        <span className="mcard-cup" aria-hidden="true">
          <Cup itemId="matcha-latte" temp="iced" milk="fresh" size={92} />
        </span>
        <div className="mcard-head">
          <Seal size={34} />
          <div>
            <b>CODE-MACHA</b>
            <small>MEMBER CARD</small>
          </div>
          <span className="mcard-tier">{tier.name}</span>
        </div>
        <div className="mcard-points">
          <small>แต้มคงเหลือ</small>
          <b>{pts(m.balance)}</b>
        </div>
        <div className="mcard-foot">
          <div>
            <b>{name}</b>
            <small>{m.since ? `สมาชิกตั้งแต่ ${dateTH(m.since, { day: "numeric", month: "short", year: "numeric" })}` : "สมาชิกใหม่"}</small>
          </div>
          <code>{m.memberNo}</code>
        </div>
      </section>

      <div className="mb-stats">
        <div>
          <small>ใช้ไปแล้ว</small>
          <b>{pts(m.used)}</b>
          <span>แต้ม</span>
        </div>
        <div>
          <small>สะสมทั้งหมด</small>
          <b>{pts(m.earned)}</b>
          <span>แต้ม</span>
        </div>
        <div>
          <small>คูปองรอรับ</small>
          <b>{waiting.length}</b>
          <span>ใบ</span>
        </div>
      </div>

      <section className="mb-level">
        <div className="mb-level-row">
          <b>
            ระดับ {tier.name} <small>{tier.th}</small>
          </b>
          {next && <span>{progress}%</span>}
        </div>
        <div className="mb-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="ความคืบหน้าระดับสมาชิก">
          <i style={{ width: `${progress}%` }} />
        </div>
        <p>
          {next ? (
            <>
              สะสมอีก <strong>{pts(next.from - m.earned)} แต้ม</strong> เลื่อนเป็น {next.name}
            </>
          ) : (
            "คุณอยู่ระดับสูงสุดแล้ว ขอบคุณที่อุดหนุนเสมอ"
          )}
        </p>
        <p className="mb-how">
          ทุก ฿{POINTS.bahtPerPoint} ได้ 1 แต้ม · ใช้แทนเงินสดได้ 1 แต้ม = ฿1 (ครั้งละ {POINTS.minRedeem} แต้มขึ้นไป) หรือแลกของขวัญด้านล่าง
        </p>
      </section>

      <nav className="mb-tabs" role="tablist" aria-label="บัตรสมาชิก">
        {(
          [
            ["rewards", "gift", "แลกของขวัญ"],
            ["coupons", "qr", "คูปองของฉัน"],
            ["history", "clock", "ประวัติแต้ม"],
          ] as const
        ).map(([id, icon, label]) => (
          <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}>
            <Icon name={icon} size={18} />
            {label}
            {id === "coupons" && waiting.length > 0 && <em>{waiting.length}</em>}
          </button>
        ))}
      </nav>

      {view === "rewards" &&
        (m.rewards.length === 0 ? (
          <p className="mb-empty">ยังไม่มีของขวัญให้แลกตอนนี้ สะสมแต้มไว้ก่อนนะ</p>
        ) : (
          <div className="rw-grid">
            {m.rewards.map((r) => {
              const short = r.points - m.balance;
              return (
                <article key={r.id} className="rw">
                  <RewardArt reward={r} art={m.art} size={78} />
                  <b>{r.name}</b>
                  {r.description && <small>{r.description}</small>}
                  <span className="rw-pts">
                    <Icon name="star" size={13} filled /> {pts(r.points)} แต้ม
                  </span>
                  {r.stock !== null && r.stock <= 5 && <span className="rw-stock">เหลือ {r.stock} สิทธิ์</span>}
                  <button
                    className="rw-btn"
                    disabled={short > 0}
                    onClick={() => {
                      setErr("");
                      setPick(r);
                    }}
                  >
                    {short > 0 ? `อีก ${pts(short)} แต้ม` : "แลกรางวัล"}
                  </button>
                </article>
              );
            })}
          </div>
        ))}

      {view === "coupons" &&
        (m.coupons.length === 0 ? (
          <p className="mb-empty">ยังไม่มีคูปอง แลกของขวัญแล้วคูปองจะมาอยู่ที่นี่</p>
        ) : (
          <ul className="coupons">
            {m.coupons.map((c) => (
              <li key={c.id} className={`coupon ${c.status}`}>
                <button onClick={() => c.status === "waiting" && setCoupon(c)} disabled={c.status !== "waiting"}>
                  <div>
                    <b>{c.rewardName}</b>
                    <small>
                      แลกเมื่อ {dateTH(c.createdAt)} · {pts(c.points)} แต้ม
                    </small>
                  </div>
                  <div className="coupon-code">
                    <code>{c.code}</code>
                    <span>{c.status === "waiting" ? "รอรับที่ร้าน" : "รับของแล้ว"}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {view === "history" &&
        (m.history.length === 0 ? (
          <p className="mb-empty">ยังไม่มีประวัติแต้ม สั่งเครื่องดื่มครั้งแรกเพื่อเริ่มสะสม</p>
        ) : (
          <ul className="mb-history">
            {m.history.map((h, i) => (
              <li key={i}>
                <div>
                  <b>{h.label}</b>
                  <small>{dateTH(h.at, { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</small>
                </div>
                <span className={h.delta > 0 ? "mb-plus" : "mb-minus"}>
                  {h.delta > 0 ? "+" : "−"}
                  {pts(Math.abs(h.delta))}
                </span>
              </li>
            ))}
          </ul>
        ))}

      <p className="small" style={{ margin: "26px 0 40px" }}>
        แต้มไม่มีวันหมดอายุ · เลิกเป็นเพื่อนแล้วกลับมา แต้มยังอยู่ครบ
      </p>

      {pick && (
        <>
          <div className="backdrop" onClick={() => !busy && setPick(null)} />
          <div className="sheet mb-sheet" role="dialog" aria-modal="true" aria-label="ยืนยันแลกของขวัญ">
            <RewardArt reward={pick} art={m.art} size={96} />
            <h2>{pick.name}</h2>
            {pick.description && <p className="mb-desc">{pick.description}</p>}
            <dl className="mb-calc">
              <dt>แต้มคงเหลือ</dt>
              <dd>{pts(m.balance)}</dd>
              <dt>ใช้แลก</dt>
              <dd>−{pts(pick.points)}</dd>
              <dt>คงเหลือหลังแลก</dt>
              <dd>
                <b>{pts(m.balance - pick.points)}</b>
              </dd>
            </dl>
            {err && (
              <p className="banner" role="alert">
                {err}
              </p>
            )}
            <button className="primary" onClick={redeem} disabled={busy}>
              {busy ? "กำลังแลก…" : `ยืนยันแลก ${pts(pick.points)} แต้ม`}
            </button>
            <button className="mb-cancel" onClick={() => setPick(null)} disabled={busy}>
              ยังไม่แลก
            </button>
          </div>
        </>
      )}

      {coupon && (
        <>
          <div className="backdrop" onClick={() => setCoupon(null)} />
          <div className="sheet mb-sheet" role="dialog" aria-modal="true" aria-label="คูปองของขวัญ">
            <p className="mb-ok">
              <Icon name="gift" size={18} /> คูปองพร้อมใช้
            </p>
            <h2>{coupon.rewardName}</h2>
            <div className="mb-ticket">
              <small>โค้ดคูปอง</small>
              <code>{coupon.code}</code>
              <span>แสดงหน้านี้ให้พนักงานที่ร้านเพื่อรับของขวัญ</span>
            </div>
            <p className="small">ดูคูปองนี้อีกครั้งได้ที่แท็บ "คูปองของฉัน"</p>
            <button
              className="primary"
              style={{ marginTop: 16 }}
              onClick={() => {
                setCoupon(null);
                setView("coupons");
              }}
            >
              เรียบร้อย
            </button>
          </div>
        </>
      )}
    </main>
  );
}
