"use client";

import { useEffect, useState } from "react";
import { SERVICE_LABEL, type Service } from "@/lib/menu";

type Period = "day" | "week" | "month";
type Point = {
  key: string;
  label: string;
  short: string;
  revenue: number;
  orders: number;
  cups: number;
  discount: number;
};
type Report = {
  period: Period;
  series: Point[];
  top: { name: string; qty: number; revenue: number }[];
  services: Record<Service, { orders: number; revenue: number }>;
};

const PERIODS: {
  id: Period;
  label: string;
  span: string;
  now: string;
  prev: string;
}[] = [
  {
    id: "day",
    label: "รายวัน",
    span: "14 วันล่าสุด",
    now: "วันนี้",
    prev: "เมื่อวาน",
  },
  {
    id: "week",
    label: "รายสัปดาห์",
    span: "12 สัปดาห์ล่าสุด",
    now: "สัปดาห์นี้",
    prev: "สัปดาห์ก่อน",
  },
  {
    id: "month",
    label: "รายเดือน",
    span: "12 เดือนล่าสุด",
    now: "เดือนนี้",
    prev: "เดือนก่อน",
  },
];

const baht = (n: number) => `฿${Math.round(n).toLocaleString()}`;
const avg = (p: { revenue: number; orders: number }) => (p.orders ? p.revenue / p.orders : 0);

// ขอบบนของแกนเป็นเลขกลม ๆ ที่แบ่งครึ่งแล้วยังเป็นจำนวนเต็ม (เช่น 3,000 → 1,500 · 6 → 3)
function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 3, 4, 5, 6, 8, 10].map((s) => s * p).find((m) => m >= v && Number.isInteger(m / 2))!;
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev) return <small>ยังไม่มียอดให้เทียบ</small>;
  const pct = Math.round(((now - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <small className={`delta ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </small>
  );
}

function Bars({
  data,
  value,
  format,
  caption,
}: {
  data: Point[];
  value: (p: Point) => number;
  format: (n: number) => string;
  caption: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map(value)));
  const ticks = [max, max / 2, 0];
  const last = data.length - 1;

  return (
    <figure className="chart" aria-label={caption}>
      <div className="chart-axis" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t}>{format(t)}</span>
        ))}
      </div>
      <div className="chart-area" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <i key={t} className="chart-grid" style={{ bottom: `${(t / max) * 100}%` }} />
        ))}
        <div
          className="chart-cols"
          style={{
            gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
          }}
        >
          {data.map((p, i) => {
            const v = value(p);
            const h = (v / max) * 100;
            return (
              <button
                key={p.key}
                className={`chart-col${hover === i ? " on" : ""}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${p.label}: ${format(v)}`}
              >
                <span className="chart-bar" style={{ height: `${h}%` }}>
                  {i === last && hover === null && v > 0 && <em className="chart-val">{format(v)}</em>}
                </span>
              </button>
            );
          })}
        </div>
        {hover !== null && (
          <div
            className="chart-tip"
            role="status"
            style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
            data-edge={hover < 2 ? "start" : hover > last - 2 ? "end" : undefined}
          >
            <b>{data[hover].label}</b>
            <span>
              ยอดขาย <strong>{baht(data[hover].revenue)}</strong>
            </span>
            <span>
              ออเดอร์ <strong>{data[hover].orders}</strong> · {data[hover].cups} ชิ้น
            </span>
            <span>
              เฉลี่ยต่อบิล <strong>{baht(avg(data[hover]))}</strong>
            </span>
          </div>
        )}
      </div>
      <i aria-hidden="true" />
      <div
        className="chart-x"
        style={{
          gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
        }}
        aria-hidden="true"
      >
        {data.map((p, i) => (
          <span key={p.key} className={(last - i) % 2 ? "odd" : undefined}>
            {p.short}
          </span>
        ))}
      </div>
    </figure>
  );
}

export default function ReportTab() {
  const [period, setPeriod] = useState<Period>("day");
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [table, setTable] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    fetch(`/api/admin/report?period=${period}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: Report) => live && setData(j))
      .catch(() => live && setError("โหลดรายงานไม่สำเร็จ ลองใหม่อีกครั้ง"));
    return () => {
      live = false;
    };
  }, [period]);

  const meta = PERIODS.find((p) => p.id === period)!;
  const s = data?.series ?? [];
  const cur = s[s.length - 1];
  const prev = s[s.length - 2];
  const sum = s.reduce(
    (a, p) => ({
      revenue: a.revenue + p.revenue,
      orders: a.orders + p.orders,
      cups: a.cups + p.cups,
      discount: a.discount + p.discount,
    }),
    { revenue: 0, orders: 0, cups: 0, discount: 0 },
  );
  const best = s.reduce<Point | null>((b, p) => (p.revenue > (b?.revenue ?? 0) ? p : b), null);
  const topMax = Math.max(1, ...(data?.top ?? []).map((t) => t.qty));

  return (
    <div className="report">
      <div className="seg" role="tablist" aria-label="ช่วงเวลา">
        {PERIODS.map((p) => (
          <button key={p.id} role="tab" aria-selected={period === p.id} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="banner" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="report-loading">กำลังคำนวณยอดขาย…</p>}

      {data && cur && (
        <>
          <div className="stats">
            <div className="stat">
              <span>ยอดขาย{meta.now}</span>
              <b>{baht(cur.revenue)}</b>
              <Delta now={cur.revenue} prev={prev?.revenue ?? 0} />
            </div>
            <div className="stat">
              <span>ออเดอร์{meta.now}</span>
              <b>{cur.orders.toLocaleString()}</b>
              <small>
                {cur.cups} ชิ้น · {meta.prev} {prev?.orders ?? 0} ออเดอร์
              </small>
            </div>
            <div className="stat">
              <span>ยอดรวม {meta.span}</span>
              <b>{baht(sum.revenue)}</b>
              <small>
                {sum.orders.toLocaleString()} ออเดอร์ · เฉลี่ย {baht(avg(sum))}
                /บิล
              </small>
            </div>
            <div className="stat">
              <span>ขายดีที่สุด</span>
              <b>{best ? baht(best.revenue) : "–"}</b>
              <small>{best ? best.label : "ยังไม่มียอดขาย"}</small>
            </div>
          </div>

          <section className="panel">
            <header className="report-head">
              <div>
                <h2>ยอดขาย{meta.label}</h2>
                <p>{meta.span} · นับเฉพาะออเดอร์ที่ยืนยันสลิปแล้ว (หลังหักส่วนลด) · ชี้ที่แท่งเพื่อดูรายละเอียด</p>
              </div>
              <button className="ghost-btn" onClick={() => setTable(!table)} aria-pressed={table}>
                {table ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
              </button>
            </header>
            {table ? (
              <div className="report-table">
                <table>
                  <thead>
                    <tr>
                      <th>ช่วงเวลา</th>
                      <th>ยอดขาย</th>
                      <th>ออเดอร์</th>
                      <th>ชิ้น</th>
                      <th>เฉลี่ย/บิล</th>
                      <th>ส่วนลด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...s].reverse().map((p) => (
                      <tr key={p.key}>
                        <td>{p.label}</td>
                        <td>{baht(p.revenue)}</td>
                        <td>{p.orders}</td>
                        <td>{p.cups}</td>
                        <td>{baht(avg(p))}</td>
                        <td>{p.discount ? baht(p.discount) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>รวม</td>
                      <td>{baht(sum.revenue)}</td>
                      <td>{sum.orders}</td>
                      <td>{sum.cups}</td>
                      <td>{baht(avg(sum))}</td>
                      <td>{sum.discount ? baht(sum.discount) : "–"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <Bars data={s} value={(p) => p.revenue} format={(n) => baht(n)} caption={`กราฟยอดขาย${meta.label}`} />
            )}
          </section>

          <div className="report-grid">
            <section className="panel">
              <header>
                <h2>จำนวนออเดอร์{meta.label}</h2>
                <p>{meta.span}</p>
              </header>
              <Bars data={s} value={(p) => p.orders} format={(n) => n.toLocaleString()} caption={`กราฟจำนวนออเดอร์${meta.label}`} />
            </section>

            <section className="panel">
              <header>
                <h2>เมนูขายดี</h2>
                <p>{meta.span} · เรียงตามจำนวนที่ขายได้</p>
              </header>
              {data.top.length === 0 ? (
                <p className="report-empty">ยังไม่มีรายการขายในช่วงนี้</p>
              ) : (
                <ol className="toplist">
                  {data.top.map((t) => (
                    <li key={t.name}>
                      <div>
                        <span>{t.name}</span>
                        <b>
                          {t.qty} ชิ้น <small>{baht(t.revenue)}</small>
                        </b>
                      </div>
                      <i style={{ width: `${(t.qty / topMax) * 100}%` }} />
                    </li>
                  ))}
                </ol>
              )}

              <h3 className="report-sub">แยกตามวิธีรับ</h3>
              <ul className="svc-split">
                {(Object.keys(SERVICE_LABEL) as Service[]).map((k) => (
                  <li key={k}>
                    <span>{SERVICE_LABEL[k]}</span>
                    <b>{data.services[k]?.orders ?? 0} ออเดอร์</b>
                    <small>{baht(data.services[k]?.revenue ?? 0)}</small>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
