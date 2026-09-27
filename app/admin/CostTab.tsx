"use client";

import { useEffect, useMemo, useState } from "react";
import {
  COST_CATEGORIES,
  baht,
  categoryLabel,
  gpRate,
  lineTotal,
  lineUnitCost,
  marginLevel,
  marginPct,
  onlinePrice,
  packUnitCost,
  priceForMargin,
  recipeCost,
  type CostCategory,
  type CostItem,
  type CostLine,
  type CostsPayload,
  type GpPlatform,
} from "@/lib/costs";
import type { MenuItem } from "@/lib/menu";
import MenuArt, { artTint } from "../MenuArt";
import PowderPanel from "./PowderPanel";
import Icon, { type IconName } from "../Icon";
import MatchaTin from "../MatchaTin";
import { uploadImage } from "./upload";

type View = "menus" | "powders" | "items" | "gp";
const VIEWS: { id: View; label: string }[] = [
  { id: "menus", label: "ต้นทุนรายเมนู" },
  { id: "powders", label: "ผงมัทฉะ" },
  { id: "items", label: "คลังวัตถุดิบ" },
  { id: "gp", label: "เดลิเวอรี่ (GP)" },
];
const TARGETS = [50, 60, 65, 70, 75];

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const dec = (s: string) => s.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
const round5 = (n: number) => Math.ceil(n / 5) * 5;
const fmtNum = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 3 });

function Level({ m }: { m: number }) {
  const l = marginLevel(m);
  return (
    <span className={`cst-level ${l.id}`}>
      <i aria-hidden="true" />
      {l.label}
    </span>
  );
}

export default function CostTab({ menu, reload }: { menu: MenuItem[]; reload: () => void }) {
  const [data, setData] = useState<CostsPayload | null>(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState<View>("menus");
  const [editing, setEditing] = useState<MenuItem | null>(null);

  useEffect(() => {
    fetch("/api/admin/costs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErr("โหลดข้อมูลต้นทุนไม่สำเร็จ (รัน migration-013 แล้วหรือยัง?)"));
  }, []);

  // ส่งคำขอแล้วอัปเดตข้อมูลทั้งหมดจากผลลัพธ์
  async function call(url: string, init: RequestInit) {
    const r = await fetch(url, init);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? "บันทึกไม่สำเร็จ");
    setData(j);
    setErr("");
    return j as CostsPayload;
  }

  const items = useMemo(() => new Map((data?.items ?? []).map((i) => [i.id, i])), [data]);

  if (!data)
    return err ? (
      <p className="banner" role="alert">
        {err}
      </p>
    ) : (
      <p className="empty">กำลังโหลดต้นทุน…</p>
    );

  return (
    <div className="cst">
      <div className="seg" role="tablist" aria-label="หมวดต้นทุน">
        {VIEWS.map((v) => (
          <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {err && (
        <p className="banner" role="alert">
          {err}
        </p>
      )}

      {view === "menus" && <MenuCosts menu={menu} data={data} items={items} onEdit={setEditing} />}
      {view === "powders" && <PowderPanel menu={menu} data={data} items={items} />}
      {view === "items" && <ItemLibrary data={data} call={call} />}
      {view === "gp" && <Platforms data={data} call={call} />}

      {editing && (
        <RecipeEditor
          item={editing}
          data={data}
          items={items}
          onClose={() => setEditing(null)}
          onSave={async (lines, price) => {
            await call(`/api/admin/costs/recipe/${encodeURIComponent(editing.id)}`, json("PUT", { lines }));
            if (price !== editing.price) {
              const r = await fetch(`/api/admin/menu/${encodeURIComponent(editing.id)}`, json("PATCH", { price }));
              if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "เปลี่ยนราคาไม่สำเร็จ");
              reload();
            }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ราคาบนแอปเดลิเวอรี่ (บวก GP จากราคา LINE) — ถ้าแต่ละแอป GP ต่างกันแสดงเป็นช่วง
function appPrice(price: number, data: CostsPayload) {
  if (!data.platforms.length) return "";
  const ps = data.platforms.map((g) => Math.ceil(onlinePrice(price, gpRate(g, data.gpVat))));
  const lo = Math.min(...ps);
  const hi = Math.max(...ps);
  return lo === hi ? baht(lo, 0) : `${baht(lo, 0)}–${baht(hi, 0)}`;
}

// ---------- ต้นทุนรายเมนู ----------
function MenuCosts({
  menu,
  data,
  items,
  onEdit,
}: {
  menu: MenuItem[];
  data: CostsPayload;
  items: Map<number, CostItem>;
  onEdit: (m: MenuItem) => void;
}) {
  const rows = menu.map((m) => {
    const lines = data.recipes[m.id] ?? [];
    const cost = recipeCost(lines, items);
    return { m, lines, cost, profit: m.price - cost, margin: marginPct(m.price, cost) };
  });
  const done = rows.filter((r) => r.lines.length);
  const avg = done.length ? done.reduce((n, r) => n + r.margin, 0) / done.length : 0;
  const worst = done.reduce<(typeof rows)[number] | null>((w, r) => (!w || r.margin < w.margin ? r : w), null);

  return (
    <>
      <div className="stats">
        <div className="stat">
          <span>ใส่ต้นทุนแล้ว</span>
          <b>
            {done.length}/{rows.length}
          </b>
          <small>เมนู</small>
        </div>
        <div className="stat">
          <span>กำไรเฉลี่ย</span>
          <b>{done.length ? `${avg.toFixed(0)}%` : "–"}</b>
          <small>ของราคาขายใน LINE</small>
        </div>
        <div className="stat">
          <span>กำไรน้อยสุด</span>
          <b>{worst ? `${worst.margin.toFixed(0)}%` : "–"}</b>
          <small>{worst ? worst.m.name : "ยังไม่มีข้อมูล"}</small>
        </div>
      </div>

      <section className="panel">
        <header>
          <h2>ต้นทุนรายเมนู</h2>
          <p>กด “ตั้งต้นทุน” เพื่อใส่วัตถุดิบ บรรจุภัณฑ์ ค่าแรง ของแต่ละเมนู · ราคาวัตถุดิบในคลังเปลี่ยน ต้นทุนทุกเมนูอัปเดตเอง</p>
        </header>
        <ul className="cst-menus">
          {rows.map(({ m, lines, cost, profit, margin }) => (
            <li key={m.id}>
              <span className="cst-thumb" style={{ background: artTint(m) }}>
                <MenuArt item={m} size={30} />
              </span>
              <div className="cst-name">
                <b>{m.name}</b>
                <small>
                  LINE {baht(m.price, 0)}
                  {appPrice(m.price, data) && ` · แอป ${appPrice(m.price, data)}`}
                </small>
              </div>
              {lines.length ? (
                <>
                  <div className="cst-num">
                    <small>ต้นทุน</small>
                    <b>{baht(cost)}</b>
                  </div>
                  <div className="cst-num">
                    <small>กำไร/แก้ว</small>
                    <b>{baht(profit)}</b>
                  </div>
                  <div className="cst-margin">
                    <div className="cst-bar" aria-hidden="true">
                      <i className={marginLevel(margin).id} style={{ width: `${Math.max(0, Math.min(100, margin))}%` }} />
                    </div>
                    <span>
                      <b>{margin.toFixed(1)}%</b> <Level m={margin} />
                    </span>
                  </div>
                </>
              ) : (
                <p className="cst-none">ยังไม่ได้ใส่ต้นทุน</p>
              )}
              <button className={`btn ${lines.length ? "ghost-sm" : "primary-sm"}`} onClick={() => onEdit(m)}>
                {lines.length ? "แก้ไข" : "ตั้งต้นทุน"}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// ---------- หน้าต่างแก้ต้นทุนของเมนู ----------
function RecipeEditor({
  item,
  data,
  items,
  onClose,
  onSave,
}: {
  item: MenuItem;
  data: CostsPayload;
  items: Map<number, CostItem>;
  onClose: () => void;
  onSave: (lines: CostLine[], price: number) => Promise<void>;
}) {
  const [lines, setLines] = useState<CostLine[]>(() => (data.recipes[item.id] ?? []).map((l) => ({ ...l })));
  const [price, setPrice] = useState(String(item.price));
  const [target, setTarget] = useState(65);
  const [custom, setCustom] = useState({ name: "", category: "ingredient" as CostCategory, unitCost: "", unit: "", qty: "1" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const cost = recipeCost(lines, items);
  const p = Number(price) || 0;
  const margin = marginPct(p, cost);
  const suggested = round5(priceForMargin(cost, target));
  const setLine = (i: number, patch: Partial<CostLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function addFromLibrary(c: CostItem) {
    const i = lines.findIndex((l) => l.costItemId === c.id);
    if (i >= 0) return setLine(i, { qty: lines[i].qty + 1 });
    setLines([...lines, { costItemId: c.id, name: c.name, category: c.category, unit: c.unit, unitCost: c.unitCost, qty: 1 }]);
  }
  function addCustom() {
    const unitCost = Number(custom.unitCost);
    const qty = Number(custom.qty);
    if (!custom.name.trim() || !Number.isFinite(unitCost) || !Number.isFinite(qty)) return;
    setLines([
      ...lines,
      { costItemId: null, name: custom.name.trim(), category: custom.category, unit: custom.unit.trim(), unitCost, qty },
    ]);
    setCustom({ name: "", category: custom.category, unitCost: "", unit: "", qty: "1" });
  }
  async function save() {
    setBusy(true);
    setErr("");
    try {
      // รายการที่ผูกคลังส่งราคาปัจจุบันไปเก็บเป็นสำเนาด้วย
      await onSave(
        lines.map((l) => ({ ...l, unitCost: lineUnitCost(l, items) })),
        Math.round(p),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="backdrop" onClick={() => !busy && onClose()} />
      <div className="cst-modal" role="dialog" aria-modal="true" aria-label={`ต้นทุนของ ${item.name}`}>
        <header className="cst-modal-head">
          <span className="cst-thumb big" style={{ background: artTint(item) }}>
            <MenuArt item={item} size={44} />
          </span>
          <div>
            <h2>ต้นทุนของ “{item.name}”</h2>
            <p>ใส่ของที่ใช้ต่อ 1 แก้ว/จาน · กดหยิบจากคลังด้านล่าง หรือเพิ่มเองเฉพาะเมนูนี้</p>
          </div>
          <button className="cst-x" onClick={onClose} aria-label="ปิด" disabled={busy}>
            ×
          </button>
        </header>

        {data.items.length > 0 && (
          <div className="cst-quick">
            {COST_CATEGORIES.map((c) => {
              const list = data.items.filter((i) => i.category === c.id);
              if (!list.length) return null;
              return (
                <div key={c.id}>
                  <small>{c.label}</small>
                  <div className="cst-chips">
                    {list.map((i) => (
                      <button key={i.id} onClick={() => addFromLibrary(i)} title={`${baht(i.unitCost)}${i.unit ? ` / ${i.unit}` : ""}`}>
                        <ItemThumb item={i} size={22} />+ {i.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="cst-table-wrap">
          <table className="cst-table">
            <thead>
              <tr>
                <th>รายการ</th>
                <th className="num">ใช้</th>
                <th className="num">ราคา/หน่วย</th>
                <th className="num">รวม</th>
                <th aria-label="ลบ" />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={5} className="cst-empty-row">
                    ยังไม่มีรายการ — กดหยิบจากคลังด้านบน หรือเพิ่มเองด้านล่าง
                  </td>
                </tr>
              )}
              {lines.map((l, i) => {
                const linked = l.costItemId !== null && items.has(l.costItemId);
                return (
                  <tr key={i}>
                    <td>
                      <div className="cst-line-name">
                        <ItemThumb item={{ ...l, imageUrl: linked ? items.get(l.costItemId!)?.imageUrl : null }} size={34} />
                        <div>
                          <b>{l.name}</b>
                          <small className={`cst-cat ${l.category}`}>{categoryLabel(l.category)}</small>
                          {linked && <small className="cst-linked">ราคาจากคลัง</small>}
                        </div>
                      </div>
                    </td>
                    <td className="num">
                      <input
                        className="cst-in"
                        inputMode="decimal"
                        value={String(l.qty)}
                        onChange={(e) => setLine(i, { qty: Number(dec(e.target.value)) || 0 })}
                        aria-label={`จำนวน ${l.name}`}
                      />
                      <span className="cst-unit">{l.unit}</span>
                    </td>
                    <td className="num">
                      {linked ? (
                        baht(lineUnitCost(l, items))
                      ) : (
                        <input
                          className="cst-in"
                          inputMode="decimal"
                          value={String(l.unitCost)}
                          onChange={(e) => setLine(i, { unitCost: Number(dec(e.target.value)) || 0 })}
                          aria-label={`ราคาต่อหน่วย ${l.name}`}
                        />
                      )}
                    </td>
                    <td className="num">
                      <b>{baht(lineTotal(l, items))}</b>
                    </td>
                    <td>
                      <button className="cst-rm" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label={`ลบ ${l.name}`}>
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <details className="cst-custom">
          <summary>+ เพิ่มรายการเฉพาะเมนูนี้ (ไม่มีในคลัง)</summary>
          <div className="cst-custom-row">
            <input
              className="text"
              placeholder="ชื่อ เช่น น้ำมะพร้าวสด"
              value={custom.name}
              onChange={(e) => setCustom({ ...custom, name: e.target.value })}
            />
            <select
              className="text"
              value={custom.category}
              onChange={(e) => setCustom({ ...custom, category: e.target.value as CostCategory })}
            >
              {COST_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              className="text"
              inputMode="decimal"
              placeholder="ราคา/หน่วย"
              value={custom.unitCost}
              onChange={(e) => setCustom({ ...custom, unitCost: dec(e.target.value) })}
            />
            <input
              className="text"
              placeholder="หน่วย"
              value={custom.unit}
              onChange={(e) => setCustom({ ...custom, unit: e.target.value })}
            />
            <input
              className="text"
              inputMode="decimal"
              placeholder="จำนวน"
              value={custom.qty}
              onChange={(e) => setCustom({ ...custom, qty: dec(e.target.value) })}
            />
            <button className="btn ghost-sm" onClick={addCustom} disabled={!custom.name.trim() || custom.unitCost === ""}>
              เพิ่ม
            </button>
          </div>
        </details>

        <div className="cst-sum">
          <div>
            <small>ต้นทุนรวม</small>
            <b>{baht(cost)}</b>
          </div>
          <div>
            <small>ราคาขายใน LINE</small>
            <b>{baht(p, 0)}</b>
          </div>
          <div>
            <small>กำไร/แก้ว</small>
            <b>{baht(p - cost)}</b>
          </div>
          <div>
            <small>กำไร % (ราคา LINE)</small>
            <b>{margin.toFixed(1)}%</b>
            {cost > 0 && <Level m={margin} />}
          </div>
        </div>

        <section className="cst-box">
          <h3>ช่วยตั้งราคาขายใน LINE</h3>
          <p>
            ราคานี้ยังไม่บวก GP · อยากได้กำไรกี่ % ของราคาขาย (ถ้าคิดเฉพาะวัตถุดิบ ร้านเครื่องดื่มมักตั้งเป้า 65–70%
            แต่ต้นทุนที่นี่รวมค่าแรงและค่าน้ำไฟแล้ว)
          </p>
          <div className="chips">
            {TARGETS.map((t) => (
              <button key={t} className="chip" aria-pressed={target === t} onClick={() => setTarget(t)}>
                {t}%
              </button>
            ))}
          </div>
          <div className="cst-suggest">
            <span>
              ราคาแนะนำ <b>{cost > 0 ? baht(suggested, 0) : "–"}</b>
              {cost > 0 && <small> (ปัดขึ้นให้ลงท้าย 0/5)</small>}
            </span>
            <button className="btn ghost-sm" disabled={cost <= 0} onClick={() => setPrice(String(suggested))}>
              ใช้ราคานี้
            </button>
          </div>
          <label className="cst-price">
            ราคาขายใน LINE / หน้าร้าน
            <input className="text" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
          </label>
          {Math.round(p) !== item.price && (
            <p className="cst-warn">
              ราคาในเมนูจะเปลี่ยนจาก {baht(item.price, 0)} เป็น {baht(p, 0)} เมื่อกดบันทึก
            </p>
          )}
        </section>

        {data.platforms.length > 0 && (
          <section className="cst-box">
            <h3>ราคาบนแอปเดลิเวอรี่ (บวก GP แล้ว)</h3>
            <p>
              ตั้งราคานี้บนแอป ร้านจะได้เงินเท่าขายใน LINE {baht(p, 0)} {data.gpVat ? "(คิด GP รวม VAT 7%)" : ""}
            </p>
            <table className="cst-table">
              <thead>
                <tr>
                  <th>แพลตฟอร์ม</th>
                  <th className="num">หักจริง</th>
                  <th className="num">ควรตั้งราคา</th>
                  <th className="num">บวกเพิ่ม</th>
                </tr>
              </thead>
              <tbody>
                {data.platforms.map((g) => {
                  const rate = gpRate(g, data.gpVat);
                  const op = onlinePrice(p, rate);
                  return (
                    <tr key={g.id}>
                      <td>{g.name}</td>
                      <td className="num">{(rate * 100).toFixed(1)}%</td>
                      <td className="num">
                        <b>{baht(Math.ceil(op), 0)}</b>
                      </td>
                      <td className="num">+{baht(Math.ceil(op) - p, 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {err && <p className="err">{err}</p>}
        <div className="cst-actions">
          <button className="btn primary-sm" onClick={save} disabled={busy || p <= 0}>
            {busy ? "กำลังบันทึก…" : "บันทึกต้นทุน"}
          </button>
          <button className="btn ghost-sm" onClick={onClose} disabled={busy}>
            ยกเลิก
          </button>
        </div>
      </div>
    </>
  );
}

// รูปวัตถุดิบ: รูปจริงถ้ามี ไม่งั้นผงมัทฉะเป็นกระป๋องการ์ตูน อย่างอื่นเป็นไอคอนตามหมวด
const CAT_ICON: Record<CostCategory, IconName> = { ingredient: "bowl", packaging: "bag", labor: "star", utility: "clock", other: "note" };
export function ItemThumb({
  item,
  size = 40,
}: {
  item: { name: string; category: CostCategory; imageUrl?: string | null };
  size?: number;
}) {
  return (
    <span className="cst-ithumb" style={{ width: size, height: size }}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" loading="lazy" />
      ) : item.name.includes("มัทฉะ") ? (
        <MatchaTin tone={1} size={size * 0.8} />
      ) : (
        <Icon name={CAT_ICON[item.category] ?? "note"} size={size * 0.45} />
      )}
    </span>
  );
}

// ---------- คลังวัตถุดิบ ----------
type ItemForm = {
  id: number | null;
  name: string;
  category: CostCategory;
  mode: "pack" | "unit";
  packPrice: string;
  packSize: string;
  unitCost: string;
  unit: string;
  imageUrl: string;
};
const EMPTY_ITEM: ItemForm = {
  id: null,
  name: "",
  category: "ingredient",
  mode: "pack",
  packPrice: "",
  packSize: "",
  unitCost: "",
  unit: "",
  imageUrl: "",
};

function ItemLibrary({ data, call }: { data: CostsPayload; call: (url: string, init: RequestInit) => Promise<CostsPayload> }) {
  const [form, setForm] = useState<ItemForm | null>(null);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setErr("");
    try {
      const url = await uploadImage(file);
      setForm((f) => (f ? { ...f, imageUrl: url } : f));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }
  const used = (id: number) => Object.values(data.recipes).filter((ls) => ls.some((l) => l.costItemId === id)).length;
  const set = <K extends keyof ItemForm>(k: K, v: ItemForm[K]) => form && setForm({ ...form, [k]: v });

  const preview =
    form?.mode === "pack"
      ? Number(form.packSize) > 0
        ? packUnitCost(Number(form.packPrice), Number(form.packSize))
        : null
      : form
        ? Number(form.unitCost)
        : null;

  async function save() {
    if (!form) return;
    setErr("");
    try {
      await call(
        "/api/admin/costs/items",
        json("POST", {
          id: form.id ?? undefined,
          name: form.name,
          category: form.category,
          unit: form.unit,
          packPrice: form.mode === "pack" ? form.packPrice : null,
          packSize: form.mode === "pack" ? form.packSize : null,
          unitCost: form.unitCost,
          imageUrl: form.imageUrl,
        }),
      );
      setForm(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }
  async function remove(i: CostItem) {
    if (confirm !== i.id) return setConfirm(i.id);
    setConfirm(null);
    await call(`/api/admin/costs/items/${i.id}`, { method: "DELETE" }).catch((e) => setErr(e.message));
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>คลังวัตถุดิบ & ต้นทุนที่ใช้บ่อย</h2>
          <p>ใส่ราคาที่ซื้อจริงกับปริมาณที่ได้ ระบบคิดราคาต่อหน่วยให้ เช่น ผงมัทฉะ 650 บาท ได้ 30 กรัม = 21.67 บาท/กรัม</p>
        </div>
        <button className="btn primary-sm" onClick={() => setForm(EMPTY_ITEM)}>
          + เพิ่มรายการ
        </button>
      </header>

      {form && (
        <div className="promo-form cst-item-form">
          <div className="chips" role="group" aria-label="หมวด">
            {COST_CATEGORIES.map((c) => (
              <button key={c.id} className="chip" aria-pressed={form.category === c.id} onClick={() => set("category", c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="hours">
            <label>
              ชื่อรายการ
              <input
                className="text"
                value={form.name}
                placeholder="เช่น ผงมัทฉะ Matcha Rounting"
                onChange={(e) => set("name", e.target.value)}
              />
            </label>
            <label>
              ใส่ราคาแบบ
              <select className="text" value={form.mode} onChange={(e) => set("mode", e.target.value as ItemForm["mode"])}>
                <option value="pack">ราคาที่ซื้อมา ÷ ปริมาณ</option>
                <option value="unit">ราคาต่อหน่วยเลย</option>
              </select>
            </label>
            {form.mode === "pack" ? (
              <>
                <label>
                  ซื้อมาราคา (บาท)
                  <input
                    className="text"
                    inputMode="decimal"
                    value={form.packPrice}
                    placeholder="650"
                    onChange={(e) => set("packPrice", dec(e.target.value))}
                  />
                </label>
                <label>
                  ได้ปริมาณ
                  <input
                    className="text"
                    inputMode="decimal"
                    value={form.packSize}
                    placeholder="30"
                    onChange={(e) => set("packSize", dec(e.target.value))}
                  />
                </label>
              </>
            ) : (
              <label>
                ราคาต่อหน่วย (บาท)
                <input
                  className="text"
                  inputMode="decimal"
                  value={form.unitCost}
                  placeholder="2"
                  onChange={(e) => set("unitCost", dec(e.target.value))}
                />
              </label>
            )}
            <label>
              หน่วย
              <input
                className="text"
                value={form.unit}
                placeholder="กรัม / มล. / ใบ / แก้ว"
                onChange={(e) => set("unit", e.target.value)}
              />
            </label>
          </div>
          <p className="cst-preview">
            ราคาต่อหน่วย: <b>{preview !== null && Number.isFinite(preview) ? baht(preview) : "–"}</b>
            {form.unit ? ` / ${form.unit}` : ""}
          </p>
          <div className="cst-photo">
            <ItemThumb item={form} size={64} />
            <label className="btn ghost-sm upload">
              {uploading ? "กำลังอัปโหลด…" : form.imageUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
              <input type="file" accept="image/*" hidden disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            {form.imageUrl && (
              <button className="btn ghost-sm" onClick={() => set("imageUrl", "")}>
                ลบรูป
              </button>
            )}
            <small>ถ่ายรูปถุง/กระป๋องจริงจากมือถือได้เลย ระบบย่อให้เอง</small>
          </div>
          {err && <p className="err">{err}</p>}
          <div className="panel-row">
            <button className="btn primary-sm" onClick={save} disabled={!form.name.trim()}>
              {form.id ? "บันทึกการแก้ไข" : "เพิ่มเข้าคลัง"}
            </button>
            <button className="btn ghost-sm" onClick={() => setForm(null)}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {data.items.length === 0 && <p className="empty">ยังไม่มีรายการในคลัง</p>}
      {COST_CATEGORIES.map((c) => {
        const list = data.items.filter((i) => i.category === c.id);
        if (!list.length) return null;
        return (
          <div key={c.id} className="reward-group">
            <h3>
              {c.label} <small>{list.length} รายการ</small>
            </h3>
            <ul className="mlist">
              {list.map((i) => (
                <li key={i.id}>
                  <ItemThumb item={i} />
                  <div className="mlist-info">
                    <b>{i.name}</b>
                    <small>
                      {i.packPrice !== null && i.packSize !== null
                        ? `ซื้อ ${baht(i.packPrice, 0)} ได้ ${fmtNum(i.packSize)} ${i.unit}`
                        : "ใส่ราคาต่อหน่วยเอง"}{" "}
                      · ใช้ใน {used(i.id)} เมนู
                    </small>
                  </div>
                  <span className="cst-unitcost">
                    {baht(i.unitCost)}
                    {i.unit && <small> / {i.unit}</small>}
                  </span>
                  <button
                    className="btn ghost-sm"
                    onClick={() =>
                      setForm({
                        id: i.id,
                        name: i.name,
                        category: i.category,
                        mode: i.packPrice !== null ? "pack" : "unit",
                        packPrice: i.packPrice === null ? "" : String(i.packPrice),
                        packSize: i.packSize === null ? "" : String(i.packSize),
                        unitCost: String(i.unitCost),
                        unit: i.unit,
                        imageUrl: i.imageUrl ?? "",
                      })
                    }
                  >
                    แก้ไข
                  </button>
                  <button className={`btn ${confirm === i.id ? "danger-sm" : "ghost-sm"}`} onClick={() => remove(i)}>
                    {confirm === i.id ? "ยืนยันลบ" : "ลบ"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

// ---------- แพลตฟอร์มเดลิเวอรี่ ----------
function Platforms({ data, call }: { data: CostsPayload; call: (url: string, init: RequestInit) => Promise<CostsPayload> }) {
  const [form, setForm] = useState<{ id: number | null; name: string; gp: string } | null>(null);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const sample = 120;

  async function save() {
    if (!form) return;
    try {
      await call("/api/admin/costs/platforms", json("POST", { id: form.id ?? undefined, name: form.name, gpPercent: form.gp }));
      setForm(null);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }
  async function remove(g: GpPlatform) {
    if (confirm !== g.id) return setConfirm(g.id);
    setConfirm(null);
    await call(`/api/admin/costs/platforms/${g.id}`, { method: "DELETE" }).catch((e) => setErr(e.message));
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>แพลตฟอร์มเดลิเวอรี่ (ค่า GP)</h2>
          <p>ใส่ % ที่แอปหักตามสัญญาจริงของร้าน ระบบจะบอกในหน้าต้นทุนว่าควรตั้งราคาบนแอปเท่าไร</p>
        </div>
        <button className="btn primary-sm" onClick={() => setForm({ id: null, name: "", gp: "" })}>
          + เพิ่มแพลตฟอร์ม
        </button>
      </header>
      <div className="panel-row">
        <button
          className="toggle"
          role="switch"
          aria-checked={data.gpVat}
          onClick={() => call("/api/admin/costs", json("PUT", { gpVat: !data.gpVat }))}
        >
          <span className="knob" aria-hidden="true" />
          บวก VAT 7% บนค่า GP (เช่น GP 30% หักจริง 32.1%)
        </button>
      </div>

      {form && (
        <div className="promo-form">
          <div className="hours">
            <label>
              ชื่อแพลตฟอร์ม
              <input
                className="text"
                value={form.name}
                placeholder="เช่น Grab, LINE MAN"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              ค่า GP (%)
              <input
                className="text"
                inputMode="decimal"
                value={form.gp}
                placeholder="30"
                onChange={(e) => setForm({ ...form, gp: dec(e.target.value) })}
              />
            </label>
          </div>
          {err && <p className="err">{err}</p>}
          <div className="panel-row">
            <button className="btn primary-sm" onClick={save} disabled={!form.name.trim() || !form.gp}>
              บันทึก
            </button>
            <button className="btn ghost-sm" onClick={() => setForm(null)}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {data.platforms.length === 0 ? (
        <p className="empty">ยังไม่มีแพลตฟอร์ม</p>
      ) : (
        <ul className="mlist">
          {data.platforms.map((g) => {
            const rate = gpRate(g, data.gpVat);
            return (
              <li key={g.id}>
                <div className="mlist-info">
                  <b>{g.name}</b>
                  <small>
                    GP {g.gpPercent}% · หักจริง {(rate * 100).toFixed(1)}% · เมนู {baht(sample, 0)} ควรตั้งบนแอป{" "}
                    {baht(Math.ceil(onlinePrice(sample, rate)), 0)}
                  </small>
                </div>
                <button className="btn ghost-sm" onClick={() => setForm({ id: g.id, name: g.name, gp: String(g.gpPercent) })}>
                  แก้ไข
                </button>
                <button className={`btn ${confirm === g.id ? "danger-sm" : "ghost-sm"}`} onClick={() => remove(g)}>
                  {confirm === g.id ? "ยืนยันลบ" : "ลบ"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
