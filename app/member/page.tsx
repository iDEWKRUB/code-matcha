"use client";

import type { Liff } from "@line/liff";
import { useCallback, useEffect, useRef, useState } from "react";
import { POINTS, tierOf } from "@/lib/config";
import type { MenuItem } from "@/lib/menu";
import type { Coupon, HistoryRow, Reward } from "@/lib/member";
import Cup from "../Cup";
import Icon from "../Icon";
import MenuArt, { artTint } from "../MenuArt";
import MerchArt, { MERCH_TINT } from "../MerchArt";
import Loader from "../Loader";
import Seal from "../Seal";
import { REWARD_CATEGORIES, type RewardCategory } from "@/lib/rewards";

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
  referral: {
    code: string;
    url: string;
    referrerPoints: number;
    friendPoints: number;
    friends: { name: string; rewarded: boolean }[];
    earned: number;
    referredBy: { name: string; status: string } | null;
    canEnterCode: boolean;
    shareMessage: unknown;
  };
};
type View = "rewards" | "coupons" | "history";

const dateTH = (s: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "2-digit" }) =>
  new Date(s).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", ...o });
const pts = (n: number) => n.toLocaleString();

// รูปของขวัญ: เมนูใช้การ์ตูนของเมนู · ของพรีเมียมใช้รูปถ่ายที่ร้านอัปโหลด หรือการ์ตูนตามแบบ
function RewardArt({ reward, art, size }: { reward: Reward; art: Record<string, MenuItem>; size: number }) {
  const item = reward.category === "menu" && reward.menuItemId ? art[reward.menuItemId] : undefined;
  if (reward.category === "merch" && reward.imageUrl)
    return (
      <span className="rw-art photo" style={{ height: size * 1.25 + 8 }}>
        <img src={reward.imageUrl} alt="" loading="lazy" />
      </span>
    );
  const look = reward.category === "merch" ? (reward.look ?? "gift") : "gift";
  return (
    <span className="rw-art" style={{ background: item ? artTint(item) : (MERCH_TINT[look] ?? MERCH_TINT.gift) }}>
      {item ? <MenuArt item={item} size={size} /> : <MerchArt look={look} size={size} />}
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
  const [cat, setCat] = useState<RewardCategory>("menu");
  const [pick, setPick] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [copied, setCopied] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [refBusy, setRefBusy] = useState(false);
  const [refMsg, setRefMsg] = useState<{ ok: boolean; text: string } | null>(null);

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

  // ส่งการ์ดชวนเพื่อนผ่าน LINE (shareTargetPicker) ถ้าใช้ไม่ได้ เปิดหน้าแชร์ข้อความของ LINE แทน
  async function share() {
    if (!m) return;
    const r = m.referral;
    const text = `มาลองมัทฉะร้าน CODE-MACHA กัน! สั่งครั้งแรกผ่านลิงก์นี้ รับ ${r.friendPoints} แต้ม (โค้ด ${r.code})\n${r.url}`;
    const l = liff.current;
    try {
      if (l?.isApiAvailable("shareTargetPicker")) {
        await l.shareTargetPicker([r.shareMessage as never]);
        return;
      }
    } catch {}
    const url = `https://line.me/R/share?text=${encodeURIComponent(text)}`;
    if (l?.isInClient()) l.openWindow({ url, external: false });
    else window.open(url, "_blank");
  }

  async function copy() {
    if (!m) return;
    try {
      await navigator.clipboard.writeText(m.referral.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setRefMsg({ ok: false, text: `คัดลอกไม่ได้ ลิงก์ของคุณคือ ${m.referral.url}` });
    }
  }

  async function applyCode() {
    setRefBusy(true);
    setRefMsg(null);
    try {
      const r = await fetch("/api/member/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ code: refCode, name }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "ใช้โค้ดไม่สำเร็จ");
      setRefMsg({ ok: true, text: `ใช้โค้ดของ ${j.referrerName} แล้ว สั่งครั้งแรกรับเพิ่ม ${m?.referral.friendPoints ?? 0} แต้ม` });
      setRefCode("");
      await load();
    } catch (e) {
      setRefMsg({ ok: false, text: e instanceof Error ? e.message : "ใช้โค้ดไม่สำเร็จ" });
    } finally {
      setRefBusy(false);
    }
  }

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
  if (!m) return <Loader label="กำลังเปิดบัตรสมาชิก…" />;

  const { tier, next } = tierOf(m.earned);
  const progress = next ? Math.min(100, Math.round(((m.earned - tier.from) / (next.from - tier.from)) * 100)) : 100;
  const waiting = m.coupons.filter((c) => c.status === "waiting");
  const shown = m.rewards.filter((r) => r.category === cat);

  return (
    <main className="app member">
      <div className="mb-fixed">
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
              <small>
                {m.since ? `สมาชิกตั้งแต่ ${dateTH(m.since, { day: "numeric", month: "short", year: "numeric" })}` : "สมาชิกใหม่"}
              </small>
            </div>
            <code>{m.memberNo}</code>
          </div>
        </section>
      </div>

      <div className="mb-scroll">
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
          <div
            className="mb-bar"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="ความคืบหน้าระดับสมาชิก"
          >
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
            ทุก ฿{POINTS.bahtPerPoint} ได้ 1 แต้ม · ใช้แทนเงินสดได้ 1 แต้ม = ฿1 (ครั้งละ {POINTS.minRedeem} แต้มขึ้นไป)
            หรือแลกของขวัญด้านล่าง
          </p>
        </section>

        <section className="mb-invite">
          <div className="mb-invite-head">
            <span className="mb-invite-ico">
              <Icon name="gift" size={22} />
            </span>
            <div>
              <b>ชวนเพื่อน รับ {m.referral.referrerPoints} แต้ม</b>
              <small>
                เพื่อนสั่งครั้งแรกผ่านลิงก์ของคุณ คุณได้ {m.referral.referrerPoints} แต้ม เพื่อนได้ {m.referral.friendPoints} แต้ม
              </small>
            </div>
          </div>
          <div className="mb-invite-code">
            <small>โค้ดชวนของคุณ</small>
            <code>{m.referral.code}</code>
          </div>
          <div className="mb-invite-btns">
            <button className="mb-share" onClick={share}>
              ส่งชวนเพื่อนใน LINE
            </button>
            <button className="mb-copy" onClick={copy}>
              {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
            </button>
          </div>
          {m.referral.friends.length > 0 && (
            <p className="mb-invite-stat">
              ชวนแล้ว {m.referral.friends.length} คน · สั่งแล้ว {m.referral.friends.filter((x) => x.rewarded).length} คน · ได้{" "}
              {pts(m.referral.earned)} แต้ม
            </p>
          )}
          {m.referral.referredBy?.status === "pending" && (
            <p className="mb-invite-note">
              คุณมาจากคำชวนของ {m.referral.referredBy.name} · สั่งครั้งแรกรับเพิ่ม {m.referral.friendPoints} แต้ม
            </p>
          )}
          {m.referral.canEnterCode && (
            <div className="mb-invite-enter">
              <input
                className="text"
                placeholder="มีโค้ดจากเพื่อน? ใส่ตรงนี้"
                value={refCode}
                maxLength={8}
                onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                aria-label="โค้ดชวนจากเพื่อน"
              />
              <button onClick={applyCode} disabled={refCode.trim().length < 4 || refBusy}>
                ใช้โค้ด
              </button>
            </div>
          )}
          {refMsg && <p className={`mb-invite-msg${refMsg.ok ? "" : " bad"}`}>{refMsg.text}</p>}
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

        {view === "rewards" && (
          <div className="rw-cats" role="group" aria-label="หมวดของขวัญ">
            {REWARD_CATEGORIES.map((c) => (
              <button key={c.id} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                <b>{c.label}</b>
                <small>{m.rewards.filter((r) => r.category === c.id).length} รายการ</small>
              </button>
            ))}
          </div>
        )}
        {view === "rewards" &&
          (shown.length === 0 ? (
            <p className="mb-empty">
              {cat === "merch" ? "ร้านกำลังเตรียมของพรีเมียม รอติดตามนะ" : "ยังไม่มีเมนูให้แลกตอนนี้ สะสมแต้มไว้ก่อนนะ"}
            </p>
          ) : (
            <div className="rw-grid">
              {shown.map((r) => {
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
      </div>

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
