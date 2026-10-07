"use client";

import { useEffect, useState } from "react";
import { SERVICE_LABEL, type Service } from "@/lib/menu";
import ReviewsPanel from "./ReviewsPanel";

type Period = "day" | "week" | "month";
type Point = {
  key: string;
  label: string;
  short: string;
  revenue: number;
  orders: number;
  cups: number;
  discount: number;
  visitors: number;
  cost: number; // ต้นทุนของรายการที่ใส่ต้นทุนไว้แล้ว
  profit: number; // ยอดขาย (หลังหักส่วนลด) − ต้นทุน
  noCost: number; // ยอดของรายการที่ยังไม่ได้ใส่ต้นทุน
};
type Missing = { name: string; source: "menu" | "bar"; qty: number; revenue: number };
type Report = {
  period: Period;
  series: Point[];
  funnel: { visit: number; view_item: number; add_cart: number; order: number } | null;
  memberVisitors: number;
  trackingSince: string | null;
  top: { name: string; qty: number; revenue: number }[];
  services: Record<Service, { orders: number; revenue: number }>;
  channels?: Record<"line" | "pos_qr" | "pos_cash", { orders: number; revenue: number }>;
  missingCost?: Missing[];
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// กราฟแท่งคู่ ยอดขาย (เขียว) กับกำไร (ทอง) แกนเงินบาทเดียวกัน · ชี้ที่คู่แท่งเพื่อดูต้นทุนและ % กำไร
function PairBars({ data, caption }: { data: Point[]; caption: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...data.map((p) => p.revenue)));
  const ticks = [max, max / 2, 0];
  const last = data.length - 1;
  const h = (v: number) => `${(Math.max(0, v) / max) * 100}%`;
  const p = hover !== null ? data[hover] : null;
  return (
    <figure className="chart pchart" aria-label={caption}>
      <div className="chart-axis" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t}>{baht(t)}</span>
        ))}
      </div>
      <div className="chart-area" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <i key={t} className="chart-grid" style={{ bottom: `${(t / max) * 100}%` }} />
        ))}
        <div className="chart-cols" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((d, i) => (
            <button
              key={d.key}
              className={`chart-col${hover === i ? " on" : ""}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${d.label}: ยอดขาย ${baht(d.revenue)} กำไร ${baht(d.profit)}`}
            >
              <span className="pchart-pair">
                <span className="chart-bar sales" style={{ height: h(d.revenue) }}>
                  {i === last && hover === null && d.revenue > 0 && <em className="chart-val">{baht(d.revenue)}</em>}
                </span>
                <span className="chart-bar profit" style={{ height: h(d.profit) }}>
                  {i === last && hover === null && d.revenue > 0 && <em className="chart-val">{baht(d.profit)}</em>}
                </span>
              </span>
            </button>
          ))}
        </div>
        {p && hover !== null && (
          <div
            className="chart-tip"
            role="status"
            style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
            data-edge={hover < 2 ? "start" : hover > last - 2 ? "end" : undefined}
          >
            <b>{p.label}</b>
            <span>
              <i className="pchart-key sales" /> ยอดขาย <strong>{baht(p.revenue)}</strong>
            </span>
            <span>
              ต้นทุน <strong>{baht(p.cost)}</strong>
            </span>
            <span>
              <i className="pchart-key profit" /> กำไร <strong>{baht(p.profit)}</strong> ({pct(p.profit, p.revenue)}%)
            </span>
            {p.noCost > 0 && <span>ยังไม่มีต้นทุน {baht(p.noCost)}</span>}
          </div>
        )}
      </div>
      <i aria-hidden="true" />
      <div className="chart-x" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.key} className={(last - i) % 2 ? "odd" : undefined}>
            {d.short}
          </span>
        ))}
      </div>
    </figure>
  );
}

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
  tip,
}: {
  data: Point[];
  value: (p: Point) => number;
  format: (n: number) => string;
  caption: string;
  tip?: (p: Point) => React.ReactNode; // เนื้อหาในกล่องเมื่อชี้ที่แท่ง (ไม่ใส่ = แสดงยอดขาย)
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
            {tip ? (
              tip(data[hover])
            ) : (
              <>
                <span>
                  ยอดขาย <strong>{baht(data[hover].revenue)}</strong>
                </span>
                <span>
                  ออเดอร์ <strong>{data[hover].orders}</strong> · {data[hover].cups} ชิ้น
                </span>
                <span>
                  เฉลี่ยต่อบิล <strong>{baht(avg(data[hover]))}</strong>
                </span>
              </>
            )}
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
  const [ptable, setPtable] = useState(false);

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
      cost: a.cost + (p.cost ?? 0),
      profit: a.profit + (p.profit ?? 0),
      noCost: a.noCost + (p.noCost ?? 0),
    }),
    { revenue: 0, orders: 0, cups: 0, discount: 0, cost: 0, profit: 0, noCost: 0 },
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

          <section className="panel">
            <header className="report-head">
              <div>
                <h2>ยอดขาย เทียบ กำไร{meta.label}</h2>
                <p>{meta.span} · กำไร = ยอดขายหลังหักส่วนลด − ต้นทุนวัตถุดิบตามสูตรในแท็บต้นทุน</p>
              </div>
              <button className="ghost-btn" onClick={() => setPtable(!ptable)} aria-pressed={ptable}>
                {ptable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
              </button>
            </header>
            <div className="pl-sum">
              <div>
                <span><i className="pchart-key sales" /> ยอดขาย{meta.now}</span>
                <b>{baht(cur.revenue)}</b>
              </div>
              <div>
                <span><i className="pchart-key profit" /> กำไร{meta.now}</span>
                <b>{baht(cur.profit ?? 0)}</b>
                <small>ทุก ฿100 ที่ขาย เหลือกำไร ฿{pct(cur.profit ?? 0, cur.revenue)}</small>
              </div>
              <div>
                <span>ต้นทุน{meta.now}</span>
                <b>{baht(cur.cost ?? 0)}</b>
              </div>
              <div>
                <span>กำไรรวม {meta.span}</span>
                <b>{baht(sum.profit)}</b>
                <small>{pct(sum.profit, sum.revenue)}% ของยอดขาย {baht(sum.revenue)}</small>
              </div>
            </div>
            <div className="pl-legend" aria-hidden="true">
              <span><i className="pchart-key sales" /> ยอดขาย</span>
              <span><i className="pchart-key profit" /> กำไร</span>
            </div>
            {ptable ? (
              <div className="report-table">
                <table>
                  <thead>
                    <tr>
                      <th>ช่วงเวลา</th>
                      <th>ยอดขาย</th>
                      <th>ต้นทุน</th>
                      <th>กำไร</th>
                      <th>% กำไร</th>
                      <th>ยังไม่มีต้นทุน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...s].reverse().map((p) => (
                      <tr key={p.key}>
                        <td>{p.label}</td>
                        <td>{baht(p.revenue)}</td>
                        <td>{baht(p.cost ?? 0)}</td>
                        <td>{baht(p.profit ?? 0)}</td>
                        <td>{p.revenue ? `${pct(p.profit ?? 0, p.revenue)}%` : "–"}</td>
                        <td>{p.noCost ? baht(p.noCost) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>รวม</td>
                      <td>{baht(sum.revenue)}</td>
                      <td>{baht(sum.cost)}</td>
                      <td>{baht(sum.profit)}</td>
                      <td>{sum.revenue ? `${pct(sum.profit, sum.revenue)}%` : "–"}</td>
                      <td>{sum.noCost ? baht(sum.noCost) : "–"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <PairBars data={s} caption={`กราฟยอดขายเทียบกำไร${meta.label}`} />
            )}
            {sum.noCost > 0 && (
              <div className="pl-missing" role="note">
                <b>ยอด {baht(sum.noCost)} ยังไม่มีต้นทุน กำไรจริงจะต่ำกว่าที่เห็น</b>
                <p>ใส่ต้นทุนเพิ่ม: เมนูมัทฉะ › แท็บต้นทุน &amp; กำไร (สูตรต่อเมนู) · มาม่าบาร์ › ของในบาร์ › แก้ไข › ต้นทุน/ชิ้น</p>
                {!!data.missingCost?.length && (
                  <ul>
                    {data.missingCost.map((m) => (
                      <li key={m.source + m.name}>
                        <span className={`pl-src ${m.source}`}>{m.source === "bar" ? "มาม่าบาร์" : "เมนู"}</span>
                        {m.name}
                        <small>
                          ขาย {m.qty} · {baht(m.revenue)}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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

              {data.channels && (
                <>
                  <h3 className="report-sub">แยกตามช่องทางและวิธีรับเงิน</h3>
                  <ul className="svc-split">
                    {(
                      [
                        ["line", "สั่งผ่าน LINE · โอน"],
                        ["pos_qr", "หน้าร้าน · QR"],
                        ["pos_cash", "หน้าร้าน · เงินสด"],
                      ] as const
                    ).map(([k, t]) => (
                      <li key={k}>
                        <span>{t}</span>
                        <b>{data.channels![k].orders} ออเดอร์</b>
                        <small>{baht(data.channels![k].revenue)}</small>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <Visitors data={data} meta={meta} />
          <ReviewsPanel />
        </>
      )}
    </div>
  );
}

// ผู้เข้าชมหน้าเว็บลูกค้า: คนต่อช่วงเวลา + ขั้นตอน เข้าเว็บ → ดูเมนู → ใส่ตะกร้า → สั่ง
const STEPS = [
  { id: "visit", label: "เข้าหน้าเว็บ" },
  { id: "view_item", label: "กดดูเมนู" },
  { id: "add_cart", label: "ใส่ตะกร้า" },
  { id: "order", label: "สั่งสำเร็จ" },
] as const;

function Visitors({ data, meta }: { data: Report; meta: (typeof PERIODS)[number] }) {
  const s = data.series;
  const cur = s[s.length - 1];
  const prev = s[s.length - 2];
  const f = data.funnel;
  return (
    <section className="panel">
      <header>
        <h2>ผู้เข้าชมหน้าเว็บลูกค้า</h2>
        <p>
          นับเป็นคน (คนเดิมเข้าหลายรอบในช่วงเดียวกันนับ 1) · หน้าสั่งและบัตรสมาชิก
        </p>
        {data.trackingSince && (
          <p className="vis-since">
            เริ่มนับเมื่อ{" "}
            {new Date(data.trackingSince).toLocaleString("th-TH", {
              timeZone: "Asia/Bangkok",
              day: "numeric",
              month: "short",
              year: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            น. — ออเดอร์ก่อนเวลานี้ยังนับในยอดขาย แต่ไม่อยู่ในสถิติผู้เข้าชม
          </p>
        )}
      </header>
      {!f ? (
        <p className="report-empty">ยังไม่ได้เปิดใช้การนับผู้เข้าชม (รัน migration-017 ก่อน)</p>
      ) : (
        <>
          <div className="vis-now">
            <div>
              <small>ผู้เข้าชม{meta.now}</small>
              <b>{cur.visitors.toLocaleString()} คน</b>
              <Delta now={cur.visitors} prev={prev?.visitors ?? 0} />
            </div>
            <div>
              <small>{meta.prev}</small>
              <b>{(prev?.visitors ?? 0).toLocaleString()} คน</b>
            </div>
            <div>
              <small>เปิดบัตรสมาชิก ({meta.span})</small>
              <b>{data.memberVisitors.toLocaleString()} คน</b>
            </div>
          </div>
          <Bars
            data={s}
            value={(p) => p.visitors}
            format={(n) => n.toLocaleString()}
            caption={`กราฟผู้เข้าชม${meta.label}`}
            tip={(p) => (
              <>
                <span>
                  ผู้เข้าชม <strong>{p.visitors} คน</strong>
                </span>
                <span>
                  ออเดอร์ <strong>{p.orders}</strong>
                </span>
              </>
            )}
          />
          <h3 className="report-sub">
            ลูกค้าไปถึงขั้นไหน ({meta.span})
          </h3>
          <ol className="funnel">
            {STEPS.map((st, i) => {
              const n = f[st.id];
              const pct = f.visit ? Math.round((n / f.visit) * 100) : 0;
              const prevStep = i > 0 ? f[STEPS[i - 1].id] : 0;
              return (
                <li key={st.id}>
                  <div>
                    <span>{st.label}</span>
                    <b>
                      {n.toLocaleString()} คน <small>{pct}%</small>
                    </b>
                  </div>
                  <i style={{ width: `${Math.max(pct, n ? 2 : 0)}%` }} />
                  {i > 0 && prevStep > 0 && prevStep > n && <em>หลุดจากขั้นก่อน {(prevStep - n).toLocaleString()} คน</em>}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
