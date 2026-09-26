"use client";

import { useEffect, useState } from "react";
import { SHOP } from "@/lib/config";
import { normalizeCode, promoLabel, type PromoRule } from "@/lib/promo";
import Icon from "../Icon";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type Form = {
  code: string;
  kind: "percent" | "amount";
  value: string;
  maxDiscount: string;
  minSpend: string;
  newCustomersOnly: boolean;
  perUserLimit: string;
  maxUses: string;
  expiresOn: string;
  note: string;
};
const EMPTY: Form = {
  code: "",
  kind: "percent",
  value: "10",
  maxDiscount: "",
  minSpend: "",
  newCustomersOnly: true,
  perUserLimit: "1",
  maxUses: "",
  expiresOn: "",
  note: "",
};
const num = (s: string) => (s.trim() === "" ? null : Number(s));
const digits = (s: string) => s.replace(/\D/g, "");

export default function PromoPanel() {
  const [promos, setPromos] = useState<PromoRule[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // ส่งการ์ดโปร
  const [card, setCard] = useState({
    title: "เมนูใหม่! ข้าวไข่เจียว",
    subtitle: "เริ่มต้นเพียง ฿29",
    detail: "ลูกค้าใหม่ใส่โค้ดตอนสั่ง ลดเพิ่มอีก 10%",
    code: "CMNEW10",
    image: `${SHOP.siteUrl}/promo/omelette-29.png`,
  });
  const [uploading, setUploading] = useState(false);

  // ย่อรูปให้กว้าง 1040px เป็น JPG (LINE รับไม่เกิน 1MB) แล้วอัปโหลด
  async function uploadImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setSendMsg(null);
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1040 / bmp.width);
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.85));
      const fd = new FormData();
      fd.append("image", blob, "promo.jpg");
      const r = await fetch("/api/admin/promo-image", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "อัปโหลดไม่สำเร็จ");
      setCard((x) => ({ ...x, image: j.url }));
      setSendState("idle");
    } catch (e) {
      setSendMsg({ ok: false, text: e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ" });
    } finally {
      setUploading(false);
    }
  }
  const [quota, setQuota] = useState<{ limit: number | null; used: number } | null>(null);
  const [sendState, setSendState] = useState<"idle" | "checked" | "confirm" | "sending">("idle");
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/promos", { cache: "no-store" }).then((r) => (r.ok ? r.json().then(setPromos) : undefined));
    loadQuota();
  }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => form && setForm({ ...form, [k]: v });

  async function save() {
    if (!form) return;
    setErr("");
    const r = await fetch(
      "/api/admin/promos",
      json("POST", {
        code: form.code,
        kind: form.kind,
        value: num(form.value),
        maxDiscount: num(form.maxDiscount),
        minSpend: num(form.minSpend) ?? 0,
        newCustomersOnly: form.newCustomersOnly,
        perUserLimit: num(form.perUserLimit) ?? 1,
        maxUses: num(form.maxUses),
        expiresOn: form.expiresOn || null,
        note: form.note,
      }),
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? "บันทึกไม่สำเร็จ");
    setPromos(j);
    setForm(null);
  }

  async function toggle(p: PromoRule) {
    const r = await fetch(`/api/admin/promos/${encodeURIComponent(p.code)}`, json("PATCH", { active: !p.active }));
    if (r.ok) setPromos(await r.json());
  }

  async function remove(code: string) {
    if (confirmDel !== code) return setConfirmDel(code);
    const r = await fetch(`/api/admin/promos/${encodeURIComponent(code)}`, { method: "DELETE" });
    if (r.ok) setPromos(await r.json());
    setConfirmDel(null);
  }

  async function send(really: boolean) {
    setSendMsg(null);
    if (really && sendState !== "confirm") return setSendState("confirm");
    setSendState("sending");
    const r = await fetch("/api/admin/broadcast", json("POST", { ...card, send: really }));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setSendState("idle");
      return setSendMsg({ ok: false, text: j.error ?? "ไม่สำเร็จ" });
    }
    setSendState(really ? "idle" : "checked");
    setSendMsg({ ok: true, text: really ? "ส่งการ์ดโปรถึงเพื่อนทุกคนแล้ว" : "LINE ตรวจแล้ว การ์ดถูกต้อง พร้อมส่ง" });
    if (really) loadQuota();
  }

  function loadQuota() {
    fetch("/api/admin/broadcast", { cache: "no-store" }).then((r) => (r.ok ? r.json().then(setQuota) : undefined));
  }

  const chosen = promos.find((p) => p.code === card.code);

  return (
    <>
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>
              <Icon name="gift" size={20} /> โค้ดส่วนลด
            </h2>
            <p>ลูกค้าพิมพ์โค้ดในตะกร้าตอนสั่ง ระบบตรวจสิทธิ์และคิดส่วนลดให้อัตโนมัติ</p>
          </div>
          <button className="btn primary-sm" onClick={() => setForm(EMPTY)}>
            + สร้างโค้ด
          </button>
        </header>
        {promos.length === 0 && <p className="empty">ยังไม่มีโค้ด</p>}
        <ul className="mlist">
          {promos.map((p) => (
            <li key={p.code}>
              <span className={`code-chip${p.active ? "" : " off"}`}>{p.code}</span>
              <div className="mlist-info">
                <b>{promoLabel(p)}</b>
                <small>
                  ใช้แล้ว {p.used ?? 0}
                  {p.maxUses ? `/${p.maxUses}` : ""} ครั้ง · {p.perUserLimit} ครั้ง/คน
                  {p.expiresOn ? ` · ถึง ${p.expiresOn}` : " · ไม่หมดอายุ"}
                  {p.note ? ` · ${p.note}` : ""}
                </small>
              </div>
              <button className="toggle" role="switch" aria-checked={p.active} onClick={() => toggle(p)}>
                <span className="knob" aria-hidden="true" />
                {p.active ? "ใช้ได้" : "ปิด"}
              </button>
              <button className={`btn ${confirmDel === p.code ? "danger-sm" : "ghost-sm"}`} onClick={() => remove(p.code)}>
                {confirmDel === p.code ? "ยืนยันลบ" : "ลบ"}
              </button>
            </li>
          ))}
        </ul>

        {form && (
          <div className="promo-form">
            <div className="hours">
              <label>
                โค้ด
                <input className="text" value={form.code} placeholder="เช่น MATCHA20" onChange={(e) => set("code", normalizeCode(e.target.value))} />
              </label>
              <label>
                ประเภท
                <select className="text" value={form.kind} onChange={(e) => set("kind", e.target.value as Form["kind"])}>
                  <option value="percent">ลดเป็น %</option>
                  <option value="amount">ลดเป็นบาท</option>
                </select>
              </label>
              <label>
                {form.kind === "percent" ? "ลดกี่ %" : "ลดกี่บาท"}
                <input className="text" inputMode="numeric" value={form.value} onChange={(e) => set("value", digits(e.target.value))} />
              </label>
              {form.kind === "percent" && (
                <label>
                  ลดสูงสุด (บาท, เว้นว่าง = ไม่จำกัด)
                  <input className="text" inputMode="numeric" value={form.maxDiscount} onChange={(e) => set("maxDiscount", digits(e.target.value))} />
                </label>
              )}
              <label>
                ยอดขั้นต่ำ (บาท)
                <input className="text" inputMode="numeric" placeholder="0" value={form.minSpend} onChange={(e) => set("minSpend", digits(e.target.value))} />
              </label>
              <label>
                ใช้ได้กี่ครั้งต่อคน
                <input className="text" inputMode="numeric" value={form.perUserLimit} onChange={(e) => set("perUserLimit", digits(e.target.value))} />
              </label>
              <label>
                สิทธิ์ทั้งหมด (เว้นว่าง = ไม่จำกัด)
                <input className="text" inputMode="numeric" value={form.maxUses} onChange={(e) => set("maxUses", digits(e.target.value))} />
              </label>
              <label>
                ใช้ได้ถึงวันที่ (เว้นว่าง = ไม่หมดอายุ)
                <input className="text" type="date" value={form.expiresOn} onChange={(e) => set("expiresOn", e.target.value)} />
              </label>
            </div>
            <label className="row" style={{ marginTop: 12 }}>
              <span>เฉพาะลูกค้าใหม่ (ยังไม่เคยสั่ง)</span>
              <input type="checkbox" checked={form.newCustomersOnly} onChange={(e) => set("newCustomersOnly", e.target.checked)} />
            </label>
            <label className="promo-note">
              บันทึกช่วยจำ (ไม่แสดงให้ลูกค้า)
              <input className="text" value={form.note} onChange={(e) => set("note", e.target.value)} />
            </label>
            {err && <p className="err">{err}</p>}
            <div className="panel-row">
              <button className="btn primary-sm" disabled={!form.code || !form.value} onClick={save}>
                บันทึกโค้ด
              </button>
              <button className="btn ghost-sm" onClick={() => setForm(null)}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <header>
          <h2>
            <Icon name="megaphone" size={20} /> ส่งการ์ดโปรให้ลูกค้า
          </h2>
          <p>
            ส่งการ์ดโปรเข้าแชทเพื่อน LINE ทุกคน (บรอดแคสต์) · ใช้โควตา 1 ข้อความต่อเพื่อน 1 คน
            {quota && quota.limit !== null && ` · เดือนนี้ใช้ไป ${quota.used}/${quota.limit}`}
          </p>
        </header>
        <div className="broadcast">
          <div className="form">
            <div className="img-pick">
              <span>รูปโปร (แนวนอน สัดส่วนประมาณ 20:13)</span>
              <div className="panel-row" style={{ marginTop: 0 }}>
                <label className="btn ghost-sm upload">
                  {uploading ? "กำลังอัปโหลด…" : "อัปโหลดรูปของร้าน"}
                  <input type="file" accept="image/*" disabled={uploading} onChange={(e) => uploadImage(e.target.files?.[0])} />
                </label>
                <button type="button" className="btn ghost-sm" onClick={() => setCard({ ...card, image: `${SHOP.siteUrl}/promo/omelette-29.png` })}>
                  ใช้รูปข้าวไข่เจียว
                </button>
                <button type="button" className="btn ghost-sm" onClick={() => setCard({ ...card, image: "" })}>
                  ไม่ใส่รูป
                </button>
              </div>
            </div>
            <label>
              หัวข้อ
              <input className="text" value={card.title} onChange={(e) => setCard({ ...card, title: e.target.value })} />
            </label>
            <label>
              บรรทัดรอง
              <input className="text" value={card.subtitle} onChange={(e) => setCard({ ...card, subtitle: e.target.value })} />
            </label>
            <label>
              รายละเอียด
              <textarea rows={2} value={card.detail} onChange={(e) => setCard({ ...card, detail: e.target.value })} />
            </label>
            <label>
              แนบโค้ดส่วนลด
              <select className="text" value={card.code} onChange={(e) => setCard({ ...card, code: e.target.value })}>
                <option value="">ไม่แนบโค้ด</option>
                {promos
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} · {promoLabel(p)}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {/* ตัวอย่างการ์ด (หน้าตาใกล้เคียงใน LINE) */}
          <div className="flex-preview" aria-label="ตัวอย่างการ์ด">
            {card.image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="fp-hero" src={card.image} alt="รูปโปร" />
                <div className="fp-title">
                  <b>{card.title || "หัวข้อโปร"}</b>
                  {card.subtitle && <span>{card.subtitle}</span>}
                </div>
              </>
            ) : (
              <div className="fp-head">
                <small>暗号 CODE-MACHA</small>
                <b>{card.title || "หัวข้อโปร"}</b>
                {card.subtitle && <span>{card.subtitle}</span>}
              </div>
            )}
            <div className="fp-body">
              {chosen && (
                <dl>
                  <dt>โค้ดส่วนลด</dt>
                  <dd className="hl">{chosen.code}</dd>
                  <dt>ส่วนลด</dt>
                  <dd>{promoLabel(chosen)}</dd>
                  {chosen.expiresOn && (
                    <>
                      <dt>ใช้ได้ถึง</dt>
                      <dd>{chosen.expiresOn}</dd>
                    </>
                  )}
                </dl>
              )}
              {card.detail && <p>{card.detail}</p>}
            </div>
            <div className="fp-foot">สั่งเลย</div>
          </div>
        </div>
        <div className="panel-row">
          <button className="btn ghost-sm" disabled={sendState === "sending"} onClick={() => send(false)}>
            ให้ LINE ตรวจการ์ด (ไม่ส่งจริง)
          </button>
          <button className={`btn ${sendState === "confirm" ? "danger-sm" : "primary-sm"}`} disabled={sendState === "sending"} onClick={() => send(true)}>
            {sendState === "sending" ? "กำลังส่ง…" : sendState === "confirm" ? "ยืนยัน ส่งถึงเพื่อนทุกคน" : "ส่งถึงเพื่อนทุกคน"}
          </button>
          {sendState === "confirm" && (
            <button className="btn ghost-sm" onClick={() => setSendState("idle")}>
              ยกเลิก
            </button>
          )}
        </div>
        {sendMsg && <p className={sendMsg.ok ? "hint-ok" : "err"}>{sendMsg.text}</p>}
      </section>
    </>
  );
}
