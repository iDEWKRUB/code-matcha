"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "../Icon";

type Row = {
  id: number;
  at: string;
  kind: "customer" | "staff" | "broadcast";
  to: string;
  title: string;
  orderNo: number | null;
  ok: boolean;
  error: string;
  stats?: { delivered: number | null; opened: number | null; clicked: number | null } | null;
};

const time = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const n = (v: number | null | undefined) => (v === null || v === undefined ? "–" : v.toLocaleString());

export default function MessageLog() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<"all" | "failed" | "broadcast">("all");

  const load = useCallback(() => {
    fetch("/api/admin/messages", { cache: "no-store" }).then((r) => (r.ok ? r.json().then(setRows) : setRows([])));
  }, []);
  useEffect(load, [load]);

  const list = (rows ?? []).filter((r) => (filter === "failed" ? !r.ok : filter === "broadcast" ? r.kind === "broadcast" : true));
  const failed = (rows ?? []).filter((r) => !r.ok).length;

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>
            <Icon name="note" size={20} /> ประวัติการส่งข้อความ LINE
          </h2>
          <p>100 รายการล่าสุด · การ์ดโปรที่ส่งถึงทุกคน LINE บอกเป็นยอดรวม (ดูได้วันถัดไป และต้องมีเพื่อน 20 คนขึ้นไป)</p>
        </div>
        <button className="btn ghost-sm" onClick={load}>
          รีเฟรช
        </button>
      </header>
      <div className="chips log-filter">
        <button className="chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          ทั้งหมด
        </button>
        <button className="chip" aria-pressed={filter === "failed"} onClick={() => setFilter("failed")}>
          ส่งไม่ถึง{failed ? ` (${failed})` : ""}
        </button>
        <button className="chip" aria-pressed={filter === "broadcast"} onClick={() => setFilter("broadcast")}>
          การ์ดโปร
        </button>
      </div>
      {rows === null ? (
        <p className="empty">กำลังโหลด…</p>
      ) : list.length === 0 ? (
        <p className="empty">ยังไม่มีรายการ</p>
      ) : (
        <div className="log-wrap">
          <table className="log">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>ถึง</th>
                <th>ข้อความ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={r.ok ? "" : "bad"}>
                  <td className="t">{time(r.at)}</td>
                  <td>
                    {r.to || "ลูกค้า"}
                    {r.kind === "staff" && <span className="kind">พนักงาน</span>}
                  </td>
                  <td>
                    {r.title}
                    {r.orderNo ? <span className="muted"> · #{r.orderNo}</span> : null}
                  </td>
                  <td>
                    {r.ok ? <span className="st ok">ส่งแล้ว</span> : <span className="st no">ไม่ถึง</span>}
                    {!r.ok && r.error && <small>{r.error}</small>}
                    {r.kind === "broadcast" && r.ok && (
                      <small>
                        ถึง {n(r.stats?.delivered)} · เปิดอ่าน {n(r.stats?.opened)} · กด {n(r.stats?.clicked)}
                      </small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
