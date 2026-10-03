"use client";

import { useCallback, useEffect, useState } from "react";
import { LOW_STOCK, barCode, type CountLine } from "@/lib/bar";
import BarFilter, { useBarFilter } from "../../bar/BarFilter";

type Item = { id: string; name: string; price: number; kind: string; stock: number; available: boolean; category: string; group: string; detail: string; code: number | null };
type Move = { id: number; itemId: string; delta: number; kind: "in" | "sale" | "count"; orderNo: number | null; note: string; at: string };
type Count = { id: number; date: string; at: string; lines: CountLine[]; missing: number; missingValue: number };
type TraceBill = { id: number; no: number; at: string; name: string; status: string; photo: string | null; detected: number; paid: number; extra: number; pieces: number; warn: boolean };
type Modal = { kind: "in" | "count"; values: Record<string, string>; note: string; busy: boolean; err: string };

const time = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const dateTh = (d: string) => new Date(`${d}T12:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
const short = (n: string) => n.replace(/^(ท็อปปิ้ง|มาม่า(รส)?)\s*/, "");

// เปิดบิลในส่วน "บิลมาม่าบาร์" (อยู่คนละ component) ผ่าน event
export const openBill = (id: number, date: string) => window.dispatchEvent(new CustomEvent("bar:open-bill", { detail: { id, date } }));

export default function BarStock() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [counts, setCounts] = useState<Count[]>([]);
  const [modal, setModal] = useState<Modal | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceBill[] | null>(null);
  const [others, setOthers] = useState<TraceBill[]>([]);
  const [err, setErr] = useState("");
  // ตัวกรองแยกกัน: ตารางคงเหลือ กับหน้าต่างรับของเข้า/นับจริง
  const listF = useBarFilter(items ?? []);
  const modalF = useBarFilter(items ?? []);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/bar/stock", { cache: "no-store" });
    if (r.status === 401) return location.reload();
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? "โหลดสต๊อกไม่สำเร็จ");
    setItems(j.items);
    setMoves(j.moves);
    setCounts(j.counts);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const last = counts[0] ?? null;
  useEffect(() => {
    setTrace(null);
    if (!pick || !last) return;
    fetch(`/api/admin/bar/stock?trace=${last.id}&item=${encodeURIComponent(pick)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setTrace(j.bills ?? []);
        setOthers(j.others ?? []);
      })
      .catch(() => setTrace([]));
  }, [pick, last]);

  async function post(body: Record<string, unknown>) {
    const r = await fetch("/api/admin/bar/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? "บันทึกไม่สำเร็จ");
    await load();
    return j;
  }

  async function save() {
    if (!modal) return;
    setModal({ ...modal, busy: true, err: "" });
    try {
      const filled = Object.entries(modal.values).filter(([, v]) => v.trim() !== "");
      if (modal.kind === "in") await post({ action: "in", note: modal.note, lines: filled.map(([id, v]) => ({ id, qty: Number(v) })) });
      else {
        await post({ action: "count", lines: filled.map(([id, v]) => ({ id, counted: Number(v) })) });
        setPick(null);
      }
      setModal(null);
    } catch (e) {
      setModal((m) => m && { ...m, busy: false, err: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" });
    }
  }

  async function markWaste(id: string, qty: number) {
    if (!last) return;
    try {
      await post({ action: "waste", countId: last.id, id, qty });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }

  if (!items) return <section className="nba-card nba-noprint">{err ? <p className="nba-err">{err}</p> : <p className="nba-muted">กำลังโหลดสต๊อก…</p>}</section>;

  const inToday = new Map<string, number>();
  const outToday = new Map<string, number>();
  for (const m of moves) {
    if (m.kind === "in") inToday.set(m.itemId, (inToday.get(m.itemId) ?? 0) + m.delta);
    if (m.kind === "sale") outToday.set(m.itemId, (outToday.get(m.itemId) ?? 0) - m.delta);
  }
  const low = items.filter((i) => i.stock <= LOW_STOCK);
  const name = (id: string) => items.find((i) => i.id === id)?.name ?? id;

  // ความเคลื่อนไหววันนี้ รวมเป็นก้อนตามบิล / ตามครั้งที่รับเข้า-นับ
  const groups: { key: string; at: string; kind: Move["kind"]; label: string; parts: string[] }[] = [];
  for (const m of moves) {
    const key = m.kind === "sale" ? `s${m.orderNo}` : `${m.kind}${m.at.slice(0, 19)}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, at: m.at, kind: m.kind, label: m.kind === "sale" ? `บิล #${m.orderNo ?? "?"}` : m.kind === "in" ? `รับของเข้า${m.note ? ` · ${m.note}` : ""}` : "ปรับตามที่นับจริง", parts: [] };
      groups.push(g);
    }
    g.parts.push(`${short(name(m.itemId))} ${m.delta > 0 ? "+" : "−"}${Math.abs(m.delta)}`);
  }

  const lostLines = last?.lines.filter((l) => l.diff < 0) ?? [];
  const picked = last?.lines.find((l) => l.id === pick) ?? null;
  const recovered = trace ? trace.reduce((n, b) => n + b.extra, 0) : 0;
  const pendingCharge = trace ? trace.reduce((n, b) => n + Math.max(0, b.detected - b.paid - b.extra), 0) : 0;
  const unexplained = picked ? Math.max(0, -picked.diff - recovered - pendingCharge) : 0;

  const countPreview = modal?.kind === "count"
    ? items.map((i) => {
        const v = modal.values[i.id] ?? "";
        const counted = v.trim() === "" ? null : Number(v);
        return { ...i, counted, diff: counted === null || !Number.isFinite(counted) ? null : counted - i.stock };
      })
    : [];
  const previewMissing = countPreview.reduce((n, l) => n + (l.diff !== null && l.diff < 0 ? -l.diff : 0), 0);
  const previewValue = countPreview.reduce((n, l) => n + (l.diff !== null && l.diff < 0 ? -l.diff * l.price : 0), 0);

  return (
    <section className="nba-card nba-noprint stk">
      <div className="nba-row-head">
        <div>
          <h2>สต๊อกมาม่าบาร์</h2>
          <p className="nba-muted">ตัดอัตโนมัติทุกครั้งที่ลูกค้าจ่าย · ของที่เรียกเก็บเพิ่มไม่ตัดซ้ำ (ออกจากบาร์ไปแล้วตอนหยิบ)</p>
        </div>
        <div className="nba-acts">
          <button className="nba-ghost" onClick={() => setModal({ kind: "in", values: {}, note: "", busy: false, err: "" })}>
            + รับของเข้า
          </button>
          <button className="nba-primary" onClick={() => setModal({ kind: "count", values: {}, note: "", busy: false, err: "" })}>
            นับจริงตอนปิดร้าน
          </button>
        </div>
      </div>
      {err && <p className="nba-err" role="alert">{err}</p>}

      <div className="bb-tiles st-tiles">
        <div>
          <small>ออกจากบาร์วันนี้</small>
          <b>{[...outToday.values()].reduce((n, q) => n + q, 0)} ชิ้น</b>
        </div>
        <div className={low.length ? "warn" : ""}>
          <small>ใกล้หมด (≤{LOW_STOCK})</small>
          <b>{low.length} รายการ</b>
        </div>
        <div className={last ? (last.missing ? "due" : "ok") : ""}>
          <small>นับล่าสุด</small>
          <b className="st-last">{last ? `${dateTh(last.date)} ${time(last.at)} · ${last.missing ? `หาย ${last.missing} ชิ้น` : "ครบ"}` : "ยังไม่เคยนับ"}</b>
        </div>
      </div>

      <BarFilter f={listF} id="stk-q" />
      <div className="st-table" role="table" aria-label="สต๊อกคงเหลือ">
        <div className="st-tr st-th" role="row">
          <span role="columnheader">รายการ</span>
          <span role="columnheader">รับเข้าวันนี้</span>
          <span role="columnheader">ออกวันนี้</span>
          <span role="columnheader">คงเหลือ</span>
          <span role="columnheader">สถานะ</span>
        </div>
        {listF.shown.map((i) => {
          const st = i.stock <= 0 ? ["bad", "หมด"] : i.stock <= LOW_STOCK ? ["wait", "ใกล้หมด"] : ["ok", "ปกติ"];
          return (
            <div key={i.id} className={`st-tr${i.stock <= LOW_STOCK ? " low" : ""}`} role="row">
              <span role="cell">
                {i.code ? <b className="bf-code">{barCode(i.code)}</b> : null} {i.name}
                {!i.available && <small> · ปิดขาย</small>}
              </span>
              <span role="cell" className="in">{inToday.get(i.id) ? `+${inToday.get(i.id)}` : "–"}</span>
              <span role="cell">{outToday.get(i.id) ? `−${outToday.get(i.id)}` : "–"}</span>
              <b role="cell">{i.stock}</b>
              <span role="cell">
                <span className={`bb-pill ${st[0]}`}>{st[1]}</span>
              </span>
            </div>
          );
        })}
      </div>

      {last && (
        <div className={`st-result${last.missing ? " bad" : ""}`}>
          <div className="st-result-head">
            <div>
              <b>
                ผลนับ · {dateTh(last.date)} {time(last.at)}
              </b>
              <p className="nba-muted">
                นับ {last.lines.length} รายการ · ครบ {last.lines.filter((l) => l.diff >= 0).length}
                {last.missing > 0 && (
                  <>
                    {" · "}
                    <b className="st-red">
                      หาย {lostLines.length} รายการ ({last.missing} ชิ้น · ฿{last.missingValue})
                    </b>
                  </>
                )}
              </p>
            </div>
            {last.missing > 0 && <span className="bb-pill bad">ต้องตาม</span>}
          </div>
          <div className="st-chips">
            {last.lines.map((l) => (
              <button
                key={l.id}
                className={`st-chip ${l.diff < 0 ? "bad" : "ok"}${pick === l.id ? " on" : ""}`}
                disabled={l.diff >= 0}
                onClick={() => setPick(pick === l.id ? null : l.id)}
              >
                {short(l.name)} {l.counted}/{l.expected}
                {l.diff < 0 ? ` · หาย ${-l.diff}` : l.diff > 0 ? ` · เกิน ${l.diff}` : " ✓"}
              </button>
            ))}
          </div>
          {lostLines.length > 0 && !picked && <p className="nba-muted">กดที่รายการสีแดงเพื่อตามว่าหายไปกับบิลไหน</p>}
          {picked && (
            <div className="st-trace">
              <div className="st-trace-head">
                <b>
                  ตาม{short(picked.name)}ที่หาย {-picked.diff} ชิ้น
                </b>
                <span className="nba-muted">บิลวันนั้นที่มี{short(picked.name)}ในถาด · เรียงบิลที่ขาดก่อน</span>
              </div>
              {trace === null && <p className="nba-muted">กำลังค้นบิล…</p>}
              {trace && trace.length === 0 && <p className="nba-muted">ไม่พบบิลที่มีรายการนี้ในวันนั้น</p>}
              {trace?.map((b) => {
                const short2 = b.detected - b.paid - b.extra;
                return (
                  <div key={b.id} className={`st-bill${short2 > 0 ? " miss" : ""}`}>
                    {b.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.photo} alt="" loading="lazy" />
                    ) : (
                      <span className="bb-thumb none">ไม่มีรูป</span>
                    )}
                    <div>
                      <div>
                        <b>#{b.no}</b> {b.name} <small className="nba-muted">{time(b.at)}</small>
                        {b.status === "cancelled" && <span className="bb-pill bad"> ยกเลิก</span>}
                      </div>
                      <div className="st-bill-nums">
                        ระบบอ่านได้ <b>{b.detected}</b> · จ่าย <b>{b.paid}</b>
                        {b.extra > 0 && (
                          <>
                            {" · "}เรียกเก็บเพิ่ม <b>{b.extra}</b>
                          </>
                        )}
                        {short2 > 0 ? <span className="st-red"> · ขาด {short2}</span> : <span className="st-ok"> · ตรง ✓</span>}
                      </div>
                    </div>
                    <button className={short2 > 0 ? "nba-primary" : "nba-ghost"} onClick={() => openBill(b.id, last.date)}>
                      {short2 > 0 ? "เปิดบิล & เรียกเก็บเพิ่ม" : "ดูบิล"}
                    </button>
                  </div>
                );
              })}
              {trace && others.length > 0 && unexplained > 0 && (
                <div className="st-others">
                  <div className="st-trace-head">
                    <b>บิลอื่นวันนั้น · ตรวจจากรูป</b>
                    <span className="nba-muted">ระบบไม่ได้อ่านเจอ{short(picked.name)}ในบิลเหล่านี้ (QR อาจถูกบัง/อ่านไม่ออก) · ดูรูปว่ามีชิ้นเกินไหม</span>
                  </div>
                  <div className="st-grid-photos">
                    {others.map((b) => (
                      <button key={b.id} className={`st-ph${b.warn ? " warn" : ""}`} onClick={() => openBill(b.id, last.date)}>
                        {b.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.photo} alt={`รูปถาดบิล #${b.no}`} loading="lazy" />
                        ) : (
                          <span className="none">ไม่มีรูป</span>
                        )}
                        <span className="cap">
                          <b>#{b.no}</b> {b.name} · จ่าย {b.pieces} ชิ้น
                          {b.warn && <em>น่าสงสัย</em>}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {trace && (
                <div className="st-trace-sum">
                  <span>
                    ตามเก็บเงินได้แล้ว {recovered} ชิ้น{pendingCharge > 0 && <> · <b className="st-warn">พบในบิลแต่ยังไม่เรียกเก็บ {pendingCharge} ชิ้น</b></>} · <b>ไม่พบในบิล {unexplained} ชิ้น</b>
                    {picked.waste > 0 && ` · บันทึกเป็นของเสียแล้ว ${picked.waste} ชิ้น`}
                  </span>
                  {unexplained > 0 && picked.waste !== unexplained && (
                    <button className="nba-ghost" onClick={() => markWaste(picked.id, unexplained)}>
                      บันทึกเป็นของเสีย {unexplained} ชิ้น
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="st-log">
        <h3>ความเคลื่อนไหววันนี้</h3>
        {groups.length === 0 && <p className="nba-muted">ยังไม่มี</p>}
        {groups.slice(0, 12).map((g) => (
          <p key={g.key} className={g.kind}>
            <span>{time(g.at)}</span>
            {g.label} · {g.parts.join(" · ")}
          </p>
        ))}
        {counts.length > 1 && (
          <details>
            <summary>ประวัติการนับ</summary>
            {counts.map((c) => (
              <p key={c.id}>
                <span>{dateTh(c.date)}</span>
                {c.missing ? `หาย ${c.missing} ชิ้น · ฿${c.missingValue}` : "ครบทุกรายการ"} · {c.lines.filter((l) => l.diff < 0).map((l) => `${short(l.name)} −${-l.diff}`).join(", ")}
              </p>
            ))}
          </details>
        )}
      </div>

      {modal && (
        <div className="nba-modal" role="dialog" aria-modal="true" aria-label={modal.kind === "in" ? "รับของเข้า" : "นับจริงตอนปิดร้าน"}>
          <div className="nba-form st-form">
            <div>
              <h2>{modal.kind === "in" ? "รับของเข้า" : "นับจริงตอนปิดร้าน"}</h2>
              <p className="nba-muted">{modal.kind === "in" ? "ใส่จำนวนที่รับเข้ามาเพิ่ม (ไม่ใส่ = ไม่มีรับเข้า)" : "กรอกจำนวนที่เหลือจริงบนชั้น (ไม่กรอก = ไม่นับรอบนี้)"}</p>
            </div>
            <BarFilter f={modalF} id="stk-modal-q" />
            <div className={`st-grid ${modal.kind}`}>
              <span className="h">รายการ</span>
              <span className="h c">{modal.kind === "in" ? "คงเหลือ" : "ควรเหลือ"}</span>
              <span className="h c">{modal.kind === "in" ? "รับเข้า" : "นับได้"}</span>
              {modal.kind === "count" && <span className="h r">ผล</span>}
              {modalF.shown.map((i) => {
                const p = countPreview.find((x) => x.id === i.id);
                return (
                  <div key={i.id} className={`st-row${p?.diff !== null && p?.diff !== undefined && p.diff < 0 ? " miss" : ""}`}>
                    <span>
                      {i.code ? <b className="bf-code">{barCode(i.code)}</b> : null} {short(i.name)}
                    </span>
                    <span className="c nba-muted">{i.stock}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label={`${modal.kind === "in" ? "รับเข้า" : "นับได้"} ${i.name}`}
                      placeholder="–"
                      value={modal.values[i.id] ?? ""}
                      onChange={(e) => setModal({ ...modal, values: { ...modal.values, [i.id]: e.target.value } })}
                    />
                    {modal.kind === "count" && (
                      <span className="r">
                        {p?.diff === null || p?.diff === undefined ? (
                          <span className="nba-muted">–</span>
                        ) : p.diff < 0 ? (
                          <b className="st-red">หาย {-p.diff}</b>
                        ) : p.diff > 0 ? (
                          <b className="st-warn">เกิน {p.diff}</b>
                        ) : (
                          <b className="st-ok">ครบ ✓</b>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {modal.kind === "in" && (
              <label>
                หมายเหตุ (ไม่บังคับ)
                <input value={modal.note} maxLength={100} placeholder="เช่น ซื้อจากแม็คโคร" onChange={(e) => setModal({ ...modal, note: e.target.value })} />
              </label>
            )}
            {modal.kind === "count" && previewMissing > 0 && (
              <div className="nba-xtotal st-lost">
                <span>ของหาย {previewMissing} ชิ้น</span>
                <b>มูลค่า ฿{previewValue}</b>
              </div>
            )}
            {modal.err && <p className="nba-err" role="alert">{modal.err}</p>}
            <div className="nba-acts">
              <button className="nba-ghost" onClick={() => setModal(null)} disabled={modal.busy}>
                ยกเลิก
              </button>
              <button className="nba-primary" onClick={save} disabled={modal.busy}>
                {modal.busy ? "กำลังบันทึก…" : modal.kind === "in" ? "บันทึกรับเข้า" : "บันทึกผลนับ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
