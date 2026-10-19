"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NEXT_STATE, PILLARS, STATE_LABEL, addDays, doneCount, type MkChannel, type MkData, type MkPost, type Pillar, type PostState } from "@/lib/marketing";

const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const DOW = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
const dayNo = (d: string) => Number(d.slice(8));
const thDate = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", ...o });
const blank = (date: string, slot: number): MkPost => ({ post_date: date, slot, title: "", pillar: "menu", format: "", caption: "", status: {}, done_at: {} });

const STATE_ICON: Record<PostState, React.ReactNode> = {
  todo: <circle cx="12" cy="12" r="8" />,
  sched: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </>
  ),
  done: <path d="M5 12.5l4.5 4.5L19 7.5" />,
};

function Chip({ ch, state, at, mini, onClick }: { ch: MkChannel; state: PostState; at?: string; mini?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`mk-ch${mini ? " mini" : ""}`} data-s={state} onClick={onClick} title={`${ch.name}: ${STATE_LABEL[state]}${state === "done" && at ? ` เวลา ${at}` : ""} (กดเพื่อเปลี่ยน)`} aria-label={`${ch.name} ${STATE_LABEL[state]}`}>
      <span className="mk-logo" style={{ background: ch.color }}>
        {ch.short}
      </span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {STATE_ICON[state]}
      </svg>
      {!mini && <span>{STATE_LABEL[state]}</span>}
    </button>
  );
}

function TodayCard({ post, channels, onSave, onChip }: { post: MkPost; channels: MkChannel[]; onSave: (patch: Partial<MkPost>) => void; onChip: (id: string, force?: PostState) => void }) {
  const [title, setTitle] = useState(post.title);
  const [caption, setCaption] = useState(post.caption);
  const [format, setFormat] = useState(post.format);
  const [note, setNote] = useState("");
  useEffect(() => setTitle(post.title), [post.title]);
  useEffect(() => setCaption(post.caption), [post.caption]);
  useEffect(() => setFormat(post.format), [post.format]);
  const done = doneCount(post, channels);
  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setNote("คัดลอกแคปชันแล้ว");
    } catch {
      setNote("คัดลอกไม่ได้ ลองเลือกข้อความแล้วคัดลอกเอง");
    }
    setTimeout(() => setNote(""), 2200);
  }
  return (
    <article className="panel mk-card">
      <h3 className="mk-slot">เรื่องที่ {post.slot} ของวัน</h3>
      <input className="mk-title" value={title} maxLength={120} placeholder="ตั้งหัวข้อคอนเทนต์ หรือเลือกจากคลังไอเดีย" aria-label={`หัวข้อเรื่องที่ ${post.slot}`} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() !== post.title && onSave({ title })} />
      <div className="mk-meta">
        <select className="text" value={post.pillar} aria-label="หมวด" onChange={(e) => onSave({ pillar: e.target.value as Pillar })}>
          {Object.entries(PILLARS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input className="text" value={format} maxLength={40} placeholder="รูปแบบ เช่น Reel, สตอรี่" aria-label="รูปแบบ" onChange={(e) => setFormat(e.target.value)} onBlur={() => format.trim() !== post.format && onSave({ format })} />
      </div>
      <textarea className="mk-cap text" value={caption} maxLength={2200} placeholder="แคปชัน / ข้อความที่จะโพสต์" aria-label="แคปชัน" onChange={(e) => setCaption(e.target.value)} onBlur={() => caption.trim() !== post.caption && onSave({ caption })} />
      <div className="mk-chs">
        {channels.map((c) => (
          <Chip key={c.id} ch={c} state={post.status[c.id] ?? "todo"} at={post.done_at[c.id]} onClick={() => onChip(c.id)} />
        ))}
      </div>
      <div className="mk-row">
        <button type="button" className="btn ghost-sm" onClick={copy} disabled={!caption.trim()}>
          คัดลอกแคปชัน
        </button>
        <button type="button" className="btn ghost-sm" onClick={() => channels.filter((c) => post.status[c.id] !== "done").forEach((c) => onChip(c.id, "done"))} disabled={done === channels.length}>
          ทำเครื่องหมายลงครบทุกช่อง
        </button>
        <span className="mk-count">
          {done}/{channels.length} ช่อง
        </span>
        {note && <span className="mk-note" role="status">{note}</span>}
      </div>
    </article>
  );
}

export default function MarketingTab({ onError, onChanged }: { onError: (s: string) => void; onChanged?: () => void }) {
  const [data, setData] = useState<MkData | null>(null);
  const [tab, setTab] = useState<"today" | "week" | "ideas" | "rules">("today");
  const [week, setWeek] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [idea, setIdea] = useState({ title: "", pillar: "menu" as Pillar, format: "" });
  const [newCh, setNewCh] = useState("");

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2400);
  };

  const load = useCallback(
    async (w: string | null) => {
      const r = await fetch(`/api/admin/marketing${w ? `?week=${w}` : ""}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return onError(j.error ?? "โหลดหน้าการตลาดไม่สำเร็จ");
      setData(j as MkData);
    },
    [onError],
  );
  useEffect(() => {
    load(week);
  }, [load, week]);

  const on = useMemo(() => (data ? data.channels.filter((c) => c.enabled) : []), [data]);
  const get = (date: string, slot: number) => data?.posts.find((p) => p.post_date === date && p.slot === slot) ?? blank(date, slot);

  // บันทึกทันทีบนหน้าจอ แล้วส่งไปเซิร์ฟเวอร์ (พลาดแล้วโหลดใหม่)
  async function save(date: string, slot: number, patch: Partial<MkPost>) {
    if (!data) return;
    const cur = get(date, slot);
    const next: MkPost = { ...cur, ...patch, status: { ...cur.status, ...(patch.status ?? {}) } };
    setData({ ...data, posts: [...data.posts.filter((p) => !(p.post_date === date && p.slot === slot)), next] });
    const r = await fetch("/api/admin/marketing", json("PUT", { date, slot, ...patch }));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error ?? "บันทึกไม่สำเร็จ");
      return load(week);
    }
    setData((d) => (d ? { ...d, posts: [...d.posts.filter((p) => !(p.post_date === date && p.slot === slot)), j as MkPost] } : d));
    onChanged?.();
  }
  const chip = (date: string, slot: number, id: string, force?: PostState) => {
    const cur = get(date, slot).status[id] ?? "todo";
    return save(date, slot, { status: { [id]: force ?? NEXT_STATE[cur] } });
  };

  async function setup(body: unknown, then?: string) {
    const r = await fetch("/api/admin/marketing/setup", json("PUT", body));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return onError(j.error ?? "บันทึกไม่สำเร็จ");
    await load(week);
    onChanged?.();
    if (then) flash(then);
  }

  async function addIdea() {
    if (!idea.title.trim()) return;
    const r = await fetch("/api/admin/marketing/ideas", json("POST", idea));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return onError(j.error ?? "เพิ่มไอเดียไม่สำเร็จ");
    setIdea({ ...idea, title: "", format: "" });
    await load(week);
  }
  async function delIdea(id: number) {
    await fetch(`/api/admin/marketing/ideas?id=${id}`, { method: "DELETE" });
    await load(week);
  }
  // ใส่ไอเดียในช่องว่างถัดไป (ตั้งแต่วันนี้เป็นต้นไป ในสัปดาห์ที่เปิดอยู่)
  async function place(id: number) {
    if (!data) return false;
    const x = data.ideas.find((i) => i.id === id);
    if (!x) return false;
    for (const d of data.days) {
      if (d < data.today) continue;
      for (let s = 1; s <= data.perDay; s++) {
        if (!get(d, s).title) {
          await save(d, s, { title: x.title, pillar: x.pillar, format: x.format });
          await fetch(`/api/admin/marketing/ideas?id=${id}`, { method: "DELETE" });
          setData((cur) => (cur ? { ...cur, ideas: cur.ideas.filter((i) => i.id !== id) } : cur));
          return true;
        }
      }
    }
    return false;
  }

  if (!data) return <p className="mk-empty">กำลังโหลด…</p>;

  const inWeek = data.days.includes(data.today);
  const todayPosts = Array.from({ length: data.perDay }, (_, i) => get(data.today, i + 1));
  const total = on.length;
  const todayDone = todayPosts.reduce((n, p) => n + doneCount(p, on), 0);
  const todayLeft = todayPosts.filter((p) => doneCount(p, on) < total).length;
  let wd = 0;
  let wa = 0;
  for (const d of data.days) {
    if (d > data.today) continue;
    for (let s = 1; s <= data.perDay; s++) {
      wd += doneCount(get(d, s), on);
      wa += total;
    }
  }
  const worst = on
    .map((c) => ({ c, n: data.days.filter((d) => d <= data.today).reduce((n, d) => n + Array.from({ length: data.perDay }, (_, i) => get(d, i + 1)).filter((p) => p.status[c.id] !== "done").length, 0) }))
    .sort((a, b) => b.n - a.n)[0];
  const pct = wa ? Math.round((wd / wa) * 100) : 0;

  return (
    <div className="mk">
      <div className="mk-stats">
        <div>
          <small>วันนี้ลงแล้ว</small>
          <b>{inWeek ? `${todayDone}/${total * data.perDay}` : "-"}</b>
          <span>{inWeek ? (todayLeft ? `เหลืออีก ${todayLeft} เรื่องที่ยังลงไม่ครบช่อง` : "ครบทุกเรื่องแล้ว เยี่ยมมาก") : "ดูสัปดาห์อื่นอยู่"}</span>
        </div>
        <div>
          <small>สัปดาห์นี้ทำตามแผน</small>
          <b>{pct}%</b>
          <span>
            {wd} จาก {wa} โพสต์ (จนถึงวันนี้)
          </span>
          <i className="mk-bar">
            <u style={{ width: `${pct}%` }} />
          </i>
        </div>
        <div>
          <small>ช่องที่ค้างมากสุด</small>
          <b className="sm">{worst && worst.n > 0 ? worst.c.name : "ไม่มี"}</b>
          <span>{worst && worst.n > 0 ? `ค้าง ${worst.n} โพสต์` : "ทำครบตามแผน"}</span>
        </div>
      </div>

      <div className="mk-tabs" role="tablist">
        {(
          [
            ["today", "วันนี้"],
            ["week", "ตารางสัปดาห์"],
            ["ideas", `คลังไอเดีย (${data.ideas.length})`],
            ["rules", "ตั้งกติกา"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {msg && <p className="mk-flash" role="status">{msg}</p>}

      {(tab === "today" || tab === "week") && (
        <p className="mk-legend">
          <span>○ ยังไม่ลง</span>
          <span>◷ ตั้งเวลาแล้ว</span>
          <span>✓ ลงแล้ว</span>
          <span>กดที่ช่องทางเพื่อเปลี่ยนสถานะ</span>
        </p>
      )}

      {tab === "today" &&
        (inWeek ? (
          todayPosts.map((p) => <TodayCard key={p.slot} post={p} channels={on} onSave={(patch) => save(data.today, p.slot, patch)} onChip={(id, f) => chip(data.today, p.slot, id, f)} />)
        ) : (
          <p className="mk-empty">
            กำลังดูสัปดาห์อื่นอยู่{" "}
            <button className="btn ghost-sm" onClick={() => setWeek(null)}>
              กลับไปสัปดาห์นี้
            </button>
          </p>
        ))}

      {tab === "week" && (
        <>
          <div className="mk-weeknav">
            <button className="btn ghost-sm" onClick={() => setWeek(addDays(data.weekStart, -7))} aria-label="สัปดาห์ก่อนหน้า">
              ‹ สัปดาห์ก่อน
            </button>
            <b>
              {thDate(data.days[0], { day: "numeric", month: "short" })} – {thDate(data.days[6], { day: "numeric", month: "short" })}
            </b>
            <button className="btn ghost-sm" onClick={() => setWeek(addDays(data.weekStart, 7))} aria-label="สัปดาห์ถัดไป">
              สัปดาห์ถัดไป ›
            </button>
            {!inWeek && (
              <button className="btn ghost-sm" onClick={() => setWeek(null)}>
                วันนี้
              </button>
            )}
          </div>
          <div className="mk-wk">
            <table>
              <thead>
                <tr>
                  <th>วัน</th>
                  {Array.from({ length: data.perDay }, (_, i) => (
                    <th key={i}>เรื่องที่ {i + 1}</th>
                  ))}
                  <th>ลงแล้ว</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d, di) => {
                  const posts = Array.from({ length: data.perDay }, (_, i) => get(d, i + 1));
                  const dd = posts.reduce((n, p) => n + doneCount(p, on), 0);
                  const miss = d < data.today && dd < total * data.perDay;
                  return (
                    <tr key={d} className={d === data.today ? "today" : ""}>
                      <td className="mk-day">
                        {DOW[di]} {dayNo(d)}
                        <small>{d === data.today ? "วันนี้" : d < data.today ? "ผ่านมาแล้ว" : "วางแผน"}</small>
                      </td>
                      {posts.map((p) => (
                        <td key={p.slot}>
                          <WeekTitle value={p.title} onSave={(title) => save(d, p.slot, { title })} />
                          <div className="mk-chs sm">
                            {on.map((c) => (
                              <Chip key={c.id} ch={c} mini state={p.status[c.id] ?? "todo"} at={p.done_at[c.id]} onClick={() => chip(d, p.slot, c.id)} />
                            ))}
                          </div>
                        </td>
                      ))}
                      <td className={`mk-sum${miss ? " miss" : ""}`}>
                        {dd}/{total * data.perDay}
                        {miss && <small>ค้างอยู่</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "ideas" && (
        <>
          <form
            className="mk-add"
            onSubmit={(e) => {
              e.preventDefault();
              addIdea();
            }}
          >
            <input className="text" value={idea.title} maxLength={120} placeholder="จดไอเดียใหม่ เช่น เมนูตามฤดูกาล" aria-label="ไอเดียใหม่" onChange={(e) => setIdea({ ...idea, title: e.target.value })} />
            <select className="text" value={idea.pillar} aria-label="หมวด" onChange={(e) => setIdea({ ...idea, pillar: e.target.value as Pillar })}>
              {Object.entries(PILLARS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="btn primary-sm" disabled={!idea.title.trim()}>
              เพิ่มไอเดีย
            </button>
            <button
              type="button"
              className="btn ghost-sm"
              disabled={!data.ideas.length}
              onClick={async () => {
                let n = 0;
                for (const i of [...data.ideas].reverse()) {
                  if (await place(i.id)) n++;
                  else break;
                }
                flash(n ? `เติมให้ ${n} เรื่อง` : "ไม่มีช่องว่างให้เติมในสัปดาห์นี้");
              }}
            >
              เติมช่องว่างในตารางจากคลังไอเดีย
            </button>
          </form>
          {data.ideas.length === 0 && <p className="mk-empty">ยังไม่มีไอเดีย จดไว้ตอนนึกออก แล้วค่อยหยิบมาใส่ตาราง</p>}
          <div className="mk-ideas">
            {data.ideas.map((x) => (
              <article key={x.id} className="panel">
                <span className="mk-pill">{PILLARS[x.pillar]}</span>
                <b>{x.title}</b>
                <div className="mk-row">
                  <button
                    className="btn ghost-sm"
                    onClick={async () => flash((await place(x.id)) ? "ใส่ในตารางแล้ว" : "สัปดาห์นี้ไม่มีช่องว่างแล้ว")}
                  >
                    ใส่ในช่องว่างถัดไป
                  </button>
                  <button className="btn ghost-sm" onClick={() => delIdea(x.id)} aria-label="ลบไอเดีย">
                    ลบ
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === "rules" && (
        <div className="mk-rules">
          <section className="panel">
            <h3>เป้าหมายต่อวัน</h3>
            <p className="mk-hint">ตารางสัปดาห์จะแสดงจำนวนเรื่องต่อวันตามนี้</p>
            <div className="mk-row">
              <span>ทุกวันต้องลง</span>
              <span className="mk-step">
                <button type="button" aria-label="ลด" onClick={() => data.perDay > 1 && setup({ perDay: data.perDay - 1 })}>
                  −
                </button>
                <output>{data.perDay}</output>
                <button type="button" aria-label="เพิ่ม" onClick={() => data.perDay < 10 && setup({ perDay: data.perDay + 1 })}>
                  +
                </button>
              </span>
              <span>เรื่อง</span>
            </div>
          </section>
          <section className="panel">
            <h3>ช่องทางที่ลง</h3>
            <p className="mk-hint">เปิดเฉพาะช่องที่ร้านใช้จริง เพิ่มช่องใหม่ได้เอง</p>
            {data.channels.map((c) => (
              <label key={c.id} className="row">
                <span className="mk-chname">
                  <span className="mk-logo" style={{ background: c.color }}>
                    {c.short}
                  </span>
                  {c.name}
                </span>
                <input type="checkbox" checked={c.enabled} onChange={(e) => setup({ channel: { id: c.id, enabled: e.target.checked } })} />
              </label>
            ))}
            <form
              className="mk-add"
              onSubmit={(e) => {
                e.preventDefault();
                if (newCh.trim()) setup({ addChannel: newCh }, `เพิ่มช่อง ${newCh.trim()} แล้ว`).then(() => setNewCh(""));
              }}
            >
              <input className="text" value={newCh} maxLength={30} placeholder="ชื่อช่องใหม่ เช่น Shopee Live, Lemon8" aria-label="ชื่อช่องทางใหม่" onChange={(e) => setNewCh(e.target.value)} />
              <button className="btn primary-sm" disabled={!newCh.trim()}>
                เพิ่มช่อง
              </button>
            </form>
          </section>
          <section className="panel mk-soon">
            <h3>กำลังจะมา</h3>
            <ul>
              <li>ผู้ช่วย AI ร่างแคปชันและคิดไอเดีย</li>
              <li>เตือนทาง LINE ถ้าวันนี้ยังลงไม่ครบ</li>
              <li>ลิงก์ติดตามว่าช่องไหนพาลูกค้ามาสั่ง</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function WeekTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input className="mk-wtitle" value={v} maxLength={120} placeholder="ยังไม่ตั้งหัวข้อ" aria-label="หัวข้อ" onChange={(e) => setV(e.target.value)} onBlur={() => v.trim() !== value && onSave(v)} />;
}
