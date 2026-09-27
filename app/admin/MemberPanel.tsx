"use client";

import { useEffect, useState } from "react";
import type { MenuItem } from "@/lib/menu";
import type { Coupon, Reward } from "@/lib/member";
import Icon from "../Icon";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type Form = { id: number | null; name: string; description: string; points: string; stock: string; menuItemId: string };
const EMPTY: Form = { id: null, name: "", description: "", points: "", stock: "", menuItemId: "" };
const digits = (s: string) => s.replace(/\D/g, "");
const when = (s: string) =>
  new Date(s).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// สมาชิก & ของขวัญ: ส่งมอบคูปองที่ลูกค้าแลก + จัดการรายการของขวัญ
export default function MemberPanel({ menu }: { menu: MenuItem[] }) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState("");
  const [find, setFind] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = (j: { rewards: Reward[]; redemptions: Coupon[] }) => {
    setRewards(j.rewards);
    setCoupons(j.redemptions);
  };

  useEffect(() => {
    fetch("/api/admin/rewards", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(apply)
      .catch(() => setErr("โหลดข้อมูลสมาชิกไม่สำเร็จ (รัน migration-010 แล้วหรือยัง?)"));
  }, []);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    const r = await fetch(url, init);
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setConfirm(null);
    if (!r.ok) {
      setErr(j.error ?? "บันทึกไม่สำเร็จ");
      return false;
    }
    setErr("");
    apply(j);
    return true;
  }

  const give = (c: Coupon) => call(`/api/admin/redemptions/${c.id}`, json("PATCH", { to: "given" }));
  function cancel(c: Coupon) {
    if (confirm !== `c${c.id}`) return setConfirm(`c${c.id}`);
    call(`/api/admin/redemptions/${c.id}`, json("PATCH", { to: "cancelled" }));
  }
  const toggle = (r: Reward) => call(`/api/admin/rewards/${r.id}`, json("PATCH", { active: !r.active }));
  function remove(r: Reward) {
    if (confirm !== `r${r.id}`) return setConfirm(`r${r.id}`);
    call(`/api/admin/rewards/${r.id}`, { method: "DELETE" });
  }
  async function save() {
    if (!form) return;
    const ok = await call(
      "/api/admin/rewards",
      json("POST", {
        id: form.id ?? undefined,
        name: form.name,
        description: form.description,
        points: Number(form.points),
        stock: form.stock === "" ? null : Number(form.stock),
        menuItemId: form.menuItemId,
      }),
    );
    if (ok) setForm(null);
  }

  const q = find.trim().toUpperCase();
  const waiting = coupons.filter((c) => c.status === "waiting" && (!q || c.code.includes(q) || (c.customerName ?? "").toUpperCase().includes(q)));
  const given = coupons.filter((c) => c.status === "given").slice(0, 10);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => form && setForm({ ...form, [k]: v });

  return (
    <>
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>
              <Icon name="qr" size={20} /> คูปองรอรับที่ร้าน
            </h2>
            <p>ลูกค้าเปิดบัตรสมาชิกแล้วโชว์โค้ด 6 ตัว · ตรวจโค้ดให้ตรง แล้วกด "ให้ของแล้ว"</p>
          </div>
          <input
            className="text coupon-find"
            placeholder="ค้นหาโค้ด / ชื่อลูกค้า"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            aria-label="ค้นหาคูปอง"
          />
        </header>
        {err && <p className="err">{err}</p>}
        {waiting.length === 0 ? (
          <p className="empty">{q ? "ไม่พบคูปองที่ตรงกับคำค้น" : "ยังไม่มีคูปองรอรับ"}</p>
        ) : (
          <ul className="mlist">
            {waiting.map((c) => (
              <li key={c.id}>
                <span className="code-chip">{c.code}</span>
                <div className="mlist-info">
                  <b>{c.rewardName}</b>
                  <small>
                    {c.customerName || "ลูกค้า"} · แลกเมื่อ {when(c.createdAt)} · {c.points} แต้ม
                  </small>
                </div>
                <button className="btn primary-sm" disabled={busy} onClick={() => give(c)}>
                  ให้ของแล้ว
                </button>
                <button className={`btn ${confirm === `c${c.id}` ? "danger-sm" : "ghost-sm"}`} disabled={busy} onClick={() => cancel(c)}>
                  {confirm === `c${c.id}` ? "ยืนยัน คืนแต้ม" : "ยกเลิก"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {given.length > 0 && (
          <details className="given-log">
            <summary>ให้ของไปแล้วล่าสุด ({given.length})</summary>
            <ul>
              {given.map((c) => (
                <li key={c.id}>
                  <code>{c.code}</code> {c.rewardName} · {c.customerName || "ลูกค้า"} · {c.givenAt ? when(c.givenAt) : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>
              <Icon name="gift" size={20} /> ของขวัญแลกแต้ม
            </h2>
            <p>แสดงในหน้าบัตรสมาชิกของลูกค้า · 1 แต้มได้จากการซื้อ ฿25 (แต้มแทนเงินสดได้ 1 แต้ม = ฿1)</p>
          </div>
          <button className="btn primary-sm" onClick={() => setForm(EMPTY)}>
            + เพิ่มของขวัญ
          </button>
        </header>
        {rewards.length === 0 && <p className="empty">ยังไม่มีของขวัญ</p>}
        <ul className="mlist">
          {rewards.map((r) => (
            <li key={r.id}>
              <span className={`code-chip${r.active ? "" : " off"}`}>{r.points} แต้ม</span>
              <div className="mlist-info">
                <b>{r.name}</b>
                <small>
                  {r.description || "—"} · {r.stock === null ? "ไม่จำกัดจำนวน" : `เหลือ ${r.stock} สิทธิ์`}
                </small>
              </div>
              <button className="toggle" role="switch" aria-checked={r.active} onClick={() => toggle(r)}>
                <span className="knob" aria-hidden="true" />
                {r.active ? "แลกได้" : "ปิด"}
              </button>
              <button
                className="btn ghost-sm"
                onClick={() =>
                  setForm({
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    points: String(r.points),
                    stock: r.stock === null ? "" : String(r.stock),
                    menuItemId: r.menuItemId ?? "",
                  })
                }
              >
                แก้ไข
              </button>
              <button className={`btn ${confirm === `r${r.id}` ? "danger-sm" : "ghost-sm"}`} onClick={() => remove(r)}>
                {confirm === `r${r.id}` ? "ยืนยันลบ" : "ลบ"}
              </button>
            </li>
          ))}
        </ul>

        {form && (
          <div className="promo-form">
            <div className="hours">
              <label>
                ชื่อของขวัญ
                <input className="text" value={form.name} placeholder="เช่น มัทฉะลาเต้ฟรี 1 แก้ว" onChange={(e) => set("name", e.target.value)} />
              </label>
              <label>
                ใช้กี่แต้ม
                <input className="text" inputMode="numeric" value={form.points} onChange={(e) => set("points", digits(e.target.value))} />
              </label>
              <label>
                จำนวนสิทธิ์ (เว้นว่าง = ไม่จำกัด)
                <input className="text" inputMode="numeric" value={form.stock} onChange={(e) => set("stock", digits(e.target.value))} />
              </label>
              <label>
                รูปการ์ตูน
                <select className="text" value={form.menuItemId} onChange={(e) => set("menuItemId", e.target.value)}>
                  <option value="">กล่องของขวัญ</option>
                  {menu.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="promo-note">
              รายละเอียด (แสดงให้ลูกค้า)
              <input className="text" value={form.description} placeholder="เช่น แก้วปกติ เลือกเย็นหรือร้อนได้" onChange={(e) => set("description", e.target.value)} />
            </label>
            <div className="panel-row">
              <button className="btn primary-sm" disabled={!form.name.trim() || !form.points || busy} onClick={save}>
                {form.id ? "บันทึกการแก้ไข" : "เพิ่มของขวัญ"}
              </button>
              <button className="btn ghost-sm" onClick={() => setForm(null)}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
