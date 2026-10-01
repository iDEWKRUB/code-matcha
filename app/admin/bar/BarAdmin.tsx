"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { BAR_KINDS, barQrText, type BarItem, type BarKind } from "@/lib/bar";
import BarArt from "../../bar/BarArt";
import Icon, { type IconName } from "../../Icon";
import BarBills from "./BarBills";
import BarHoursPanel from "./BarHoursPanel";
import LogoMark from "./LogoMark";
import { SHOP } from "@/lib/config";

// สติ๊กเกอร์อวยพร: QR (แก้ผิดได้สูง) + ตรา 暗号 กลาง QR + "สแกนรับคำอวยพร"
function WishLabel({ qr }: { qr: string }) {
  return (
    <span className="wl">
      <span className="wl-qr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="QR คำอวยพร" />}
        <span className="wl-seal" aria-hidden="true">
          暗<br />号
        </span>
      </span>
      <b>สแกนรับคำอวยพร</b>
    </span>
  );
}
import BarStock from "./BarStock";
import { uploadImage } from "../upload";

type Draft = {
  id?: string;
  name: string;
  kind: BarKind;
  price: string;
  sort: string;
  available: boolean;
  imageUrl: string | null;
};
const blank: Draft = {
  name: "",
  kind: "noodle",
  price: "",
  sort: "0",
  available: true,
  imageUrl: null,
};
const toDraft = (i: BarItem): Draft => ({
  id: i.id,
  name: i.name,
  kind: i.kind,
  price: String(i.price),
  sort: String(i.sort),
  available: i.available,
  imageUrl: i.imageUrl,
});

type Section = "sell" | "bills" | "stock" | "items" | "qr";
const SECTIONS: { id: Section; icon: IconName; label: string; hint: string }[] = [
  {
    id: "sell",
    icon: "store",
    label: "เปิดขาย & เวลา",
    hint: "สวิตช์เปิดขาย · เวลาเปิด · ลิงก์",
  },
  {
    id: "bills",
    icon: "note",
    label: "บิล",
    hint: "บิลรายวัน · เรียกเก็บเพิ่ม",
  },
  {
    id: "stock",
    icon: "bag",
    label: "สต๊อก",
    hint: "รับของเข้า · นับจริง · ตามของหาย",
  },
  {
    id: "items",
    icon: "bowl",
    label: "ของในบาร์",
    hint: "เพิ่ม/แก้ราคา · มีขาย/หมด",
  },
  { id: "qr", icon: "qr", label: "สติ๊กเกอร์ QR", hint: "พิมพ์ติดซอง/ถ้วย" },
];

// embedded = อยู่ในแท็บ "มาม่าบาร์" ของหน้าหลังร้าน (ไม่ต้องมีปุ่มกลับ/หัวเรื่องซ้ำ)
export default function BarAdmin({ embedded = false }: { embedded?: boolean }) {
  // หมวดย่อย (จำหมวดล่าสุดไว้ในเครื่องนี้) · หมวดสต๊อกขอเปิดบิล → สลับมาหมวดบิลแล้วเปิดให้
  const [sec, setSec] = useState<Section>("sell");
  const [openReq, setOpenReq] = useState<{
    id: number;
    date: string;
    at: number;
  } | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("adm-bar-sec") as Section | null;
      if (saved && SECTIONS.some((s) => s.id === saved)) setSec(saved);
    } catch {}
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<{ id: number; date: string }>).detail;
      setOpenReq({ ...d, at: Date.now() });
      setSec("bills");
      window.scrollTo(0, 0);
    };
    window.addEventListener("bar:open-bill", onOpen);
    return () => window.removeEventListener("bar:open-bill", onOpen);
  }, []);
  function pick(s: Section) {
    setSec(s);
    setOpenReq(null);
    try {
      localStorage.setItem("adm-bar-sec", s);
    } catch {}
  }

  const [items, setItems] = useState<BarItem[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [logoCopies, setLogoCopies] = useState(0);
  // สติ๊กเกอร์อวยพร: QR มีตรา 暗号 ตรงกลาง → หน้า /gift (การ์ตูนน้องมัทฉะ + คำอวยพร)
  const [wishCopies, setWishCopies] = useState(0);
  const [wishQr, setWishQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(`${SHOP.siteUrl}/gift`, { margin: 1, width: 480, errorCorrectionLevel: "H" }).then(setWishQr);
  }, []);
  const [logoStyle, setLogoStyle] = useState<"solid" | "line">("solid");
  // ทิศโลโก้ในดวง 32×25: h = แนวนอน · v = แนวตั้ง (หมุนซ้าย) · v2 = แนวตั้ง (หมุนขวา)
  const [logoDir, setLogoDir] = useState<"h" | "v" | "v2">("h");
  // รูปแบบกระดาษ: a4 = แผ่น A4 · roll = ม้วน Sbarco 3 ดวงต่อแถว 32×25 มม. (จำไว้ในเครื่องนี้)
  const [layout, setLayout] = useState<"a4" | "roll">("a4");
  // ปรับตำแหน่งให้ตรงดวงบนม้วน (มม.): เลื่อนซ้าย/ขวา · ขึ้น/ลง · ระยะห่างระหว่างดวง
  const [tune, setTune] = useState({ x: 0, y: 0, gap: 3 });
  useEffect(() => {
    try {
      if (localStorage.getItem("adm-sticker-layout") === "roll") setLayout("roll");
      const saved = JSON.parse(localStorage.getItem("adm-sticker-tune") ?? "null");
      if (saved) setTune({ x: Number(saved.x) || 0, y: Number(saved.y) || 0, gap: Number.isFinite(saved.gap) ? saved.gap : 3 });
    } catch {}
  }, []);
  function changeTune(k: "x" | "y" | "gap", v: string) {
    const n = Math.max(k === "gap" ? 0 : -8, Math.min(8, Number(v) || 0));
    const next = { ...tune, [k]: n };
    setTune(next);
    try {
      localStorage.setItem("adm-sticker-tune", JSON.stringify(next));
    } catch {}
  }
  function pickLayout(l: "a4" | "roll") {
    setLayout(l);
    try {
      localStorage.setItem("adm-sticker-layout", l);
    } catch {}
  }
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
    Promise.all(
      items.map(
        async (i) =>
          [
            i.id,
            await QRCode.toDataURL(barQrText(i.id), {
              margin: 1,
              width: 360,
              errorCorrectionLevel: "M",
            }),
          ] as const,
      ),
    ).then((pairs) => setQrs(Object.fromEntries(pairs)));
  }, [items]);

  async function save() {
    if (!draft) return;
    const ok = await call("POST", {
      ...draft,
      price: Number(draft.price),
      sort: Number(draft.sort) || 0,
    });
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
  // null = สติ๊กเกอร์โลโก้ร้าน (หมึกดำ) พิมพ์ต่อท้ายในม้วน/แผ่นเดียวกัน
  const stickers: (BarItem | null | "wish")[] = [
    ...Array.from({ length: wishCopies }, () => "wish" as const),
    ...items.flatMap((i) => Array.from({ length: copies[i.id] ?? 0 }, () => i)),
    ...Array.from({ length: logoCopies }, () => null),
  ];

  return (
    <div className={embedded ? "nba nba-embed" : "nba"}>
      {!embedded && (
        <header className="nba-head nba-noprint">
          <a href="/admin" className="nba-back">
            ← กลับหลังร้าน
          </a>
          <h1>มาม่าบาร์</h1>
        </header>
      )}

      <nav className="sec-nav nba-noprint" aria-label="หมวดมาม่าบาร์">
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

      {sec === "sell" && (
        <>
          <BarHoursPanel />
          <section className="nba-card nba-noprint">
            <h2>ลิงก์หน้ามาม่าบาร์</h2>
            <p className="nba-muted">ใช้ทดสอบ หรือทำ QR ติดหน้าบาร์ให้ลูกค้าสแกนเข้า</p>
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
          </section>
        </>
      )}

      {sec === "bills" && <BarBills key={openReq ? `${openReq.id}-${openReq.at}` : "bills"} items={items} initialOpen={openReq} />}

      {sec === "stock" && <BarStock />}

      {sec === "items" && (
        <section className="nba-card nba-noprint">
          <div className="nba-row-head">
            <h2>ของในบาร์</h2>
            <button className="nba-primary" onClick={() => setDraft({ ...blank })} disabled={busy}>
              + เพิ่มรายการ
            </button>
          </div>
          {err && (
            <p className="nba-err" role="alert">
              {err}
            </p>
          )}
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
                    <button
                      className={`nba-switch${i.available ? " on" : ""}`}
                      aria-pressed={i.available}
                      disabled={busy}
                      onClick={() => call("POST", { ...i, available: !i.available })}
                    >
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
      )}

      {sec === "qr" && (
        <>
          <section className="nba-card nba-noprint">
            <h2>พิมพ์สติ๊กเกอร์ QR</h2>
            <p className="nba-muted">ติดสติ๊กเกอร์ 1 ดวงต่อ 1 ชิ้น (ซอง/ถ้วย) ใส่จำนวนที่ต้องการ แล้วกดพิมพ์</p>
            <div className="nba-layout" role="group" aria-label="กระดาษที่ใช้พิมพ์">
              <button aria-pressed={layout === "a4"} onClick={() => pickLayout("a4")}>
                แผ่น A4 · ดวงละ 3.6 ซม.
              </button>
              <button aria-pressed={layout === "roll"} onClick={() => pickLayout("roll")}>
                ม้วน Sbarco · 3 ดวง/แถว · 32×25 มม.
              </button>
            </div>
            {layout === "roll" && (
              <p className="nba-muted">
                ตอนสั่งพิมพ์: เลือกเครื่อง Sbarco · ขนาดกระดาษ 102 × 25 มม. · ขอบ (Margins) = ไม่มี · สเกล 100% · ไม่ต้องพิมพ์หัว/ท้ายกระดาษ
              </p>
            )}
            {layout === "roll" && (
              <div className="nba-tune">
                <label>
                  เลื่อนซ้าย(−) / ขวา(+) มม.
                  <input type="number" step={0.5} value={tune.x} onChange={(e) => changeTune("x", e.target.value)} />
                </label>
                <label>
                  เลื่อนขึ้น(−) / ลง(+) มม.
                  <input type="number" step={0.5} value={tune.y} onChange={(e) => changeTune("y", e.target.value)} />
                </label>
                <label>
                  ระยะห่างระหว่างดวง มม.
                  <input type="number" step={0.5} min={0} value={tune.gap} onChange={(e) => changeTune("gap", e.target.value)} />
                </label>
              </div>
            )}
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
                    onChange={(e) =>
                      setCopies((c) => ({
                        ...c,
                        [i.id]: Math.max(0, Math.min(200, Number(e.target.value) || 0)),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="nba-logo">
              <span className="nba-logo-prev">
                <span className={`nba-logo-in ${logoDir}`}>
                  <LogoMark variant={logoStyle} vertical={logoDir !== "h"} />
                </span>
              </span>
              <div>
                <b>สติ๊กเกอร์โลโก้ร้าน (หมึกดำ)</b>
                <div className="nba-layout" role="group" aria-label="แบบโลโก้">
                  <button aria-pressed={logoStyle === "solid"} onClick={() => setLogoStyle("solid")}>
                    ตราดำทึบ
                  </button>
                  <button aria-pressed={logoStyle === "line"} onClick={() => setLogoStyle("line")}>
                    ตราเส้น (ประหยัดหมึก)
                  </button>
                </div>
                <div className="nba-layout" role="group" aria-label="ทิศโลโก้">
                  <button aria-pressed={logoDir === "h"} onClick={() => setLogoDir("h")}>
                    แนวนอน
                  </button>
                  <button aria-pressed={logoDir === "v"} onClick={() => setLogoDir("v")}>
                    แนวตั้ง ↺
                  </button>
                  <button aria-pressed={logoDir === "v2"} onClick={() => setLogoDir("v2")}>
                    แนวตั้ง ↻
                  </button>
                </div>
                <label className="nba-logo-n">
                  จำนวน
                  <input
                    type="number"
                    min={0}
                    max={300}
                    inputMode="numeric"
                    value={logoCopies}
                    onChange={(e) => setLogoCopies(Math.max(0, Math.min(300, Number(e.target.value) || 0)))}
                  />
                </label>
              </div>
            </div>
            <div className="nba-logo">
              <span className="nba-logo-prev">
                <WishLabel qr={wishQr} />
              </span>
              <div>
                <b>สติ๊กเกอร์อวยพร (ติดแก้ว)</b>
                <span className="nba-muted">
                  ลูกค้าสแกนแล้วเปิดหน้า &quot;มีของขวัญในแก้วของคุณ&quot; แตะกล่อง 3 ครั้ง น้องมัทฉะเด้งออกมาพร้อมคำอวยพร ·{" "}
                  <a href="/gift" target="_blank" rel="noreferrer">
                    ลองเปิดดู
                  </a>
                </span>
                <label className="nba-logo-n">
                  จำนวน
                  <input
                    type="number"
                    min={0}
                    max={300}
                    inputMode="numeric"
                    value={wishCopies}
                    onChange={(e) => setWishCopies(Math.max(0, Math.min(300, Number(e.target.value) || 0)))}
                  />
                </label>
              </div>
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

          {stickers.length > 0 && layout === "roll" && (
            <div
              className="nbs-roll"
              aria-label="ตัวอย่างสติ๊กเกอร์ม้วน"
              style={{ "--lx": `${tune.x}mm`, "--ly": `${tune.y}mm`, "--gx": `${tune.gap}mm` } as React.CSSProperties}
            >
              {Array.from({ length: Math.ceil(stickers.length / 3) }, (_, r) => (
                <div className="nbs-row" key={r}>
                  {[0, 1, 2].map((c) => {
                    const i = stickers[r * 3 + c];
                    if (i === "wish")
                      return (
                        <div className="nbs-lb wish" key={c}>
                          <WishLabel qr={wishQr} />
                        </div>
                      );
                    if (i === null)
                      return (
                        <div className={`nbs-lb logo ${logoDir}`} key={c}>
                          <LogoMark variant={logoStyle} vertical={logoDir !== "h"} />
                        </div>
                      );
                    return i ? (
                      <div className="nbs-lb" key={c}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {qrs[i.id] && <img src={qrs[i.id]} alt={`QR ${i.name}`} />}
                        <b>{i.name.replace(/^ท็อปปิ้ง\s*/, "")}</b>
                        <small>CODE-MATCHA · มาม่าบาร์</small>
                      </div>
                    ) : (
                      <div className="nbs-lb empty" key={c} />
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {stickers.length > 0 && layout === "a4" && (
            <div className="nbs-sheet" aria-label="ตัวอย่างสติ๊กเกอร์">
              {stickers.map((i, k) =>
                i === "wish" ? (
                  <div className="nbs wish" key={k}>
                    <WishLabel qr={wishQr} />
                  </div>
                ) : i === null ? (
                  <div className="nbs logo" key={k}>
                    <LogoMark variant={logoStyle} vertical={logoDir !== "h"} />
                  </div>
                ) : (
                <div className="nbs" key={k}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {qrs[i.id] && <img src={qrs[i.id]} alt={`QR ${i.name}`} />}
                  <b>{i.name.replace(/^ท็อปปิ้ง\s*/, "")}</b>
                  <small>CODE-MATCHA · มาม่าบาร์</small>
                </div>
                ),
              )}
            </div>
          )}
        </>
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
            {err && (
              <p className="nba-err" role="alert">
                {err}
              </p>
            )}
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
    </div>
  );
}
