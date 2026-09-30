"use client";

import { useEffect, useState } from "react";
import { baht, marginLevel, marginPct, powderCost, type CostItem, type CostsPayload } from "@/lib/costs";
import { hasPowder, powderExtra, type MenuItem, type Powder } from "@/lib/menu";
import PowderThumb, { powderTone } from "../PowderThumb";
import { uploadImage } from "./upload";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const dec = (s: string) => s.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

type Form = { id: string | null; name: string; note: string; extra: string; costItemId: string; image: string };
const EMPTY: Form = { id: null, name: "", note: "", extra: "", costItemId: "", image: "" };

// ผงมัทฉะให้ลูกค้าเลือก + ตารางราคา/กำไรของทุกเมนู × ทุกผง
export default function PowderPanel({ menu, data, items }: { menu: MenuItem[]; data: CostsPayload; items: Map<number, CostItem> }) {
  const [powders, setPowders] = useState<Powder[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setErr("");
    try {
      const url = await uploadImage(file);
      setForm((f) => (f ? { ...f, image: url } : f));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    fetch("/api/admin/powders", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPowders)
      .catch(() => setErr("โหลดผงมัทฉะไม่สำเร็จ (รัน migration-014 แล้วหรือยัง?)"));
  }, []);

  async function call(url: string, init: RequestInit) {
    const r = await fetch(url, init);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(j.error ?? "บันทึกไม่สำเร็จ");
      return false;
    }
    setErr("");
    setPowders(j);
    return true;
  }
  async function save() {
    if (!form) return;
    const ok = await call(
      "/api/admin/powders",
      json("POST", {
        id: form.id ? Number(form.id) : undefined,
        name: form.name,
        note: form.note,
        extraPerGram: form.extra === "" ? 0 : form.extra,
        costItemId: form.costItemId ? Number(form.costItemId) : null,
        imageUrl: form.image,
      }),
    );
    if (ok) setForm(null);
  }
  function remove(p: Powder) {
    if (confirm !== p.id) return setConfirm(p.id);
    setConfirm(null);
    call(`/api/admin/powders/${p.id}`, { method: "DELETE" });
  }

  if (!powders) return err ? <p className="banner">{err}</p> : <p className="empty">กำลังโหลด…</p>;

  const active = powders.filter((p) => p.active);
  const withGrams = menu.filter(hasPowder).sort((a, b) => (a.grams ?? 0) - (b.grams ?? 0) || a.sort - b.sort);
  const without = menu.filter((m) => m.kind !== "food" && !hasPowder(m));
  const powderIds = new Set(powders.map((p) => p.costItemId).filter((x): x is number => x !== null));
  const matchaItems = [...data.items].sort((a, b) => Number(b.name.includes("มัทฉะ")) - Number(a.name.includes("มัทฉะ")));
  const sample = withGrams[0];

  return (
    <>
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>ผงมัทฉะให้ลูกค้าเลือก</h2>
            <p>ราคาบวก = บาทต่อกรัม × กรัมที่เมนูใช้ (ปัดเป็นหลัก 5 บาท) · ผงอันบนสุดเป็นค่าเริ่มต้นที่ลูกค้าเห็น</p>
          </div>
          <button className="btn primary-sm" onClick={() => setForm(EMPTY)}>
            + เพิ่มผงมัทฉะ
          </button>
        </header>

        {form && (
          <div className="promo-form">
            <div className="hours">
              <label>
                ชื่อที่ลูกค้าเห็น
                <input
                  className="text"
                  value={form.name}
                  placeholder="เช่น ผงมัทฉะ A"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                บวกเพิ่ม (บาท/กรัม)
                <input
                  className="text"
                  inputMode="decimal"
                  value={form.extra}
                  placeholder="5"
                  onChange={(e) => setForm({ ...form, extra: dec(e.target.value) })}
                />
              </label>
              <label>
                คำอธิบายสั้น ๆ (ลูกค้าเห็น)
                <input
                  className="text"
                  value={form.note}
                  placeholder="เช่น ผงเกรดพิธีการ จากอุจิ"
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </label>
              <label>
                ต้นทุนจริง (จากคลังวัตถุดิบ)
                <select className="text" value={form.costItemId} onChange={(e) => setForm({ ...form, costItemId: e.target.value })}>
                  <option value="">ยังไม่ผูก</option>
                  {matchaItems.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({baht(c.unitCost)}
                      {c.unit ? `/${c.unit}` : ""})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {sample && form.extra !== "" && (
              <p className="cst-preview">
                ตัวอย่าง: {sample.name} ใช้ {sample.grams} กรัม → บวก{" "}
                <b>{baht(powderExtra(sample, { extraPerGram: Number(form.extra) }), 0)}</b>
              </p>
            )}
            <div className="cst-photo">
              <PowderThumb
                powder={{
                  name: form.name,
                  imageUrl: form.image || (form.costItemId ? (items.get(Number(form.costItemId))?.imageUrl ?? null) : null),
                }}
                tone={1}
                size={64}
              />
              <label className="btn ghost-sm upload">
                {uploading ? "กำลังอัปโหลด…" : form.image ? "เปลี่ยนรูป" : "อัปโหลดรูปผงนี้"}
                <input type="file" accept="image/*" hidden disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
              </label>
              {form.image && (
                <button className="btn ghost-sm" onClick={() => setForm({ ...form, image: "" })}>
                  ลบรูป
                </button>
              )}
              <small>ไม่อัปโหลด = ใช้รูปของวัตถุดิบที่ผูกไว้ (หรือกระป๋องการ์ตูน)</small>
            </div>
            {err && <p className="err">{err}</p>}
            <div className="panel-row">
              <button className="btn primary-sm" onClick={save} disabled={!form.name.trim() || uploading}>
                {form.id ? "บันทึกการแก้ไข" : "เพิ่มผงมัทฉะ"}
              </button>
              <button className="btn ghost-sm" onClick={() => setForm(null)}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}
        {!form && err && <p className="err">{err}</p>}

        <ul className="mlist">
          {powders.map((p, i) => {
            const c = p.costItemId !== null ? items.get(p.costItemId) : undefined;
            return (
              <li key={p.id} className={p.active ? undefined : "off"}>
                <span className="pw-order">
                  <button
                    onClick={() => call(`/api/admin/powders/${p.id}`, json("PATCH", { move: -1 }))}
                    disabled={i === 0}
                    aria-label={`เลื่อน ${p.name} ขึ้น`}
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => call(`/api/admin/powders/${p.id}`, json("PATCH", { move: 1 }))}
                    disabled={i === powders.length - 1}
                    aria-label={`เลื่อน ${p.name} ลง`}
                  >
                    ▼
                  </button>
                </span>
                <PowderThumb powder={p} tone={powderTone(p, powders)} size={40} />
                <div className="mlist-info">
                  <b>
                    {p.name} {i === 0 && <span className="pw-default">ค่าเริ่มต้น</span>}
                  </b>
                  <small>
                    {p.extraPerGram > 0 ? `บวก ${baht(p.extraPerGram)}/กรัม` : "ไม่บวกเพิ่ม"} ·{" "}
                    {c ? `ต้นทุนจริง ${baht(c.unitCost)}/กรัม (${c.name})` : "ยังไม่ผูกต้นทุน"}
                    {p.note ? ` · ${p.note}` : ""}
                  </small>
                </div>
                <button
                  className="toggle"
                  role="switch"
                  aria-checked={p.active}
                  onClick={() => call(`/api/admin/powders/${p.id}`, json("PATCH", { active: !p.active }))}
                >
                  <span className="knob" aria-hidden="true" />
                  {p.active ? "ให้เลือก" : "ปิด"}
                </button>
                <button
                  className="btn ghost-sm"
                  onClick={() =>
                    setForm({
                      id: p.id,
                      name: p.name,
                      note: p.note,
                      extra: String(p.extraPerGram),
                      costItemId: p.costItemId ? String(p.costItemId) : "",
                      image: p.ownImage ?? "",
                    })
                  }
                >
                  แก้ไข
                </button>
                <button className={`btn ${confirm === p.id ? "danger-sm" : "ghost-sm"}`} onClick={() => remove(p)}>
                  {confirm === p.id ? "ยืนยันลบ" : "ลบ"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>ราคาขายใน LINE และกำไร ตามผงที่ลูกค้าเลือก</h2>
            <p>
              ต้นทุนคิดจากสูตรในแท็บ “ต้นทุนรายเมนู” โดยเปลี่ยนเฉพาะผงมัทฉะตามที่เลือก × กรัมของเมนู · ราคานี้ยังไม่รวมนมทางเลือกและท็อปปิ้ง
            </p>
          </div>
          <a className="btn primary-sm" href="/admin/menu-board" target="_blank" rel="noopener">
            พิมพ์เมนูหน้าร้าน
          </a>
        </header>
        {withGrams.length === 0 ? (
          <p className="empty">ยังไม่มีเมนูที่ใส่กรัมผงมัทฉะ — ใส่ได้ที่ ตั้งค่าร้าน › เมนู</p>
        ) : (
          <div className="cst-table-wrap">
            <table className="cst-table pw-matrix">
              <thead>
                <tr>
                  <th>เมนู</th>
                  {active.map((p) => (
                    <th key={p.id} className="num">
                      <span className="pw-th">
                        <PowderThumb powder={p} tone={powderTone(p, powders)} size={24} />
                        {p.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withGrams.map((m) => {
                  const lines = data.recipes[m.id] ?? [];
                  return (
                    <tr key={m.id}>
                      <td>
                        <b>{m.name}</b>
                        <small>
                          {m.grams} กรัม · เริ่ม {baht(m.price, 0)}
                        </small>
                      </td>
                      {active.map((p) => {
                        const price = m.price + powderExtra(m, p);
                        const cost = lines.length ? powderCost(lines, items, m.grams ?? 0, p, powderIds) : null;
                        const mg = cost === null ? null : marginPct(price, cost);
                        return (
                          <td key={p.id} className="num">
                            <b>{baht(price, 0)}</b>
                            <small>
                              {mg === null ? (
                                lines.length ? (
                                  "ผงยังไม่ผูกต้นทุน"
                                ) : (
                                  "ยังไม่มีสูตรต้นทุน"
                                )
                              ) : (
                                <>
                                  ทุน {baht(cost!, 0)} ·{" "}
                                  <span className={`cst-level ${marginLevel(mg).id}`}>
                                    <i aria-hidden="true" />
                                    {mg.toFixed(0)}%
                                  </span>
                                </>
                              )}
                            </small>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {without.length > 0 && (
          <p className="pw-without">
            เครื่องดื่มที่ยังไม่ให้เลือกผง: {without.map((m) => m.name).join(", ")} — ใส่กรัมผงมัทฉะได้ที่ ตั้งค่าร้าน › เมนู › แก้ไข
          </p>
        )}
      </section>
    </>
  );
}
