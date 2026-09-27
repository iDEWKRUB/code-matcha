"use client";

import { useEffect, useState } from "react";
import type { MenuItem } from "@/lib/menu";
import type { Coupon, Reward } from "@/lib/member";
import Icon from "../Icon";
import MenuArt, { artTint } from "../MenuArt";
import MerchArt, { MERCH_TINT } from "../MerchArt";
import { MERCH_LOOKS, REWARD_CATEGORIES, type RewardCategory } from "@/lib/rewards";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type Form = {
  id: number | null;
  name: string;
  description: string;
  points: string;
  stock: string;
  category: RewardCategory;
  menuItemId: string;
  look: string;
  imageUrl: string;
};
const EMPTY: Form = {
  id: null,
  name: "",
  description: "",
  points: "",
  stock: "",
  category: "menu",
  menuItemId: "",
  look: "gift",
  imageUrl: "",
};
const toForm = (r: Reward): Form => ({
  id: r.id,
  name: r.name,
  description: r.description,
  points: String(r.points),
  stock: r.stock === null ? "" : String(r.stock),
  category: r.category,
  menuItemId: r.menuItemId ?? "",
  look: r.look ?? "gift",
  imageUrl: r.imageUrl ?? "",
});
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
  const [uploading, setUploading] = useState(false);

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
        category: form.category,
        menuItemId: form.menuItemId,
        look: form.look,
        imageUrl: form.imageUrl,
      }),
    );
    if (ok) setForm(null);
  }

  // ย่อรูปถ่ายของพรีเมียมให้ด้านยาวไม่เกิน 800px เป็น JPG แล้วอัปโหลด (bucket promo สาธารณะ)
  async function uploadPhoto(file: File | undefined) {
    if (!file || !form) return;
    setUploading(true);
    setErr("");
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.85));
      const fd = new FormData();
      fd.append("image", blob, "reward.jpg");
      const r = await fetch("/api/admin/promo-image", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "อัปโหลดไม่สำเร็จ");
      setForm((x) => (x ? { ...x, imageUrl: j.url } : x));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  const q = find.trim().toUpperCase();
  const waiting = coupons.filter(
    (c) => c.status === "waiting" && (!q || c.code.includes(q) || (c.customerName ?? "").toUpperCase().includes(q)),
  );
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
        {err && !form && <p className="err">{err}</p>}
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
            <p>แสดงในหน้าบัตรสมาชิกของลูกค้า แยก 2 หมวด · 1 แต้มได้จากการซื้อ ฿25 (แต้มแทนเงินสดได้ 1 แต้ม = ฿1)</p>
          </div>
          <button className="btn primary-sm" onClick={() => setForm(EMPTY)}>
            + เพิ่มของขวัญ
          </button>
        </header>

        {form && (
          <div className="promo-form reward-form">
            <div className="reward-kind" role="group" aria-label="หมวดของขวัญ">
              {REWARD_CATEGORIES.map((c) => (
                <button key={c.id} aria-pressed={form.category === c.id} onClick={() => set("category", c.id)}>
                  <b>{c.label}</b>
                  <small>{c.hint}</small>
                </button>
              ))}
            </div>
            <div className="reward-form-body">
              <div className="reward-preview">
                <Thumb reward={{ ...form, imageUrl: form.imageUrl || null, menuItemId: form.menuItemId || null }} menu={menu} size={90} />
                <small>ตัวอย่างรูป</small>
              </div>
              <div className="hours">
                <label>
                  ชื่อของขวัญ
                  <input
                    className="text"
                    value={form.name}
                    placeholder={form.category === "merch" ? "เช่น พวงกุญแจน้องมัทฉะ" : "เช่น มัทฉะลาเต้ฟรี 1 แก้ว"}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </label>
                <label>
                  ใช้กี่แต้ม
                  <input className="text" inputMode="numeric" value={form.points} onChange={(e) => set("points", digits(e.target.value))} />
                </label>
                <label>
                  จำนวนสิทธิ์ (เว้นว่าง = ไม่จำกัด)
                  <input className="text" inputMode="numeric" value={form.stock} onChange={(e) => set("stock", digits(e.target.value))} />
                </label>
                {form.category === "menu" ? (
                  <label>
                    รูปการ์ตูนจากเมนู
                    <select className="text" value={form.menuItemId} onChange={(e) => set("menuItemId", e.target.value)}>
                      <option value="">กล่องของขวัญ</option>
                      {menu.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    รูปการ์ตูน (ใช้เมื่อไม่มีรูปถ่าย)
                    <select className="text" value={form.look} onChange={(e) => set("look", e.target.value)}>
                      {MERCH_LOOKS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
            {form.category === "merch" && (
              <div className="panel-row reward-photo">
                <label className="btn ghost-sm upload">
                  {uploading ? "กำลังอัปโหลด…" : form.imageUrl ? "เปลี่ยนรูปถ่าย" : "อัปโหลดรูปถ่ายสินค้า"}
                  <input type="file" accept="image/*" hidden disabled={uploading} onChange={(e) => uploadPhoto(e.target.files?.[0])} />
                </label>
                {form.imageUrl && (
                  <button className="btn ghost-sm" onClick={() => set("imageUrl", "")}>
                    ใช้รูปการ์ตูนแทน
                  </button>
                )}
                <small>รูปจริงจะแสดงแทนการ์ตูน · แนะนำรูปสี่เหลี่ยมจัตุรัส พื้นหลังเรียบ</small>
              </div>
            )}
            <label className="promo-note">
              รายละเอียด (แสดงให้ลูกค้า)
              <input
                className="text"
                value={form.description}
                placeholder={form.category === "merch" ? "เช่น อะคริลิกลายน้องมัทฉะ ขนาด 5 ซม." : "เช่น แก้วปกติ เลือกเย็นหรือร้อนได้"}
                onChange={(e) => set("description", e.target.value)}
              />
            </label>
            {err && <p className="err">{err}</p>}
            <div className="panel-row">
              <button className="btn primary-sm" disabled={!form.name.trim() || !form.points || busy || uploading} onClick={save}>
                {form.id ? "บันทึกการแก้ไข" : "เพิ่มของขวัญ"}
              </button>
              <button className="btn ghost-sm" onClick={() => setForm(null)}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {rewards.length === 0 && <p className="empty">ยังไม่มีของขวัญ</p>}
        {REWARD_CATEGORIES.map((c) => {
          const list = rewards.filter((r) => r.category === c.id);
          if (!list.length) return null;
          return (
            <div key={c.id} className="reward-group">
              <h3>
                {c.label} <small>{list.length} รายการ</small>
              </h3>
              <ul className="mlist">
                {list.map((r) => (
                  <li key={r.id} className={r.active ? undefined : "off"}>
                    <Thumb reward={r} menu={menu} size={34} />
                    <div className="mlist-info">
                      <b>{r.name}</b>
                      <small>
                        <strong>{r.points} แต้ม</strong> · {r.stock === null ? "ไม่จำกัดจำนวน" : `เหลือ ${r.stock} สิทธิ์`}
                        {r.description ? ` · ${r.description}` : ""}
                      </small>
                    </div>
                    <button className="toggle" role="switch" aria-checked={r.active} onClick={() => toggle(r)}>
                      <span className="knob" aria-hidden="true" />
                      {r.active ? "แลกได้" : "ปิด"}
                    </button>
                    <button className="btn ghost-sm" onClick={() => setForm(toForm(r))}>
                      แก้ไข
                    </button>
                    <button className={`btn ${confirm === `r${r.id}` ? "danger-sm" : "ghost-sm"}`} onClick={() => remove(r)}>
                      {confirm === `r${r.id}` ? "ยืนยันลบ" : "ลบ"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </>
  );
}

// รูปย่อของของขวัญ (เหมือนที่ลูกค้าเห็น)
function Thumb({
  reward,
  menu,
  size,
}: {
  reward: Pick<Reward, "category" | "menuItemId" | "look" | "imageUrl">;
  menu: MenuItem[];
  size: number;
}) {
  const box = { width: size * 1.35, height: size * 1.35 };
  if (reward.category === "merch" && reward.imageUrl)
    return (
      <span className="reward-thumb" style={box}>
        <img src={reward.imageUrl} alt="" />
      </span>
    );
  const item = reward.category === "menu" ? menu.find((m) => m.id === reward.menuItemId) : undefined;
  const look = reward.category === "merch" ? (reward.look ?? "gift") : "gift";
  return (
    <span className="reward-thumb" style={{ ...box, background: item ? artTint(item) : (MERCH_TINT[look] ?? MERCH_TINT.gift) }}>
      {item ? <MenuArt item={item} size={size} /> : <MerchArt look={look} size={size} />}
    </span>
  );
}
