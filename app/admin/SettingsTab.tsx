"use client";

import { useEffect, useState } from "react";
import { DAY_NAMES, DAY_ORDER, type ClosedDate, type DayHours } from "@/lib/schedule";
import { POINTS, SHOP } from "@/lib/config";
import { FOOD_LOOKS, LOOKS, activeNotice, type Kind, type MenuItem, type ShopSettings, type Temp } from "@/lib/menu";
import Icon, { type IconName } from "../Icon";
import { uploadImage } from "./upload";
import Notice from "../Notice";
import MenuArt, { artTint } from "../MenuArt";
import { Price } from "./MenuTab";
import MemberPanel from "./MemberPanel";
import MessageLog from "./MessageLog";
import PromoPanel from "./PromoPanel";
import WifiPanel from "./WifiPanel";
import DeliveryPanel from "./DeliveryPanel";

type Section = "shop" | "menu" | "promo" | "member" | "line";
const SECTIONS: { id: Section; icon: IconName; label: string; hint: string }[] = [
  { id: "shop", icon: "store", label: "ร้าน", hint: "เวลาเปิด–ปิด · QR · ข้อมูลร้าน" },
  { id: "menu", icon: "cup", label: "เมนู", hint: "เพิ่ม/แก้เมนู · ราคาโปร · แนะนำ" },
  { id: "promo", icon: "gift", label: "โปรโมชั่น", hint: "ป้ายประกาศ · โค้ดส่วนลด" },
  { id: "member", icon: "star", label: "สมาชิก & ของขวัญ", hint: "คูปองรอรับ · ของขวัญแลกแต้ม" },
  { id: "line", icon: "megaphone", label: "ส่งข้อความ LINE", hint: "การ์ดโปร · Gen รูป · ประวัติ" },
];

type DraftTopping ={ id?: string; label: string; price: string; group?: string };
type Draft = {
  id: string | null; // null = เมนูใหม่
  kind: Kind;
  name: string;
  jp: string;
  description: string;
  price: string;
  promoPrice: string;
  temps: Temp[];
  milk: boolean;
  grams: string; // กรัมผงมัทฉะ (ว่าง = ไม่ให้เลือกผง)
  addons: boolean; // มีท็อปปิ้งให้เลือก
  sweetChoice: boolean; // มีความหวานให้เลือก
  recommended: boolean;
  look: string;
  photoUrl: string | null; // รูปเครื่องดื่มจริง
  toppings: DraftTopping[];
};

const EMPTY: Draft = {
  id: null,
  kind: "drink",
  name: "",
  jp: "",
  description: "",
  price: "",
  promoPrice: "",
  temps: ["iced"],
  milk: true,
  grams: "",
  addons: true,
  sweetChoice: true,
  recommended: false,
  look: "matcha-latte",
  photoUrl: null,
  toppings: [],
};

const toDraft = (m: MenuItem): Draft => ({
  id: m.id,
  kind: m.kind ?? "drink",
  name: m.name,
  jp: m.jp,
  description: m.description,
  price: String(m.price),
  promoPrice: m.promoPrice === null ? "" : String(m.promoPrice),
  temps: m.temps,
  milk: m.milk,
  grams: m.grams ? String(m.grams) : "",
  addons: m.addons !== false,
  sweetChoice: m.sweetChoice !== false,
  recommended: m.recommended,
  look: m.look ?? "",
  photoUrl: m.photoUrl ?? null,
  toppings: (m.toppings ?? []).map((t) => ({ id: t.id, label: t.label, price: String(t.price), group: t.group ?? "" })),
});

// เมนูจำลองจากฟอร์ม ใช้วาดภาพตัวอย่าง
const draftItem = (d: Draft): MenuItem => ({
  id: d.id ?? "new",
  kind: d.kind,
  toppings: [],
  name: d.name,
  jp: d.jp,
  description: d.description,
  price: Number(d.price) || 0,
  temps: d.temps.length ? d.temps : ["iced"],
  milk: d.milk,
  grams: d.kind === "food" ? null : Number(d.grams) || null,
  addons: d.kind !== "food" && d.addons,
  sweetChoice: d.kind !== "food" && d.sweetChoice,
  hidden: false,
  available: true,
  promoPrice: null,
  recommended: d.recommended,
  look: d.look || null,
  sort: 0,
});

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

// เลือกเวลาแบบ 24 ชม. (ช่อง type="time" แสดง AM/PM ตามภาษาเครื่อง จึงไม่ใช้)
function TimeSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [h, m] = value.split(":");
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();
  return (
    <fieldset className="time24">
      <legend>{label}</legend>
      <select className="text" aria-label={`${label} ชั่วโมง`} value={h} onChange={(e) => onChange(`${e.target.value}:${m}`)}>
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <span aria-hidden="true">:</span>
      <select className="text" aria-label={`${label} นาที`} value={m} onChange={(e) => onChange(`${h}:${e.target.value}`)}>
        {minutes.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <span className="unit">น.</span>
    </fieldset>
  );
}

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export default function SettingsTab({ menu, reload }: { menu: MenuItem[]; reload: () => void }) {
  const [settings, setSettings] = useState<ShopSettings>({
    banner: "",
    bannerActive: false,
    notice: "",
    noticeActive: false,
    noticeUntil: null,
    openTime: "10:30",
    closeTime: "17:00",
    slotMinutes: 15,
    slotCapacity: 8,
    accepting: true,
    manualAccepting: true,
    weekly: Array.from({ length: 7 }, () => ({ closed: false, open: "10:30", close: "17:00" })),
    closedDates: [],
    closedReason: null,
    orderNoStart: 1,
    deliveryEnabled: false,
    deliveryKm: 5,
    deliveryMin: 150,
    shopLat: null,
    shopLng: null,
    preorderEnabled: false,
    preorderFrom: "06:00",
    preorderCutoff: "20:00",
  });
  const [bannerMsg, setBannerMsg] = useState("");
  const [noticeMsg, setNoticeMsg] = useState("");
  // ประกาศหายเองเมื่อไร: today = เที่ยงคืนวันนี้ · tomorrow = เที่ยงคืนพรุ่งนี้ · none = จนกว่าจะปิดเอง
  const [noticeEnd, setNoticeEnd] = useState<"today" | "tomorrow" | "none">("today");
  const [hoursMsg, setHoursMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setSettings(s));
  }, []);

  async function saveNotice(active: boolean) {
    setNoticeMsg("");
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
    const day = (n: number) => new Date(new Date(`${today}T23:59:59+07:00`).getTime() + n * 864e5).toISOString();
    const until = noticeEnd === "today" ? day(0) : noticeEnd === "tomorrow" ? day(1) : null;
    const r = await fetch("/api/admin/settings", json("PUT", { notice: settings.notice, noticeActive: active, noticeUntil: active ? until : null }));
    const j = await r.json().catch(() => null);
    if (r.ok && j) setSettings(j);
    setNoticeMsg(r.ok ? (active ? "ประกาศแล้ว ลูกค้าเห็นทันทีที่เปิดหน้าสั่ง" : "ปิดประกาศแล้ว") : "บันทึกไม่สำเร็จ");
  }

  async function saveBanner() {
    setBannerMsg("");
    const r = await fetch("/api/admin/settings", json("PUT", { banner: settings.banner, bannerActive: settings.bannerActive }));
    setBannerMsg(r.ok ? "บันทึกแล้ว ลูกค้าจะเห็นเมื่อเปิดหน้าสั่งครั้งถัดไป" : "บันทึกไม่สำเร็จ");
  }

  async function saveHours(patch: Partial<ShopSettings>) {
    setHoursMsg(null);
    const r = await fetch("/api/admin/settings", json("PUT", patch));
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setSettings(j);
      setHoursMsg({ ok: true, text: "บันทึกแล้ว มีผลกับหน้าสั่งทันที" });
    } else setHoursMsg({ ok: false, text: j.error ?? "บันทึกไม่สำเร็จ" });
  }

  async function quick(m: MenuItem, patch: Partial<MenuItem>) {
    await fetch(`/api/admin/menu/${m.id}`, json("PATCH", patch));
    reload();
  }

  function edit(d: Draft) {
    setDraft(d);
    setFormErr("");
    setConfirmDelete(false);
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setFormErr("");
    const food = draft.kind === "food";
    const body = {
      kind: draft.kind,
      name: draft.name,
      jp: draft.jp,
      description: draft.description,
      price: Number(draft.price),
      promoPrice: draft.promoPrice.trim() === "" ? null : Number(draft.promoPrice),
      temps: food ? ["hot"] : draft.temps,
      milk: food ? false : draft.milk,
      matchaGrams: food ? null : draft.grams === "" ? null : Number(draft.grams),
      addons: food ? false : draft.addons,
      sweetChoice: food ? true : draft.sweetChoice,
      recommended: draft.recommended,
      look: draft.look === "" ? null : draft.look,
      photoUrl: food ? null : draft.photoUrl,
      toppings: food ? draft.toppings.map((t) => ({ id: t.id, label: t.label, price: Number(t.price || 0), group: t.group ?? "" })) : [],
    };
    if (body.promoPrice !== null && body.promoPrice >= body.price) {
      setSaving(false);
      setFormErr("ราคาโปรต้องน้อยกว่าราคาปกติ");
      return;
    }
    const r = await fetch(draft.id ? `/api/admin/menu/${draft.id}` : "/api/admin/menu", json(draft.id ? "PATCH" : "POST", body));
    setSaving(false);
    if (!r.ok) {
      setFormErr((await r.json().catch(() => ({}))).error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setDraft(null);
    reload();
  }

  async function remove() {
    if (!draft?.id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await fetch(`/api/admin/menu/${draft.id}`, { method: "DELETE" });
    setDraft(null);
    reload();
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => draft && setDraft({ ...draft, [k]: v });
  const toggleTemp = (t: Temp) =>
    draft && set("temps", draft.temps.includes(t) ? draft.temps.filter((x) => x !== t) : [...draft.temps, t]);
  const setTopping = (i: number, patch: Partial<DraftTopping>) =>
    draft && set("toppings", draft.toppings.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  function setKind(kind: Kind) {
    if (!draft || draft.kind === kind) return;
    setDraft({ ...draft, kind, look: kind === "food" ? "omelette-rice" : "matcha-latte" });
  }
  const preview = draft ? draftItem(draft) : null;

  // หมวดย่อยของหน้าตั้งค่า (จำหมวดล่าสุดไว้ในเครื่องนี้)
  const [sec, setSec] = useState<Section>("shop");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("adm-settings-sec") as Section | null;
      if (saved && SECTIONS.some((s) => s.id === saved)) setSec(saved);
    } catch {}
  }, []);
  function pick(s: Section) {
    setSec(s);
    try {
      localStorage.setItem("adm-settings-sec", s);
    } catch {}
  }

  return (
    <div className="settings">
      <nav className="sec-nav" aria-label="หมวดตั้งค่า">
        {SECTIONS.map((s) => (
          <button key={s.id} aria-current={sec === s.id ? "page" : undefined} onClick={() => pick(s.id)}>
            <span className="sec-ico">
              <Icon name={s.icon} size={24} />
            </span>
            <b>{s.label}</b>
            <small>{s.hint}</small>
          </button>
        ))}
      </nav>

      {sec === "shop" && (
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>
              <Icon name="clock" size={20} /> เวลาเปิด–ปิดร้าน
            </h2>
            <p>ตั้งเวลาเปิด–ปิดแต่ละวัน และวันหยุดครั้งเดียว ระบบเปิด–ปิดรับออเดอร์เองตามตาราง ไม่ต้องมากดทุกวัน · สวิตช์ใช้ปิดรับทันทีเมื่อมีเหตุด่วน</p>
          </div>
          <button
            className="toggle"
            role="switch"
            aria-checked={settings.manualAccepting}
            onClick={() => saveHours({ accepting: !settings.manualAccepting })}
          >
            <span className="knob" aria-hidden="true" />
            {settings.manualAccepting ? "เปิดรับออเดอร์" : "ปิดรับออเดอร์"}
          </button>
        </header>
        <p className={`wk-today${settings.closedReason ? " off" : ""}`}>
          วันนี้: {!settings.manualAccepting ? "ปิดรับออเดอร์ชั่วคราว (สวิตช์ด้านบนปิดอยู่)" : settings.closedReason ? settings.closedReason : `เปิดตามตาราง ${settings.openTime}–${settings.closeTime} น.`}
        </p>
        <WeeklyHours
          weekly={settings.weekly}
          closedDates={settings.closedDates}
          onChange={(weekly, closedDates) => setSettings({ ...settings, weekly, closedDates })}
        />
        <div className="hours">
          <label>
            ระยะห่างแต่ละรอบ
            <select className="text" value={settings.slotMinutes} onChange={(e) => setSettings({ ...settings, slotMinutes: Number(e.target.value) })}>
              {[10, 15, 20, 30, 60].map((m) => (
                <option key={m} value={m}>
                  ทุก {m} นาที
                </option>
              ))}
            </select>
          </label>
          <label>
            แก้วสูงสุดต่อรอบ
            <input
              className="text"
              inputMode="numeric"
              value={settings.slotCapacity}
              onChange={(e) => setSettings({ ...settings, slotCapacity: Number(e.target.value.replace(/\D/g, "")) || 0 })}
            />
          </label>
          <label>
            เลขออเดอร์แรกของแต่ละวัน
            <input
              className="text"
              inputMode="numeric"
              value={settings.orderNoStart}
              onChange={(e) => setSettings({ ...settings, orderNoStart: Number(e.target.value.replace(/\D/g, "")) || 0 })}
            />
          </label>
        </div>
        <div className="panel-row">
          <button
            className="btn primary-sm"
            onClick={() =>
              saveHours({
                weekly: settings.weekly,
                closedDates: settings.closedDates,
                slotMinutes: settings.slotMinutes,
                slotCapacity: settings.slotCapacity,
                orderNoStart: settings.orderNoStart,
              })
            }
          >
            บันทึกเวลาร้าน
          </button>
          {hoursMsg && <span className={hoursMsg.ok ? "hint-ok" : "err"}>{hoursMsg.text}</span>}
        </div>
      </section>
      )}

      {sec === "shop" && <WifiPanel />}
      {sec === "shop" && <DeliveryPanel />}

      {sec === "promo" && (
      <section className="panel">
        <header>
          <h2>
            <Icon name="megaphone" size={20} /> ประกาศสำคัญ
          </h2>
          <p>กล่องสีส้มแดงเด่นใต้หัวหน้าเว็บ ทั้งหน้าสั่งมัทฉะและมาม่าบาร์ · ใช้แจ้งร้านหยุด ปิดเร็ว หรือเรื่องด่วน</p>
        </header>
        <div className="sn-admin-prev">
          <Notice text={settings.notice || "ตัวอย่างข้อความประกาศ"} />
        </div>
        <div className="sn-tpl" aria-label="ข้อความสำเร็จรูป">
          {[
            "วันนี้ร้านหยุด 1 วัน เนื่องจากมีการทาสีอาคาร มีกลิ่นสีแรง ขออภัยในความไม่สะดวก แล้วพบกันใหม่พรุ่งนี้นะ",
            "วันนี้ร้านปิดเร็ว ขออภัยในความไม่สะดวก",
            "วันนี้ร้านเปิดช้ากว่าปกติ",
          ].map((t) => (
            <button key={t} type="button" onClick={() => setSettings({ ...settings, notice: t })}>
              {t.length > 26 ? t.slice(0, 26) + "…" : t}
            </button>
          ))}
        </div>
        <textarea rows={3} maxLength={300} placeholder="พิมพ์ประกาศ (ไม่เกิน 300 ตัวอักษร)" value={settings.notice} onChange={(e) => setSettings({ ...settings, notice: e.target.value })} />
        <div className="sn-until seg" role="group" aria-label="ประกาศหายเองเมื่อไร">
          <button aria-pressed={noticeEnd === "today"} onClick={() => setNoticeEnd("today")}>
            ถึงเที่ยงคืนวันนี้
          </button>
          <button aria-pressed={noticeEnd === "tomorrow"} onClick={() => setNoticeEnd("tomorrow")}>
            ถึงเที่ยงคืนพรุ่งนี้
          </button>
          <button aria-pressed={noticeEnd === "none"} onClick={() => setNoticeEnd("none")}>
            จนกว่าจะปิดเอง
          </button>
        </div>
        <div className="panel-row">
          {activeNotice(settings) ? (
            <>
              <span className="hint-ok">
                แสดงอยู่{settings.noticeUntil ? ` · หายเอง ${new Date(settings.noticeUntil).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} น.` : " · จนกว่าจะปิดเอง"}
              </span>
              <button className="btn ghost-sm" onClick={() => saveNotice(false)}>
                ปิดประกาศ
              </button>
            </>
          ) : null}
          <button className="btn primary-sm" disabled={!settings.notice.trim()} onClick={() => saveNotice(true)}>
            {activeNotice(settings) ? "อัปเดตประกาศ" : "ประกาศเลย"}
          </button>
        </div>
        <p className="report-empty">ประกาศอย่างเดียวไม่ปิดรับออเดอร์ · วันหยุดประจำและวันหยุดพิเศษตั้งที่ ตั้งค่า › ร้าน › เวลาเปิด–ปิดร้าน ระบบปิดรับให้เอง</p>
        {noticeMsg && <p className="hint-ok">{noticeMsg}</p>}
      </section>
      )}
      {sec === "promo" && (
      <section className="panel">
        <header>
          <h2>
            <Icon name="megaphone" size={20} /> ป้ายประกาศโปรโมชั่น
          </h2>
          <p>แสดงเป็นแถบบนหน้าสั่งของลูกค้า เช่น &ldquo;วันนี้ Cold Whisk ลด 20 บาท!&rdquo;</p>
        </header>
        <div className="banner-preview" data-on={settings.bannerActive}>
          {settings.banner || "ตัวอย่างข้อความโปรโมชั่น"}
        </div>
        <textarea
          rows={2}
          maxLength={120}
          placeholder="พิมพ์ข้อความโปร (ไม่เกิน 120 ตัวอักษร)"
          value={settings.banner}
          onChange={(e) => setSettings({ ...settings, banner: e.target.value })}
        />
        <div className="panel-row">
          <button
            className="toggle"
            role="switch"
            aria-checked={settings.bannerActive}
            onClick={() => setSettings({ ...settings, bannerActive: !settings.bannerActive })}
          >
            <span className="knob" aria-hidden="true" />
            {settings.bannerActive ? "แสดงอยู่" : "ปิดอยู่"}
          </button>
          <button className="btn primary-sm" onClick={saveBanner}>
            บันทึกป้ายประกาศ
          </button>
        </div>
        {bannerMsg && <p className="hint-ok">{bannerMsg}</p>}
      </section>
      )}

      {sec === "promo" && <PromoPanel menu={menu} part="codes" />}
      {sec === "member" && <MemberPanel menu={menu} />}

      {sec === "line" && (
        <>
          <PromoPanel menu={menu} part="broadcast" />
          <MessageLog />
        </>
      )}

      {sec === "shop" && (
      <section className="panel">
        <header>
          <h2>
            <Icon name="qr" size={20} /> QR สแกนสั่ง
          </h2>
          <p>ลูกค้าสแกนด้วยกล้องมือถือ จะเปิดหน้าสั่งใน LINE ทันที วางไว้ที่เคาน์เตอร์หรือหน้าร้าน</p>
        </header>
        <div className="qr-panel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/qr" alt="QR สำหรับสั่งเครื่องดื่ม" />
          <div>
            <code>{`https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID ?? ""}`}</code>
            <a className="btn primary-sm" href="/poster" target="_blank" rel="noreferrer">
              เปิดโปสเตอร์ A5 เพื่อพิมพ์
            </a>
          </div>
        </div>
      </section>
      )}

      {sec === "menu" && (
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>
              <Icon name="cup" size={20} /> จัดการเมนู
            </h2>
            <p>ตั้งราคาโปรเพื่อทำโปรโมชั่นรายเมนู · กดดาวเพื่อติดป้าย &ldquo;แนะนำ&rdquo; และให้ขึ้นก่อนเมนูอื่น</p>
          </div>
          <button className="btn primary-sm" onClick={() => edit(EMPTY)}>
            + เพิ่มเมนูใหม่
          </button>
        </header>
        <ul className="mlist">
          {menu.map((m) => (
            <li key={m.id}>
              <span className="thumb" style={{ "--tint": artTint(m) } as React.CSSProperties}>
                <MenuArt item={m} size={44} />
              </span>
              <div className="mlist-info">
                <b>{m.name}</b>
                <small>
                  {m.kind === "food"
                    ? `อาหาร${m.toppings?.length ? ` · ท็อปปิ้ง ${m.toppings.length} อย่าง` : ""}`
                    : `${m.temps.map((t) => (t === "iced" ? "เย็น" : "ร้อน")).join("/")}${m.milk ? " · เลือกนมได้" : ""}`}
                  {!m.available ? " · หมดวันนี้" : ""}
                </small>
              </div>
              <Price item={m} />
              <button
                className={`star${m.recommended ? " on" : ""}`}
                aria-label={m.recommended ? "เลิกแนะนำ" : "ตั้งเป็นเมนูแนะนำ"}
                aria-pressed={m.recommended}
                onClick={() => quick(m, { recommended: !m.recommended })}
              >
                <Icon name="star" size={20} filled={m.recommended} />
              </button>
              <button className="btn ghost-sm" onClick={() => edit(toDraft(m))}>
                แก้ไข
              </button>
            </li>
          ))}
        </ul>
      </section>
      )}

      {sec === "shop" && (
      <section className="panel info">
        <header>
          <h2>
            <Icon name="store" size={20} /> ข้อมูลร้าน
          </h2>
          <p>ค่าเหล่านี้อยู่ในโค้ด (lib/config.ts) ถ้าต้องการเปลี่ยนให้แจ้งผู้ดูแลระบบ</p>
        </header>
        <dl>
          <dt>ต้องสั่งล่วงหน้าอย่างน้อย</dt>
          <dd>{SHOP.leadMinutes} นาที</dd>
          <dt>จองคิวระหว่างรอจ่าย</dt>
          <dd>{SHOP.holdMinutes} นาที</dd>
          <dt>สะสมแต้ม</dt>
          <dd>
            ทุก ฿{POINTS.bahtPerPoint} = 1 แต้ม · ใช้ได้ทุกแต้ม ไม่มีขั้นต่ำ (1 แต้ม = ฿1)
          </dd>
        </dl>
      </section>
      )}

      {draft && (
        <>
          <div className="backdrop" onClick={() => setDraft(null)} />
          <div className="drawer" role="dialog" aria-label={draft.id ? "แก้ไขเมนู" : "เพิ่มเมนูใหม่"}>
            <header>
              <h2>{draft.id ? "แก้ไขเมนู" : "เพิ่มเมนูใหม่"}</h2>
              <button className="x" aria-label="ปิด" onClick={() => setDraft(null)}>
                <Icon name="close" size={18} />
              </button>
            </header>
            <div className="drawer-art" style={{ "--tint": artTint(preview!) } as React.CSSProperties}>
              <MenuArt key={`${preview!.look}-${preview!.temps[0]}`} item={preview!} size={110} />
            </div>
            <div className="form">
              <fieldset>
                <legend>ประเภทเมนู</legend>
                <div className="chips">
                  {(["drink", "food"] as Kind[]).map((k) => (
                    <button key={k} type="button" className="chip" aria-pressed={draft.kind === k} onClick={() => setKind(k)} disabled={!!draft.id && draft.kind !== k}>
                      {k === "drink" ? "เครื่องดื่ม" : "อาหาร"}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label>
                ชื่อเมนู *
                <input className="text" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น มัทฉะลาเต้ส้มยูซุ" />
              </label>
              <label>
                ชื่อญี่ปุ่น (ตัวเล็กเหนือชื่อ)
                <input className="text" value={draft.jp} onChange={(e) => set("jp", e.target.value)} placeholder="เช่น 抹茶ラテ" />
              </label>
              <label>
                คำอธิบาย
                <textarea rows={2} value={draft.description} onChange={(e) => set("description", e.target.value)} />
              </label>
              <div className="two">
                <label>
                  ราคาปกติ (บาท) *
                  <input className="text" inputMode="numeric" value={draft.price} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} />
                </label>
                <label>
                  ราคาโปร (เว้นว่าง = ไม่มีโปร)
                  <input className="text" inputMode="numeric" value={draft.promoPrice} onChange={(e) => set("promoPrice", e.target.value.replace(/\D/g, ""))} />
                </label>
              </div>
              {draft.kind === "drink" ? (
                <>
                  <fieldset>
                    <legend>ขายแบบ</legend>
                    <div className="chips">
                      {(["iced", "hot"] as Temp[]).map((t) => (
                        <button key={t} type="button" className="chip" aria-pressed={draft.temps.includes(t)} onClick={() => toggleTemp(t)}>
                          {t === "iced" ? "เย็น" : "ร้อน"}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="check">
                    <input type="checkbox" checked={draft.milk} onChange={(e) => set("milk", e.target.checked)} />
                    ลูกค้าเลือกชนิดนมได้ (นมสด / โอ๊ต / อัลมอนด์)
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={draft.addons} onChange={(e) => set("addons", e.target.checked)} />
                    มีท็อปปิ้งให้เลือก (เพิ่มช็อตมัทฉะ / ซอฟต์ครีม)
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={draft.sweetChoice} onChange={(e) => set("sweetChoice", e.target.checked)} />
                    ลูกค้าเลือกความหวานได้ (ปิด = ทำแบบไม่หวานเสมอ เช่น เพียวมัทฉะ)
                  </label>
                  <label className="grams-field">
                    ผงมัทฉะที่ใช้ต่อแก้ว (กรัม)
                    <input
                      className="text"
                      inputMode="decimal"
                      placeholder="เว้นว่าง = ไม่ให้ลูกค้าเลือกผง"
                      value={draft.grams}
                      onChange={(e) => set("grams", e.target.value.replace(/[^\d.]/g, ""))}
                    />
                    <small>ใส่แล้วลูกค้าเลือกผงมัทฉะได้ ราคาบวกตามกรัม (ตั้งผงได้ที่ ต้นทุน & กำไร › ผงมัทฉะ)</small>
                  </label>
                </>
              ) : (
                <fieldset className="tops-edit">
                  <legend>ตัวเลือกและท็อปปิ้ง</legend>
                  <p className="tops-help">
                    ใส่ <b>ชื่อกลุ่ม</b> เดียวกัน = ลูกค้าเลือกได้ 1 อย่าง (อันแรกเป็นค่าเริ่มต้น) เช่น &ldquo;จำนวนไข่&rdquo; · เว้นว่าง = ท็อปปิ้งเลือกได้หลายอย่าง ·
                    ราคา 0 = ฟรี
                  </p>
                  <div className="top-row head" aria-hidden="true">
                    <span>กลุ่ม</span>
                    <span>ชื่อตัวเลือก</span>
                    <span>+บาท</span>
                    <span />
                  </div>
                  {draft.toppings.map((t, i) => (
                    <div key={t.id ?? i} className="top-row">
                      <input
                        className="text"
                        placeholder="(ท็อปปิ้ง)"
                        aria-label={`กลุ่มของ ${t.label}`}
                        value={t.group ?? ""}
                        onChange={(e) => setTopping(i, { group: e.target.value })}
                      />
                      <input className="text" placeholder="ชื่อ" value={t.label} onChange={(e) => setTopping(i, { label: e.target.value })} />
                      <input
                        className="text price-in"
                        inputMode="numeric"
                        placeholder="+บาท"
                        aria-label={`ราคา ${t.label}`}
                        value={t.price}
                        onChange={(e) => setTopping(i, { price: e.target.value.replace(/\D/g, "") })}
                      />
                      <button type="button" className="x" aria-label={`ลบ ${t.label}`} onClick={() => set("toppings", draft.toppings.filter((_, j) => j !== i))}>
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn ghost-sm" onClick={() => set("toppings", [...draft.toppings, { label: "", price: "" }])}>
                    + เพิ่มตัวเลือก
                  </button>
                </fieldset>
              )}
              <label className="check">
                <input type="checkbox" checked={draft.recommended} onChange={(e) => set("recommended", e.target.checked)} />
                เมนูแนะนำ
              </label>
              {draft.kind === "drink" && (
                <div className="mp-field">
                  <span className="mp-label">รูปเครื่องดื่มจริง (ไม่บังคับ)</span>
                  <div className="mp-row">
                    <span className="mp-thumb">
                      {draft.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={draft.photoUrl} alt="รูปเครื่องดื่มจริง" />
                      ) : (
                        <MenuArt item={draftItem(draft)} size={44} />
                      )}
                    </span>
                    <div className="mp-acts">
                      <label className="btn ghost-sm">
                        {photoBusy ? "กำลังอัปโหลด…" : draft.photoUrl ? "เปลี่ยนรูป" : "ใส่รูปจริง"}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          disabled={photoBusy}
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (!f) return;
                            setPhotoBusy(true);
                            setPhotoErr("");
                            try {
                              set("photoUrl", await uploadImage(f, 900));
                            } catch (err) {
                              setPhotoErr(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
                            } finally {
                              setPhotoBusy(false);
                            }
                          }}
                        />
                      </label>
                      {draft.photoUrl && (
                        <button type="button" className="btn ghost-sm" onClick={() => set("photoUrl", null)}>
                          ลบรูป
                        </button>
                      )}
                    </div>
                  </div>
                  <small className="mp-hint">{photoErr || "มีรูป = ลูกค้ากดปุ่มพลิกบนการ์ดเพื่อดูรูปจริงได้ · ไม่มีรูป = แสดงการ์ตูนอย่างเดียว"}</small>
                </div>
              )}
              <label>
                ภาพการ์ตูน
                <select className="text" value={draft.look} onChange={(e) => set("look", e.target.value)}>
                  {draft.id && <option value="">ตามเมนูเดิม</option>}
                  {(draft.kind === "food" ? FOOD_LOOKS : LOOKS).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {formErr && (
              <p className="err" role="alert">
                {formErr}
              </p>
            )}
            <footer>
              {draft.id && (
                <button className={`btn ${confirmDelete ? "danger-sm" : "ghost-sm"}`} onClick={remove}>
                  {confirmDelete ? "ยืนยันลบเมนูนี้" : "ลบเมนู"}
                </button>
              )}
              <button className="btn primary-sm grow" disabled={saving || !draft.name || !draft.price || !draft.temps.length} onClick={saveDraft}>
                {saving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </footer>
          </div>
        </>
      )}
    </div>
  );
}

// ตารางเวลาเปิด–ปิดรายสัปดาห์ + วันหยุดพิเศษ (แก้ในหน้าจอก่อน แล้วกด "บันทึกเวลาร้าน")
function WeeklyHours({ weekly, closedDates, onChange }: { weekly: DayHours[]; closedDates: ClosedDate[]; onChange: (w: DayHours[], c: ClosedDate[]) => void }) {
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const set = (d: number, p: Partial<DayHours>) => onChange(weekly.map((x, i) => (i === d ? { ...x, ...p } : x)), closedDates);
  const firstOpen = DAY_ORDER.find((d) => !weekly[d].closed);
  const upcoming = closedDates.filter((c) => c.date >= today);
  return (
    <div className="wk">
      <ul className="wk-list">
        {DAY_ORDER.map((d) => {
          const w = weekly[d];
          return (
            <li key={d} className={w.closed ? "off" : ""}>
              <b>{DAY_NAMES[d]}</b>
              <button type="button" className="toggle" role="switch" aria-checked={!w.closed} aria-label={`${DAY_NAMES[d]} เปิดร้าน`} onClick={() => set(d, { closed: !w.closed })}>
                <span className="knob" aria-hidden="true" />
                {w.closed ? "หยุด" : "เปิด"}
              </button>
              {w.closed ? (
                <span className="wk-off">ไม่รับออเดอร์ทั้งวัน</span>
              ) : (
                <span className="wk-times">
                  <TimeSelect label="เปิด" value={w.open} onChange={(v) => set(d, { open: v })} />
                  <TimeSelect label="ปิดรับ" value={w.close} onChange={(v) => set(d, { close: v })} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {firstOpen !== undefined && (
        <button type="button" className="btn ghost-sm" onClick={() => onChange(weekly.map((x) => (x.closed ? x : { ...x, open: weekly[firstOpen].open, close: weekly[firstOpen].close })), closedDates)}>
          ใช้เวลาเดียวกับ{DAY_NAMES[firstOpen]}ทุกวันที่เปิด
        </button>
      )}
      <div className="wk-special">
        <h3>วันหยุดพิเศษ</h3>
        <p className="mk-hint2">เช่น วันหยุดยาว ปีใหม่ ลาพักร้อน ถึงวันนั้นระบบปิดรับออเดอร์ให้เอง</p>
        {upcoming.length === 0 && <p className="report-empty">ยังไม่มีวันหยุดพิเศษที่จะถึง</p>}
        {upcoming.map((c) => (
          <div key={c.date} className="wk-sp-row">
            <span>
              <b>{new Date(c.date + "T12:00:00+07:00").toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short", year: "2-digit" })}</b>
              {c.note ? ` · ${c.note}` : ""}
            </span>
            <button type="button" className="btn ghost-sm" onClick={() => onChange(weekly, closedDates.filter((x) => x.date !== c.date))}>
              เอาออก
            </button>
          </div>
        ))}
        <div className="wk-sp-add">
          <input className="text" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label="วันที่หยุด" />
          <input className="text" value={note} maxLength={60} placeholder="เหตุผล (ไม่บังคับ) เช่น วันหยุดปีใหม่" aria-label="เหตุผลที่หยุด" onChange={(e) => setNote(e.target.value)} />
          <button
            type="button"
            className="btn ghost-sm"
            disabled={!date || closedDates.some((c) => c.date === date)}
            onClick={() => {
              onChange(weekly, [...closedDates, { date, note: note.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
              setDate("");
              setNote("");
            }}
          >
            เพิ่มวันหยุด
          </button>
        </div>
      </div>
    </div>
  );
}
