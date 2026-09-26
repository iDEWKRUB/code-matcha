"use client";

import { useEffect, useState } from "react";
import { POINTS, SHOP } from "@/lib/config";
import { FOOD_LOOKS, LOOKS, type Kind, type MenuItem, type ShopSettings, type Temp } from "@/lib/menu";
import Icon from "../Icon";
import MenuArt, { artTint } from "../MenuArt";
import { Price } from "./MenuTab";
import MessageLog from "./MessageLog";
import PromoPanel from "./PromoPanel";

type DraftTopping = { id?: string; label: string; price: string; group?: string };
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
  recommended: boolean;
  look: string;
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
  recommended: false,
  look: "matcha-latte",
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
  recommended: m.recommended,
  look: m.look ?? "",
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
    openTime: "10:30",
    closeTime: "17:00",
    slotMinutes: 15,
    slotCapacity: 8,
    accepting: true,
  });
  const [bannerMsg, setBannerMsg] = useState("");
  const [hoursMsg, setHoursMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setSettings(s));
  }, []);

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
      recommended: draft.recommended,
      look: draft.look === "" ? null : draft.look,
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

  return (
    <div className="settings">
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>
              <Icon name="clock" size={20} /> เวลาเปิด–ปิดร้าน
            </h2>
            <p>ลูกค้าเลือกเวลารับได้เฉพาะรอบในช่วงนี้ · ปิดรับชั่วคราวได้ทันทีด้วยสวิตช์</p>
          </div>
          <button
            className="toggle"
            role="switch"
            aria-checked={settings.accepting}
            onClick={() => saveHours({ accepting: !settings.accepting })}
          >
            <span className="knob" aria-hidden="true" />
            {settings.accepting ? "เปิดรับออเดอร์" : "ปิดรับออเดอร์"}
          </button>
        </header>
        <div className="hours">
          <TimeSelect label="รอบรับแรก" value={settings.openTime} onChange={(v) => setSettings({ ...settings, openTime: v })} />
          <TimeSelect label="ปิดรับ (รอบสุดท้ายก่อนเวลานี้)" value={settings.closeTime} onChange={(v) => setSettings({ ...settings, closeTime: v })} />
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
        </div>
        <div className="panel-row">
          <button
            className="btn primary-sm"
            onClick={() =>
              saveHours({
                openTime: settings.openTime,
                closeTime: settings.closeTime,
                slotMinutes: settings.slotMinutes,
                slotCapacity: settings.slotCapacity,
              })
            }
          >
            บันทึกเวลาร้าน
          </button>
          {hoursMsg && <span className={hoursMsg.ok ? "hint-ok" : "err"}>{hoursMsg.text}</span>}
        </div>
      </section>

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

      <PromoPanel menu={menu} />
      <MessageLog />

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
            ทุก ฿{POINTS.bahtPerPoint} = 1 แต้ม · ใช้ขั้นต่ำ {POINTS.minRedeem} แต้ม (1 แต้ม = ฿1)
          </dd>
        </dl>
      </section>

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
