"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { BAR_KINDS, barQrText, type BarItem, type BarKind } from "@/lib/bar";
import BarArt from "../../bar/BarArt";
import { uploadImage } from "../upload";

type Draft = { id?: string; name: string; kind: BarKind; price: string; sort: string; available: boolean; imageUrl: string | null };
const blank: Draft = { name: "", kind: "noodle", price: "", sort: "0", available: true, imageUrl: null };
const toDraft = (i: BarItem): Draft => ({ id: i.id, name: i.name, kind: i.kind, price: String(i.price), sort: String(i.sort), available: i.available, imageUrl: i.imageUrl });

export default function BarAdmin() {
  const [items, setItems] = useState<BarItem[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(location.origin), []);

  async function call(method: string, body?: unknown, query = "") {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/admin/bar${query}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) return location.reload();
      if (!r.ok) throw new Error(j.error ?? "บันทึกไม่สำเร็จ");
      setItems(j.items);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      return false;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    call("GET");
  }, []);

  useEffect(() => {
    Promise.all(items.map(async (i) => [i.id, await QRCode.toDataURL(barQrText(i.id), { margin: 1, width: 360, errorCorrectionLevel: "M" })] as const)).then((pairs) =>
      setQrs(Object.fromEntries(pairs)),
    );
  }, [items]);

  async function save() {
    if (!draft) return;
    const ok = await call("POST", { ...draft, price: Number(draft.price), sort: Number(draft.sort) || 0 });
    if (ok) setDraft(null);
  }

  async function photo(file?: File) {
    if (!file || !draft) return;
    setBusy(true);
    try {
      const url = await uploadImage(file);
      setDraft((d) => d && { ...d, imageUrl: url });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  const liffLink = liffId ? `https://liff.line.me/${liffId}/bar` : `${origin}/bar`;
  const stickers = items.flatMap((i) => Array.from({ length: copies[i.id] ?? 0 }, () => i));

  return (
    <main className="nba">
      <header className="nba-head nba-noprint">
        <a href="/admin" className="nba-back">
          ← กลับหลังร้าน
        </a>
        <h1>มาม่าบาร์</h1>
        <p>
          ยังไม่เปิดให้ลูกค้า: ไม่มีปุ่มไหนลิงก์มาที่นี่ เปิดทดสอบได้จากลิงก์ลับด้านล่างเท่านั้น
        </p>
        <div className="nba-link">
          <code>{liffLink}</code>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(liffLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
          </button>
        </div>
      </header>

      <section className="nba-card nba-noprint">
        <div className="nba-row-head">
          <h2>ของในบาร์</h2>
          <button className="nba-primary" onClick={() => setDraft({ ...blank })} disabled={busy}>
            + เพิ่มรายการ
          </button>
        </div>
        {err && <p className="nba-err" role="alert">{err}</p>}
        <table className="nba-table">
          <thead>
            <tr>
              <th />
              <th>ชื่อ</th>
              <th>ประเภท</th>
              <th>ราคา</th>
              <th>ขาย</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className={i.available ? "" : "off"}>
                <td>
                  {i.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.imageUrl} alt="" width={36} height={36} />
                  ) : (
                    <BarArt kind={i.kind} size={36} />
                  )}
                </td>
                <td>{i.name}</td>
                <td>{BAR_KINDS.find((k) => k.id === i.kind)?.label}</td>
                <td>฿{i.price}</td>
                <td>
                  <button className={`nba-switch${i.available ? " on" : ""}`} aria-pressed={i.available} disabled={busy} onClick={() => call("POST", { ...i, available: !i.available })}>
                    {i.available ? "มีขาย" : "หมด"}
                  </button>
                </td>
                <td>
                  <button className="nba-ghost" onClick={() => setDraft(toDraft(i))}>
                    แก้ไข
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="nba-card nba-noprint">
        <h2>พิมพ์สติ๊กเกอร์ QR</h2>
        <p className="nba-muted">ติดสติ๊กเกอร์ 1 ดวงต่อ 1 ชิ้น (ซอง/ถ้วย) ใส่จำนวนที่ต้องการ แล้วกดพิมพ์ (A4 · ดวงละ 3.5 ซม.)</p>
        <div className="nba-copies">
          {items.map((i) => (
            <label key={i.id}>
              <span>{i.name}</span>
              <input
                type="number"
                min={0}
                max={200}
                inputMode="numeric"
                value={copies[i.id] ?? 0}
                onChange={(e) => setCopies((c) => ({ ...c, [i.id]: Math.max(0, Math.min(200, Number(e.target.value) || 0)) }))}
              />
            </label>
          ))}
        </div>
        <div className="nba-acts">
          <button className="nba-ghost" onClick={() => setCopies(Object.fromEntries(items.map((i) => [i.id, 10])))}>
            ทุกอย่าง 10 ดวง
          </button>
          <button className="nba-primary" disabled={!stickers.length} onClick={() => window.print()}>
            พิมพ์ {stickers.length} ดวง
          </button>
        </div>
      </section>

      {stickers.length > 0 && (
        <div className="nbs-sheet" aria-label="ตัวอย่างสติ๊กเกอร์">
          {stickers.map((i, k) => (
            <div className="nbs" key={k}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qrs[i.id] && <img src={qrs[i.id]} alt={`QR ${i.name}`} />}
              <b>{i.name.replace(/^ท็อปปิ้ง\s*/, "")}</b>
              <small>CODE-MATCHA · มาม่าบาร์</small>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="nba-modal nba-noprint" role="dialog" aria-modal="true" aria-label={draft.id ? "แก้ไขรายการ" : "เพิ่มรายการ"}>
          <div className="nba-form">
            <h2>{draft.id ? "แก้ไขรายการ" : "เพิ่มรายการ"}</h2>
            <label>
              ชื่อ
              <input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="เช่น มาม่ารสต้มยำกุ้ง" />
            </label>
            <label>
              ประเภท
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as BarKind })}>
                {BAR_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="nba-2">
              <label>
                ราคา (บาท)
                <input type="number" inputMode="numeric" min={0} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
              </label>
              <label>
                ลำดับ
                <input type="number" inputMode="numeric" value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value })} />
              </label>
            </div>
            <label className="nba-check">
              <input type="checkbox" checked={draft.available} onChange={(e) => setDraft({ ...draft, available: e.target.checked })} />
              มีขาย
            </label>
            <div className="nba-photo">
              {draft.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.imageUrl} alt="" width={56} height={56} />
              ) : (
                <BarArt kind={draft.kind} size={56} />
              )}
              <label className="nba-ghost">
                {draft.imageUrl ? "เปลี่ยนรูป" : "ใส่รูป"}
                <input type="file" accept="image/*" hidden onChange={(e) => photo(e.target.files?.[0])} />
              </label>
              {draft.imageUrl && (
                <button className="nba-ghost" onClick={() => setDraft({ ...draft, imageUrl: null })}>
                  ลบรูป
                </button>
              )}
            </div>
            {draft.id && <p className="nba-muted">ถ้าลบรายการนี้ สติ๊กเกอร์ QR ที่พิมพ์ไปแล้วจะใช้ไม่ได้ (ถ้าแค่ของหมด ให้กด &quot;หมด&quot; แทน)</p>}
            {err && <p className="nba-err" role="alert">{err}</p>}
            <div className="nba-acts">
              {draft.id && (
                <button
                  className="nba-danger"
                  disabled={busy}
                  onClick={async () => {
                    if (confirm(`ลบ "${draft.name}" ?`) && (await call("DELETE", undefined, `?id=${encodeURIComponent(draft.id!)}`))) setDraft(null);
                  }}
                >
                  ลบ
                </button>
              )}
              <button className="nba-ghost" onClick={() => setDraft(null)}>
                ยกเลิก
              </button>
              <button className="nba-primary" disabled={busy || !draft.name.trim() || draft.price === ""} onClick={save}>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
