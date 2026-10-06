"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BAR_MAX_QTY, barCode, barIdFromQr, type BarItem } from "@/lib/bar";
import BarFilter, { useBarFilter } from "../../bar/BarFilter";
import {
  MAX_QTY,
  MILKS,
  SHOT_PRICE,
  SOFT_CREAM_PRICE,
  SWEET,
  TEMP_LABEL,
  defaultChoices,
  freeToppings,
  hasPowder,
  lineDetail,
  linePrice,
  optionGroups,
  powderExtra,
  type CartLine,
  type MenuItem,
  type Powder,
  menuGroup,
  type MenuGroup,
} from "@/lib/menu";
import type { PosBill } from "@/lib/pos";
import BarArt from "../../bar/BarArt";
import type { TrayScan } from "../../bar/scan";
import MenuArt, { artTint } from "../../MenuArt";
import Seal from "../../Seal";

type Data = { menu: MenuItem[]; powders: Powder[]; barItems: BarItem[]; bills: PosBill[]; recent: PosBill[] };
type Mode = "menu" | "bar";
type Cat = "all" | MenuGroup;
type Pay = { billId: number; subtotal: number; method: "qr" | "cash"; cash: string; code: string; discount: number; promoErr: string; qr: string; big: boolean };

const baht = (n: number) => `฿${n.toLocaleString()}`;
const minutesAgo = (s: string) => Math.max(0, Math.round((Date.now() - new Date(s).getTime()) / 60000));
const billName = (b: Pick<PosBill, "id" | "label">) => b.label || `บิล #${b.id}`;
const STATUS: Record<string, string> = { pending: "รอทำ", preparing: "กำลังทำ", ready: "พร้อมเสิร์ฟ", completed: "เสร็จ", cancelled: "ยกเลิก" };

async function api<T>(body: unknown): Promise<T> {
  const r = await fetch("/api/admin/pos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (r.status === 401) location.reload();
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "ทำรายการไม่สำเร็จ");
  return j as T;
}

// หน้าร้าน: ลูกค้าไม่สั่งผ่าน LINE · พนักงานเลือกเมนู ส่งเข้าคิว เช็คบิล (QR/เงินสด) และพิมพ์ใบเสร็จ
export default function Pos() {
  const [data, setData] = useState<Data | null>(null);
  const [mode, setMode] = useState<Mode>("menu");
  const [cat, setCat] = useState<Cat>("all");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<{ item: MenuItem; line: CartLine } | null>(null);
  const [draft, setDraft] = useState<CartLine[]>([]);
  const [barDraft, setBarDraft] = useState<Record<string, number>>({});
  const [detected, setDetected] = useState<Record<string, number>>({});
  const [shot, setShot] = useState<TrayScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [billId, setBillId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pay, setPay] = useState<Pay | null>(null);
  const [paid, setPaid] = useState<PosBill | null>(null);
  const [history, setHistory] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/pos", { cache: "no-store" });
    if (r.status === 401) return location.reload();
    if (r.ok) setData(await r.json());
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // สถานะเครื่องดื่มในบิล (รอทำ/กำลังทำ/พร้อม)
    return () => clearInterval(t);
  }, [load]);

  const menuById = useMemo(() => new Map((data?.menu ?? []).map((m) => [m.id, m])), [data]);
  const barById = useMemo(() => new Map((data?.barItems ?? []).map((i) => [i.id, i])), [data]);
  const barF = useBarFilter(data?.barItems ?? []);
  const [barHint, setBarHint] = useState("");
  // เริ่มพิมพ์ใหม่ = ล้างข้อความแจ้งผลครั้งก่อน
  useEffect(() => {
    if (barF.q) setBarHint("");
  }, [barF.q]);
  const bill = data?.bills.find((b) => b.id === billId) ?? null;
  const powders = data?.powders ?? [];

  const draftTotal = draft.reduce((n, l) => n + (menuById.get(l.itemId) ? linePrice(menuById.get(l.itemId)!, l, powders) : 0), 0);
  const barLines = Object.entries(barDraft).filter(([id, n]) => n > 0 && barById.has(id));
  const barTotal = barLines.reduce((n, [id, k]) => n + barById.get(id)!.price * k, 0);
  const pending = draftTotal + barTotal;
  const billTotal = bill?.subtotal ?? 0;
  const grand = billTotal + pending;

  function open(item: MenuItem) {
    const food = item.kind === "food";
    setEdit({
      item,
      line: {
        itemId: item.id,
        temp: item.temps[0] ?? "iced",
        sweet: food || item.sweetChoice === false ? 0 : 50,
        milk: !food && item.milk ? "fresh" : null,
        powder: !food && hasPowder(item) && powders.length ? powders[0].id : null,
        extraShot: false,
        softCream: false,
        iceSep: false,
        toppings: food ? defaultChoices(item) : [],
        qty: 1,
      },
    });
  }

  function addBar(id: string, d: number) {
    setBarDraft((b) => ({ ...b, [id]: Math.max(0, Math.min(BAR_MAX_QTY, (b[id] ?? 0) + d)) }));
  }

  async function onPhoto(file?: File) {
    if (!file) return;
    setScanning(true);
    setErr("");
    try {
      const { scanTray } = await import("../../bar/scan");
      const s = await scanTray(file);
      const counts: Record<string, number> = {};
      for (const c of s.codes) {
        const id = barIdFromQr(c.text);
        if (id && barById.has(id)) counts[id] = (counts[id] ?? 0) + 1;
      }
      setShot(s);
      setDetected(counts);
      setBarDraft(counts);
      if (!Object.keys(counts).length) setErr("อ่าน QR ในรูปไม่ได้ กดเพิ่มของเองได้เลย");
    } catch {
      setErr("อ่านรูปไม่สำเร็จ กดเพิ่มของเองได้เลย");
    } finally {
      setScanning(false);
    }
  }

  function clearDraft() {
    setDraft([]);
    setBarDraft({});
    setDetected({});
    setShot(null);
  }

  // ส่งรายการที่ยังไม่ส่งเข้าบิล (มัทฉะเข้าคิวทำเลย · มาม่าบาร์บันทึกรอจ่าย) → คืนเลขบิล
  async function send(): Promise<number | null> {
    let id = billId;
    if (draft.length) {
      const r = await api<{ billId: number; bills: PosBill[] }>({ action: "order", billId: id, label, source: "menu", lines: draft });
      id = r.billId;
    }
    if (barLines.length) {
      const r = await api<{ billId: number; bills: PosBill[] }>({
        action: "order",
        billId: id,
        label,
        source: "bar",
        barLines: barLines.map(([bid, qty]) => ({ id: bid, qty })),
        detected,
        photo: shot?.photo,
      });
      id = r.billId;
    }
    clearDraft();
    setBillId(id);
    await load();
    return id;
  }

  async function sendOnly() {
    setBusy(true);
    setErr("");
    try {
      await send();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ส่งไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function openPay() {
    setBusy(true);
    setErr("");
    try {
      const id = pending > 0 ? await send() : billId;
      if (!id) throw new Error("ยังไม่มีรายการ");
      const fresh = await fetch("/api/admin/pos", { cache: "no-store" }).then((r) => r.json() as Promise<Data>);
      setData(fresh);
      const b = fresh.bills.find((x) => x.id === id);
      if (!b || !b.subtotal) throw new Error("บิลนี้ยังไม่มีรายการ");
      const { qr } = await api<{ qr: string }>({ action: "qr", amount: b.subtotal });
      setPay({ billId: id, subtotal: b.subtotal, method: "qr", cash: "", code: "", discount: 0, promoErr: "", qr, big: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "เปิดหน้าชำระเงินไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function applyCode() {
    if (!pay) return;
    try {
      const r = await api<{ code: string; discount: number }>({ action: "promo", billId: pay.billId, promoCode: pay.code });
      const { qr } = await api<{ qr: string }>({ action: "qr", amount: Math.max(1, pay.subtotal - r.discount) });
      setPay({ ...pay, code: r.code, discount: r.discount, promoErr: "", qr });
    } catch (e) {
      setPay({ ...pay, discount: 0, promoErr: e instanceof Error ? e.message : "ใช้โค้ดไม่ได้" });
    }
  }

  async function confirmPay() {
    if (!pay) return;
    const due = pay.subtotal - pay.discount;
    const cash = pay.method === "cash" ? (pay.cash ? Number(pay.cash) : due) : null;
    setBusy(true);
    try {
      const r = await api<{ bill: PosBill; bills: PosBill[] }>({
        action: "pay",
        billId: pay.billId,
        method: pay.method,
        cashReceived: cash,
        promoCode: pay.discount > 0 ? pay.code : "",
      });
      setPay(null);
      setPaid(r.bill);
      setBillId(null);
      setLabel("");
      load();
    } catch (e) {
      setPay({ ...pay, promoErr: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  }

  async function voidBill() {
    if (!bill || !confirm(`ยกเลิก ${billName(bill)} ทั้งบิล? เครื่องดื่มในคิวจะถูกยกเลิกด้วย`)) return;
    setBusy(true);
    try {
      await api({ action: "void", billId: bill.id });
      setBillId(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function rename(v: string) {
    if (!bill) return setLabel(v);
    try {
      await api({ action: "label", billId: bill.id, label: v });
      load();
    } catch {}
  }

  const receipt = (id: number) => window.open(`/admin/pos/receipt/${id}?print=1`, "_blank");

  if (!data) return <main className="ps ps-loading">กำลังโหลด…</main>;

  const words = q.trim().toLowerCase();
  const menu = data.menu.filter((m) => (cat === "all" || menuGroup(m) === cat) && (!words || `${m.name} ${m.jp}`.toLowerCase().includes(words)));

  return (
    <main className="ps">
      <section className="ps-left">
        <header className="ps-head">
          <Seal size={44} />
          <div>
            <b>CODE-MATCHA · หน้าร้าน</b>
            <small>ลูกค้าเดินเข้าร้าน ไม่สั่งผ่าน LINE · พนักงานคิดเงินให้</small>
          </div>
          <nav className="ps-mode" aria-label="เลือกหมวด">
            <button aria-pressed={mode === "menu"} onClick={() => setMode("menu")}>
              มัทฉะ &amp; เครื่องดื่ม
            </button>
            <button aria-pressed={mode === "bar"} onClick={() => setMode("bar")}>
              มาม่าบาร์
            </button>
          </nav>
          <a className="ps-back" href="/admin">
            หลังร้าน
          </a>
        </header>

        {mode === "menu" ? (
          <>
            <div className="ps-filters">
              {(
                [
                  ["all", "ทั้งหมด"],
                  ["drink", "เครื่องดื่ม"],
                  ["soda", "เครื่องดื่มโซดา"],
                  ["food", "อาหาร & ขนม"],
                ] as [Cat, string][]
              ).map(([id, t]) => (
                <button key={id} aria-pressed={cat === id} onClick={() => setCat(id)}>
                  {t}
                </button>
              ))}
              <input className="ps-search" placeholder="ค้นหาเมนู" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาเมนู" />
            </div>
            <div className="ps-grid">
              {menu.map((m) => {
                const inDraft = draft.filter((l) => l.itemId === m.id).reduce((n, l) => n + l.qty, 0);
                return (
                  <button key={m.id} className="ps-card" onClick={() => open(m)}>
                    <span className="ps-art" style={{ background: artTint(m) }}>
                      <MenuArt item={m} size={70} />
                    </span>
                    {m.jp && <small>{m.jp}</small>}
                    <b>{m.name}</b>
                    <span className="ps-price">
                      {baht(m.promoPrice ?? m.price)}
                      {inDraft > 0 && <em>{inDraft}</em>}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="ps-bar">
            <div className="ps-shot">
              {shot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shot.photo} alt="รูปถาด" />
              ) : (
                <span>ถ่ายรูปถาดให้ระบบอ่าน QR หรือกดเพิ่มของเองด้านล่าง</span>
              )}
              <label className="ps-camera">
                {scanning ? "กำลังอ่าน QR…" : shot ? "ถ่ายใหม่" : "ถ่ายรูปถาด"}
                <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => (onPhoto(e.target.files?.[0]), (e.target.value = ""))} />
              </label>
            </div>
            <BarFilter
              f={barF}
              id="ps-bar-q"
              placeholder="คีย์รหัส 3 หลักแล้วกด Enter = เพิ่ม 1 ชิ้น · หรือพิมพ์ชื่อ"
              onEnter={() => {
                // เหลือรายการเดียว = เพิ่มเลย แล้วล้างช่องไว้คีย์ชิ้นต่อไป
                if (barF.shown.length === 1) {
                  const it = barF.shown[0];
                  addBar(it.id, 1);
                  setBarHint(`เพิ่ม ${barCode(it.code)} ${it.name} แล้ว`);
                  barF.setQ("");
                } else setBarHint(barF.shown.length ? `เจอ ${barF.shown.length} รายการ กดเลือกด้านล่าง หรือพิมพ์รหัสให้ครบ 3 หลัก` : "ไม่พบรหัสนี้");
              }}
            />
            {barHint && (
              <p className="ps-bar-hint" role="status">
                {barHint}
              </p>
            )}
            <div className="ps-bar-grid">
              {barF.shown.map((i) => (
                <div key={i.id} className="ps-bar-item">
                  {i.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="ps-bar-img" src={i.imageUrl} alt="" width={40} height={40} />
                  ) : (
                    <BarArt kind={i.kind} size={40} />
                  )}
                  <span>
                    <b>{i.name}</b>
                    <small>
                      {i.code ? <span className="bf-code">{barCode(i.code)}</span> : null}
                      {baht(i.price)}
                      {detected[i.id] ? ` · จากรูป ${detected[i.id]}` : ""}
                    </small>
                  </span>
                  <span className="ps-step">
                    <button aria-label={`ลด ${i.name}`} onClick={() => addBar(i.id, -1)} disabled={!barDraft[i.id]}>
                      −
                    </button>
                    <b>{barDraft[i.id] ?? 0}</b>
                    <button aria-label={`เพิ่ม ${i.name}`} onClick={() => addBar(i.id, 1)}>
                      +
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <aside className="ps-right">
        <div className="ps-bills">
          <b>บิลที่เปิดอยู่ (เช็คบิลตอนออก)</b>
          <div>
            {data.bills.map((b) => {
              const mins = minutesAgo(b.openedAt);
              return (
                <button key={b.id} className={`ps-bill${b.id === billId ? " on" : ""}${mins >= 40 ? " late" : ""}`} onClick={() => setBillId(b.id)}>
                  {billName(b)} · {baht(b.subtotal)}
                  {mins >= 40 && ` · ${mins} นาที`}
                </button>
              );
            })}
            <button className={`ps-bill new${billId === null ? " on" : ""}`} onClick={() => setBillId(null)}>
              + บิลใหม่
            </button>
          </div>
        </div>

        <div className="ps-billhead">
          <label>
            <small>{bill ? `เปิดบิล ${new Date(bill.openedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} · ทานที่ร้าน` : "บิลใหม่ · ชื่อหรือเลขโต๊ะ (ไม่ใส่ก็ได้)"}</small>
            <input
              key={bill?.id ?? "new"}
              defaultValue={bill ? bill.label : label}
              placeholder="เช่น โต๊ะ 3 / คุณแนน"
              maxLength={30}
              onChange={(e) => !bill && setLabel(e.target.value)}
              onBlur={(e) => bill && e.target.value !== bill.label && rename(e.target.value)}
            />
          </label>
          {bill && (
            <button className="ps-void" onClick={voidBill} disabled={busy}>
              ยกเลิกบิล
            </button>
          )}
        </div>

        <ol className="ps-lines">
          {bill?.orders
            .filter((o) => o.status !== "cancelled")
            .flatMap((o) =>
              o.items.map((i, k) => (
                <li key={`${o.id}-${k}`}>
                  <span>
                    <b>{i.name}</b>
                    {i.detail && <small>{i.detail}</small>}
                    <small className={`ps-st ${o.status}`}>{o.source === "bar" ? "มาม่าบาร์ · ต้มเอง" : `ส่งเข้าคิวแล้ว · ${STATUS[o.status] ?? o.status}`}</small>
                  </span>
                  <span className="ps-q">×{i.qty}</span>
                  <b className="ps-amt">{baht(i.price)}</b>
                </li>
              )),
            )}
          {draft.map((l, k) => {
            const m = menuById.get(l.itemId);
            if (!m) return null;
            return (
              <li key={`d${k}`} className="draft">
                <span>
                  <b>{m.name}</b>
                  <small>{lineDetail(m, l, powders)}</small>
                  <small className="ps-st draft">ยังไม่ส่ง</small>
                </span>
                <span className="ps-q">×{l.qty}</span>
                <b className="ps-amt">{baht(linePrice(m, l, powders))}</b>
                <button className="ps-x" aria-label={`เอา ${m.name} ออก`} onClick={() => setDraft(draft.filter((_, j) => j !== k))}>
                  ×
                </button>
              </li>
            );
          })}
          {barLines.map(([id, n]) => (
            <li key={`b${id}`} className="draft">
              <span>
                <b>{barById.get(id)!.name}</b>
                <small className="ps-st draft">มาม่าบาร์ · ยังไม่บันทึก</small>
              </span>
              <span className="ps-q">×{n}</span>
              <b className="ps-amt">{baht(barById.get(id)!.price * n)}</b>
              <button className="ps-x" aria-label={`เอา ${barById.get(id)!.name} ออก`} onClick={() => setBarDraft({ ...barDraft, [id]: 0 })}>
                ×
              </button>
            </li>
          ))}
          {!bill?.orders.length && !draft.length && !barLines.length && <li className="ps-empty">กดเมนูทางซ้ายเพื่อเพิ่มรายการ</li>}
        </ol>

        <div className="ps-foot">
          {err && (
            <p className="ps-err" role="alert">
              {err}
            </p>
          )}
          <div className="ps-sum">
            <b>ยอดรวม</b>
            <b className="ps-grand">{baht(grand)}</b>
          </div>
          <div className="ps-acts">
            <button className="ps-later" disabled={busy || pending === 0} onClick={sendOnly}>
              ส่งเข้าคิว · จ่ายทีหลัง
            </button>
            <button className="ps-pay" disabled={busy || grand === 0} onClick={openPay}>
              ชำระเงิน {baht(grand)}
            </button>
          </div>
          <button className="ps-history" onClick={() => setHistory(true)}>
            ใบเสร็จย้อนหลัง
          </button>
        </div>
      </aside>

      {edit && (
        <OptionSheet
          item={edit.item}
          line={edit.line}
          powders={powders}
          onChange={(line) => setEdit({ ...edit, line })}
          onClose={() => setEdit(null)}
          onAdd={() => {
            setDraft([...draft, edit.line]);
            setEdit(null);
          }}
        />
      )}

      {pay && (
        <div className="ps-modal" role="dialog" aria-modal="true" aria-label="ชำระเงิน">
          <div className="ps-paybox">
            <section>
              <header>
                <div>
                  <small>{billName(data.bills.find((b) => b.id === pay.billId) ?? { id: pay.billId, label: "" })}</small>
                  <b>ชำระเงิน</b>
                </div>
                <button aria-label="ปิด" onClick={() => setPay(null)}>
                  ×
                </button>
              </header>
              <div className="ps-method">
                <button aria-pressed={pay.method === "qr"} onClick={() => setPay({ ...pay, method: "qr" })}>
                  QR พร้อมเพย์
                </button>
                <button aria-pressed={pay.method === "cash"} onClick={() => setPay({ ...pay, method: "cash" })}>
                  เงินสด
                </button>
              </div>
              {pay.method === "qr" ? (
                <div className="ps-qrbox">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pay.qr} alt={`QR พร้อมเพย์ ${pay.subtotal - pay.discount} บาท`} />
                  <div>
                    <span className="ps-thaiqr">THAI QR PAYMENT</span>
                    <b>{baht(pay.subtotal - pay.discount)}</b>
                    <small>ให้ลูกค้าสแกนจากจอนี้ ยอดใส่ใน QR แล้ว</small>
                    <button onClick={() => setPay({ ...pay, big: true })}>เปิดจอใหญ่ให้ลูกค้า</button>
                  </div>
                </div>
              ) : (
                <CashBox due={pay.subtotal - pay.discount} value={pay.cash} onChange={(cash) => setPay({ ...pay, cash })} />
              )}
            </section>
            <aside>
              <b>สรุปบิล</b>
              <div className="ps-row">
                <span>รวม</span>
                <span>{baht(pay.subtotal)}</span>
              </div>
              <div className="ps-code">
                <input placeholder="โค้ดส่วนลด" value={pay.code} onChange={(e) => setPay({ ...pay, code: e.target.value.toUpperCase(), discount: 0 })} />
                <button onClick={applyCode} disabled={!pay.code}>
                  ใช้
                </button>
              </div>
              {pay.discount > 0 && (
                <div className="ps-row">
                  <span>โค้ด {pay.code}</span>
                  <span>−{baht(pay.discount)}</span>
                </div>
              )}
              <div className="ps-row ps-due">
                <b>ยอดชำระ</b>
                <b>{baht(pay.subtotal - pay.discount)}</b>
              </div>
              {pay.promoErr && <p className="ps-err">{pay.promoErr}</p>}
              <small className="ps-note">เห็นยอดเข้าแอปธนาคาร (หรือรับเงินสดครบ) แล้วกดยืนยัน ยอดจะเข้าระบบ รายงานยอดขาย และตัดสต๊อก</small>
              <button className="ps-confirm" onClick={confirmPay} disabled={busy || (pay.method === "cash" && !!pay.cash && Number(pay.cash) < pay.subtotal - pay.discount)}>
                ได้รับเงินแล้ว ✓
              </button>
              <button className="ps-link" onClick={() => setPay(null)}>
                ยังไม่จ่าย · เก็บไว้เช็คบิลตอนออก
              </button>
            </aside>
          </div>
          {pay.big && (
            <button className="ps-big" onClick={() => setPay({ ...pay, big: false })} aria-label="ปิดจอใหญ่">
              <Seal size={56} />
              <b>CODE-MATCHA</b>
              <small>สแกนจ่ายได้เลย</small>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pay.qr} alt="" />
              <strong>{baht(pay.subtotal - pay.discount)}</strong>
              <small>แตะเพื่อกลับ</small>
            </button>
          )}
        </div>
      )}

      {paid && (
        <div className="ps-modal" role="dialog" aria-modal="true" aria-label="ชำระเรียบร้อย">
          <div className="ps-done">
            <Seal size={56} />
            <b>ชำระเรียบร้อย</b>
            <strong>{baht(paid.total)}</strong>
            <span>
              {billName(paid)} · {paid.payMethod === "cash" ? "เงินสด" : "พร้อมเพย์ QR"}
              {paid.payMethod === "cash" && paid.cashReceived != null && paid.cashReceived > paid.total && ` · ทอน ${baht(paid.cashReceived - paid.total)}`}
            </span>
            <div className="ps-acts">
              <button className="ps-later" onClick={() => receipt(paid.id)}>
                พิมพ์ใบเสร็จ
              </button>
              <button className="ps-pay" onClick={() => setPaid(null)}>
                บิลต่อไป
              </button>
            </div>
          </div>
        </div>
      )}

      {history && (
        <div className="ps-modal" role="dialog" aria-modal="true" aria-label="ใบเสร็จย้อนหลัง" onClick={() => setHistory(false)}>
          <div className="ps-hist" onClick={(e) => e.stopPropagation()}>
            <header>
              <b>ใบเสร็จย้อนหลัง</b>
              <button aria-label="ปิด" onClick={() => setHistory(false)}>
                ×
              </button>
            </header>
            <ul>
              {data.recent.map((b) => (
                <li key={b.id}>
                  <span>
                    <b>{billName(b)}</b>
                    <small>
                      {new Date(b.paidAt!).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} ·{" "}
                      {b.payMethod === "cash" ? "เงินสด" : "QR"}
                      {b.claimedAt ? " · รับแต้มแล้ว" : ""}
                    </small>
                  </span>
                  <b>{baht(b.total)}</b>
                  <button onClick={() => receipt(b.id)}>พิมพ์</button>
                </li>
              ))}
              {!data.recent.length && <li className="ps-empty">ยังไม่มีใบเสร็จ</li>}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}

function CashBox({ due, value, onChange }: { due: number; value: string; onChange: (v: string) => void }) {
  const got = value ? Number(value) : due;
  const notes = [...new Set([due, Math.ceil(due / 100) * 100, 500, 1000].filter((n) => n >= due))].slice(0, 4);
  return (
    <div className="ps-cash">
      <label>
        รับเงินมา
        <input inputMode="numeric" placeholder={String(due)} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} />
      </label>
      <div className="ps-notes">
        {notes.map((n) => (
          <button key={n} aria-pressed={got === n} onClick={() => onChange(n === due ? "" : String(n))}>
            {n === due ? "พอดี" : baht(n)}
          </button>
        ))}
      </div>
      <div className="ps-change">
        <small>เงินทอน</small>
        <b className={got < due ? "bad" : ""}>{got < due ? `ขาดอีก ${baht(due - got)}` : baht(got - due)}</b>
      </div>
    </div>
  );
}

function OptionSheet({
  item,
  line,
  powders,
  onChange,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  line: CartLine;
  powders: Powder[];
  onChange: (l: CartLine) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  const set = (p: Partial<CartLine>) => onChange({ ...line, ...p });
  const food = item.kind === "food";
  const groups = optionGroups(item);
  const free = freeToppings(item);
  return (
    <div className="ps-modal" role="dialog" aria-modal="true" aria-label={item.name} onClick={onClose}>
      <div className="ps-sheet" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            {item.jp && <small>{item.jp}</small>}
            <b>{item.name}</b>
          </div>
          <button aria-label="ปิด" onClick={onClose}>
            ×
          </button>
        </header>
        {!food && (
          <>
            {item.temps.length > 1 && (
              <Group label="อุณหภูมิ">
                {item.temps.map((t) => (
                  <button key={t} aria-pressed={line.temp === t} onClick={() => set({ temp: t, softCream: t === "iced" && line.softCream, iceSep: t === "iced" && line.iceSep })}>
                    {TEMP_LABEL[t]}
                  </button>
                ))}
              </Group>
            )}
            {item.sweetChoice !== false && (
              <Group label="ความหวาน">
                {SWEET.map((s) => (
                  <button key={s} aria-pressed={line.sweet === s} onClick={() => set({ sweet: s })}>
                    {s === 0 ? "ไม่หวาน" : `${s}%`}
                  </button>
                ))}
              </Group>
            )}
            {item.milk && (
              <Group label="นม">
                {MILKS.map((m) => (
                  <button key={m.id} aria-pressed={line.milk === m.id} onClick={() => set({ milk: m.id })}>
                    {m.label}
                    {m.price ? ` +${m.price}` : ""}
                  </button>
                ))}
              </Group>
            )}
            {hasPowder(item) && powders.length > 0 && (
              <Group label="ผงมัทฉะ">
                {powders.map((p) => (
                  <button key={p.id} aria-pressed={line.powder === p.id} onClick={() => set({ powder: p.id })}>
                    {p.name}
                    {powderExtra(item, p) ? ` +${powderExtra(item, p)}` : ""}
                  </button>
                ))}
              </Group>
            )}
            {(item.addons || line.temp === "iced") && (
              <Group label="เพิ่มเติม">
                {item.addons && (
                  <button aria-pressed={line.extraShot} onClick={() => set({ extraShot: !line.extraShot })}>
                    ช็อตมัทฉะ +{SHOT_PRICE}
                  </button>
                )}
                {item.addons && line.temp === "iced" && (
                  <button aria-pressed={line.softCream} onClick={() => set({ softCream: !line.softCream })}>
                    ท็อปซอฟต์ครีม +{SOFT_CREAM_PRICE}
                  </button>
                )}
                {line.temp === "iced" && (
                  <button aria-pressed={!!line.iceSep} onClick={() => set({ iceSep: !line.iceSep })}>
                    แยกน้ำแข็ง
                  </button>
                )}
              </Group>
            )}
          </>
        )}
        {food &&
          groups.map((g) => (
            <Group key={g.name} label={g.name}>
              {g.options.map((o) => (
                <button
                  key={o.id}
                  aria-pressed={line.toppings.includes(o.id)}
                  onClick={() => set({ toppings: [...line.toppings.filter((id) => !g.options.some((x) => x.id === id)), o.id] })}
                >
                  {o.label}
                  {o.price ? ` +${o.price}` : ""}
                </button>
              ))}
            </Group>
          ))}
        {food && free.length > 0 && (
          <Group label="ท็อปปิ้ง">
            {free.map((t) => (
              <button
                key={t.id}
                aria-pressed={line.toppings.includes(t.id)}
                onClick={() => set({ toppings: line.toppings.includes(t.id) ? line.toppings.filter((x) => x !== t.id) : [...line.toppings, t.id] })}
              >
                {t.label}
                {t.price ? ` +${t.price}` : ""}
              </button>
            ))}
          </Group>
        )}
        <footer>
          <span className="ps-step">
            <button aria-label="ลดจำนวน" onClick={() => set({ qty: Math.max(1, line.qty - 1) })}>
              −
            </button>
            <b>{line.qty}</b>
            <button aria-label="เพิ่มจำนวน" onClick={() => set({ qty: Math.min(MAX_QTY, line.qty + 1) })}>
              +
            </button>
          </span>
          <button className="ps-pay" onClick={onAdd}>
            เพิ่มลงบิล {baht(linePrice(item, line, powders))}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ps-group">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}
