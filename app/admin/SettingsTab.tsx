"use client";

import { useEffect, useState } from "react";
import { POINTS, SHOP } from "@/lib/config";
import { LOOKS, lookOf, type MenuItem, type ShopSettings, type Temp } from "@/lib/menu";
import Cup, { tintOf } from "../Cup";
import { Price } from "./MenuTab";

type Draft = {
  id: string | null; // null = เมนูใหม่
  name: string;
  jp: string;
  description: string;
  price: string;
  promoPrice: string;
  temps: Temp[];
  milk: boolean;
  recommended: boolean;
  look: string;
};

const EMPTY: Draft = {
  id: null,
  name: "",
  jp: "",
  description: "",
  price: "",
  promoPrice: "",
  temps: ["iced"],
  milk: true,
  recommended: false,
  look: "matcha-latte",
};

const toDraft = (m: MenuItem): Draft => ({
  id: m.id,
  name: m.name,
  jp: m.jp,
  description: m.description,
  price: String(m.price),
  promoPrice: m.promoPrice === null ? "" : String(m.promoPrice),
  temps: m.temps,
  milk: m.milk,
  recommended: m.recommended,
  look: m.look ?? "",
});

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export default function SettingsTab({ menu, reload }: { menu: MenuItem[]; reload: () => void }) {
  const [settings, setSettings] = useState<ShopSettings>({ banner: "", bannerActive: false });
  const [bannerMsg, setBannerMsg] = useState("");
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
    const r = await fetch("/api/admin/settings", json("PUT", settings));
    setBannerMsg(r.ok ? "บันทึกแล้ว ลูกค้าจะเห็นเมื่อเปิดหน้าสั่งครั้งถัดไป" : "บันทึกไม่สำเร็จ");
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
    const body = {
      name: draft.name,
      jp: draft.jp,
      description: draft.description,
      price: Number(draft.price),
      promoPrice: draft.promoPrice.trim() === "" ? null : Number(draft.promoPrice),
      temps: draft.temps,
      milk: draft.milk,
      recommended: draft.recommended,
      look: draft.look === "" ? null : draft.look,
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
  const previewLook = draft ? (draft.look || draft.id || "matcha-latte") : "";

  return (
    <div className="settings">
      <section className="panel">
        <header>
          <h2>📣 ป้ายประกาศโปรโมชั่น</h2>
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

      <section className="panel">
        <header>
          <h2>📱 QR สแกนสั่ง</h2>
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
            <h2>🍵 จัดการเมนู</h2>
            <p>ตั้งราคาโปรเพื่อทำโปรโมชั่นรายเมนู · กดดาวเพื่อติดป้าย &ldquo;แนะนำ&rdquo; และให้ขึ้นก่อนเมนูอื่น</p>
          </div>
          <button className="btn primary-sm" onClick={() => edit(EMPTY)}>
            + เพิ่มเมนูใหม่
          </button>
        </header>
        <ul className="mlist">
          {menu.map((m) => (
            <li key={m.id}>
              <span className="thumb" style={{ "--tint": tintOf(lookOf(m)) } as React.CSSProperties}>
                <Cup itemId={lookOf(m)} temp={m.temps[0]} milk={m.milk ? "fresh" : null} size={44} />
              </span>
              <div className="mlist-info">
                <b>{m.name}</b>
                <small>
                  {m.temps.map((t) => (t === "iced" ? "เย็น" : "ร้อน")).join("/")}
                  {m.milk ? " · เลือกนมได้" : ""}
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
                ★
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
          <h2>🏪 ข้อมูลร้าน</h2>
          <p>ค่าเหล่านี้อยู่ในโค้ด (lib/config.ts) ถ้าต้องการเปลี่ยนให้แจ้งผู้ดูแลระบบ</p>
        </header>
        <dl>
          <dt>เวลารับเครื่องดื่ม</dt>
          <dd>
            {SHOP.open}–{SHOP.close} น. ทุก {SHOP.slotMinutes} นาที
          </dd>
          <dt>แก้วสูงสุดต่อรอบ</dt>
          <dd>{SHOP.slotCapacity} แก้ว</dd>
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
                ✕
              </button>
            </header>
            <div className="drawer-art" style={{ "--tint": tintOf(previewLook) } as React.CSSProperties}>
              <Cup key={previewLook + draft.temps[0]} itemId={previewLook} temp={draft.temps[0] ?? "iced"} milk={draft.milk ? "fresh" : null} size={110} />
            </div>
            <div className="form">
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
                <input type="checkbox" checked={draft.recommended} onChange={(e) => set("recommended", e.target.checked)} />
                เมนูแนะนำ ★
              </label>
              <label>
                หน้าตาแก้วการ์ตูน
                <select className="text" value={draft.look} onChange={(e) => set("look", e.target.value)}>
                  {draft.id && <option value="">ตามเมนูเดิม</option>}
                  {LOOKS.map((l) => (
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
