"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  NEXT_STATE,
  PILLARS,
  PSYCH,
  STATE_LABEL,
  addDays,
  composeCaption,
  goalLabel,
  linkProblem,
  doneCount,
  dowMon,
  shiftMonth,
  type MkChannel,
  type GoalMetric,
  type GoalPeriod,
  type MkClaim,
  type MkData,
  type MkGoalProgress,
  type MkPost,
  type Pillar,
  type PostState,
} from "@/lib/marketing";

// หน้าการตลาด v2: ปฏิทินรายเดือน (จุดสถานะต่อช่องทาง) + แผงรายละเอียดวัน + คลังไอเดียลากวาง · มุมมอง วันนี้ / ปฏิทิน / บอร์ด / ตั้งค่า

const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const DOW = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
const thDate = (d: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${d}T12:00:00+07:00`).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    ...o,
  });
const dayLabel = (d: string) =>
  `${DOW[dowMon(d)]} ${thDate(d, { day: "numeric", month: "short" })}`;
const blank = (date: string, slot: number): MkPost => ({
  post_date: date,
  slot,
  title: "",
  pillar: "menu",
  format: "",
  caption: "",
  body: "",
  psychology: "",
  visual: "",
  cta: "",
  hashtags: "",
  captions: {},
  links: {},
  status: {},
  done_at: {},
});
type View = "today" | "cal" | "board" | "rules";
// ช่องทางที่จำกัดความยาว (นับรวมแฮชแท็ก)
const LIMITS: Record<string, number> = { x: 280 };

function Dots({ post, channels }: { post: MkPost; channels: MkChannel[] }) {
  return (
    <span className="mk-dots">
      {channels.map((c) => {
        const s = post.status[c.id] ?? "todo";
        return (
          <i
            key={c.id}
            className="mk-dot"
            data-s={s}
            style={{ ["--c" as string]: c.color }}
            title={`${c.name}: ${STATE_LABEL[s]}`}
          />
        );
      })}
    </span>
  );
}

function Logo({ c, size = 24 }: { c: MkChannel; size?: number }) {
  return (
    <span
      className="mk-logo"
      style={{
        background: c.color,
        width: size,
        height: size,
        flexBasis: size,
      }}
    >
      {c.short}
    </span>
  );
}

// ช่องข้อความที่บันทึกตอนออกจากช่อง (ไม่ยิงทุกตัวอักษร)
function Field({
  label,
  value,
  onSave,
  multi,
  max,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  multi?: boolean;
  max: number;
  placeholder?: string;
  rows?: number;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const done = () => v.trim() !== value && onSave(v);
  return (
    <label className="mk-f">
      <span>{label}</span>
      {multi ? (
        <textarea
          className="text"
          rows={rows ?? 3}
          value={v}
          maxLength={max}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          onBlur={done}
        />
      ) : (
        <input
          className="text"
          value={v}
          maxLength={max}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          onBlur={done}
        />
      )}
    </label>
  );
}

async function copyText(text: string, set: (s: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    set("คัดลอกแล้ว");
  } catch {
    set("คัดลอกไม่ได้ ลองเลือกข้อความเอง");
  }
  setTimeout(() => set(""), 2000);
}

// แคปชันของช่องหนึ่ง (เขียนแยกได้ ว่าง = ใช้แคปชันหลัก) + ตัวนับ + คัดลอกพร้อมแฮชแท็ก
function ChannelCaption({
  post,
  c,
  brandTags,
  onSave,
}: {
  post: MkPost;
  c: MkChannel;
  brandTags: string;
  onSave: (patch: Partial<MkPost>) => void;
}) {
  const own = post.captions[c.id] ?? "";
  const [v, setV] = useState(own);
  const [note, setNote] = useState("");
  useEffect(() => setV(own), [own]);
  const full = composeCaption(
    { ...post, captions: { ...post.captions, [c.id]: v } },
    c.id,
    brandTags,
  );
  const limit = LIMITS[c.id];
  return (
    <details className="mk-cc">
      <summary>
        แคปชัน {c.name}
        <small>{own ? "เขียนแยกแล้ว" : "ใช้แคปชันหลัก"}</small>
      </summary>
      <textarea
        className="text"
        rows={3}
        value={v}
        maxLength={2200}
        placeholder={`เว้นว่าง = ใช้แคปชันหลัก${limit ? ` · ไม่เกิน ${limit} ตัวอักษรรวมแฮชแท็ก` : ""}`}
        aria-label={`แคปชันสำหรับ ${c.name}`}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v.trim() !== own && onSave({ captions: { [c.id]: v } })}
      />
      <div className="mk-row">
        <span
          className={`mk-cnt${limit && full.length > limit ? " over" : ""}`}
        >
          {full.length}
          {limit ? `/${limit}` : ""} ตัวอักษร (รวมแฮชแท็ก)
        </span>
        <button
          type="button"
          className="btn ghost-sm"
          disabled={!full}
          onClick={() => copyText(full, setNote)}
        >
          คัดลอกพร้อมแฮชแท็ก
        </button>
        {c.url && (
          <a
            className="btn ghost-sm"
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            เปิด {c.name} ร้าน ↗
          </a>
        )}
        {note && <span className="mk-note">{note}</span>}
      </div>
    </details>
  );
}

// การ์ดเรื่องในแผงรายละเอียดวัน
function PostEditor({
  post,
  channels,
  brandTags,
  onSave,
}: {
  post: MkPost;
  channels: MkChannel[];
  brandTags: string;
  onSave: (patch: Partial<MkPost>) => void;
}) {
  const [title, setTitle] = useState(post.title);
  const [format, setFormat] = useState(post.format);
  useEffect(() => setTitle(post.title), [post.title]);
  useEffect(() => setFormat(post.format), [post.format]);
  return (
    <div className="mk-post">
      <h3>เรื่องที่ {post.slot}</h3>
      <input
        className="mk-ti"
        value={title}
        maxLength={120}
        placeholder="หัวข้อโพสต์ (Hook ดึงความสนใจใน 1 บรรทัด)"
        aria-label={`หัวข้อเรื่องที่ ${post.slot}`}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() !== post.title && onSave({ title })}
      />
      <div className="mk-meta">
        <select
          className="text"
          value={post.pillar}
          aria-label="หมวด"
          onChange={(e) => onSave({ pillar: e.target.value as Pillar })}
        >
          {Object.entries(PILLARS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          className="text"
          value={format}
          maxLength={40}
          placeholder="รูปแบบ เช่น Reel"
          aria-label="รูปแบบ"
          onChange={(e) => setFormat(e.target.value)}
          onBlur={() => format.trim() !== post.format && onSave({ format })}
        />
      </div>
      <label className="mk-f">
        <span>หลักจิตวิทยาที่ใช้</span>
        <select
          className="text"
          value={post.psychology}
          onChange={(e) => onSave({ psychology: e.target.value })}
        >
          <option value="">— ไม่ระบุ —</option>
          {Object.entries(PSYCH).map(([k, v]) => (
            <option key={k} value={k}>
              {k} · {v}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="เนื้อเรื่อง / คำอธิบาย"
        multi
        rows={4}
        max={3000}
        value={post.body}
        placeholder="เล่าเรื่องจริงของร้าน ให้คุณค่าก่อนขาย 3–6 บรรทัด"
        onSave={(body) => onSave({ body })}
      />
      <Field
        label="ไอเดียภาพ / ช็อตที่ต้องถ่าย"
        multi
        rows={3}
        max={1500}
        value={post.visual}
        placeholder="เช่น 1) เทผงมัทฉะ 2) ตีฟอง 3) เทนม + ข้อความบนภาพ"
        onSave={(visual) => onSave({ visual })}
      />
      <Field
        label="CTA (ชวนทำอะไร 1 อย่าง)"
        max={200}
        value={post.cta}
        placeholder="เช่น สั่งล่วงหน้าผ่าน LINE ไม่ต้องรอคิว"
        onSave={(cta) => onSave({ cta })}
      />
      <Field
        label="แคปชันหลัก (ใช้กับทุกช่องที่ไม่ได้เขียนแยก)"
        multi
        rows={4}
        max={2200}
        value={post.caption}
        placeholder="แคปชัน / ข้อความที่จะโพสต์"
        onSave={(caption) => onSave({ caption })}
      />
      <Field
        label="แฮชแท็กของโพสต์นี้"
        max={500}
        value={post.hashtags}
        placeholder="#มัทฉะ #matchalatte #กรุงเทพนนท์"
        onSave={(hashtags) => onSave({ hashtags })}
      />
      {brandTags && (
        <p className="mk-tags">แฮชแท็กแบรนด์ที่เติมให้ทุกโพสต์: {brandTags}</p>
      )}
      <div className="mk-chl">
        {channels.map((c) => {
          const s = post.status[c.id] ?? "todo";
          return (
            <div key={c.id} className="mk-cr">
              <span className="mk-cn">
                <Logo c={c} />
                {c.name}
                {s === "done" && post.done_at[c.id] && (
                  <small>{post.done_at[c.id]}</small>
                )}
              </span>
              <span className="mk-st3" role="group" aria-label={c.name}>
                {(["todo", "sched", "done"] as PostState[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    data-v={v}
                    aria-pressed={s === v}
                    onClick={() => s !== v && onSave({ status: { [c.id]: v } })}
                  >
                    {STATE_LABEL[v]}
                  </button>
                ))}
              </span>
              <PostLink post={post} c={c} onSave={onSave} />
              <ChannelCaption
                post={post}
                c={c}
                brandTags={brandTags}
                onSave={onSave}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MarketingTab({
  onError,
  onChanged,
}: {
  onError: (s: string) => void;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<MkData | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [view, setView] = useState<View>("cal");
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [pick, setPick] = useState<number | null>(null); // ไอเดียที่กำลังจะวางลงวัน (โหมดแตะ)
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [idea, setIdea] = useState("");
  const [newCh, setNewCh] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2600);
  };
  const load = useCallback(
    async (m: string | null) => {
      const r = await fetch(`/api/admin/marketing${m ? `?month=${m}` : ""}`, {
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return onError(j.error ?? "โหลดหน้าการตลาดไม่สำเร็จ");
      setData(j as MkData);
    },
    [onError],
  );
  useEffect(() => {
    load(month);
  }, [load, month]);
  // เป้าหมายรายสัปดาห์/รายเดือน (คำนวณที่เซิร์ฟเวอร์ ถึงวันนี้)
  const [goals, setGoals] = useState<{
    goals: MkGoalProgress[];
    claims: MkClaim[];
  } | null>(null);
  const loadGoals = useCallback(async () => {
    const r = await fetch("/api/admin/marketing/goals", { cache: "no-store" });
    if (r.ok) setGoals(await r.json());
  }, []);
  useEffect(() => {
    loadGoals();
  }, [loadGoals]);
  async function goalCall(method: string, body?: unknown, q = "") {
    const r = await fetch(
      `/api/admin/marketing/goals${q}`,
      body === undefined ? { method } : json(method, body),
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error ?? "บันทึกไม่สำเร็จ");
      return false;
    }
    setGoals(j);
    return true;
  }
  useEffect(() => {
    const esc = (e: KeyboardEvent) =>
      e.key === "Escape" && (setSel(null), setPick(null));
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const on = useMemo(
    () => (data ? data.channels.filter((c) => c.enabled) : []),
    [data],
  );
  const get = (date: string, slot: number) =>
    data?.posts.find((p) => p.post_date === date && p.slot === slot) ??
    blank(date, slot);
  const slotsOf = (date: string) =>
    Array.from({ length: data?.perDay ?? 0 }, (_, i) => get(date, i + 1));

  // บันทึกบนหน้าจอทันที แล้วส่งไปเซิร์ฟเวอร์ (พลาดแล้วโหลดใหม่)
  async function save(date: string, slot: number, patch: Partial<MkPost>) {
    if (!data) return;
    const cur = get(date, slot);
    const next: MkPost = {
      ...cur,
      ...patch,
      status: { ...cur.status, ...(patch.status ?? {}) },
      captions: { ...cur.captions, ...(patch.captions ?? {}) },
      links: { ...cur.links, ...(patch.links ?? {}) },
    };
    const put = (p: MkPost) => (d: MkData | null) =>
      d
        ? {
            ...d,
            posts: [
              ...d.posts.filter(
                (x) => !(x.post_date === date && x.slot === slot),
              ),
              p,
            ],
          }
        : d;
    setData(put(next));
    const r = await fetch(
      "/api/admin/marketing",
      json("PUT", { date, slot, ...patch }),
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error ?? "บันทึกไม่สำเร็จ");
      return load(month);
    }
    setData(put(j as MkPost));
    onChanged?.();
    if (patch.status || patch.links) loadGoals();
  }
  async function setup(body: unknown, then?: string) {
    const r = await fetch("/api/admin/marketing/setup", json("PUT", body));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return onError(j.error ?? "บันทึกไม่สำเร็จ");
    await load(month);
    onChanged?.();
    if (then) flash(then);
  }
  async function addIdea() {
    if (!idea.trim()) return;
    const r = await fetch(
      "/api/admin/marketing/ideas",
      json("POST", { title: idea }),
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return onError(j.error ?? "เพิ่มไอเดียไม่สำเร็จ");
    setIdea("");
    await load(month);
  }
  async function delIdea(id: number) {
    await fetch(`/api/admin/marketing/ideas?id=${id}`, { method: "DELETE" });
    setData((d) =>
      d ? { ...d, ideas: d.ideas.filter((i) => i.id !== id) } : d,
    );
  }
  // วางไอเดียลงช่องว่างแรกของวันนั้น
  async function place(id: number, date: string) {
    if (!data) return;
    const x = data.ideas.find((i) => i.id === id);
    const free = slotsOf(date).find((p) => !p.title);
    setPick(null);
    if (!x) return;
    if (!free)
      return flash(
        `${dayLabel(date)} ครบ ${data.perDay} เรื่องแล้ว เลือกวันอื่นนะ`,
      );
    await save(date, free.slot, {
      title: x.title,
      pillar: x.pillar,
      format: x.format,
    });
    await delIdea(id);
    flash(`วาง “${x.title}” ลง ${dayLabel(date)} แล้ว`);
  }

  if (!data) return <p className="mk-empty">กำลังโหลด…</p>;

  const total = on.length;
  const inMonth = data.days.includes(data.today);
  const todayPosts = slotsOf(data.today);
  const titled = (ps: MkPost[]) => ps.filter((p) => p.title);
  const todayDone = todayPosts.reduce((n, p) => n + doneCount(p, on), 0);
  const todayLeft = todayPosts.filter((p) => doneCount(p, on) < total).length;
  const started = data.posts
    .filter((p) => p.title)
    .reduce((m, p) => (p.post_date < m ? p.post_date : m), data.today);
  const past = data.days.filter((d) => d >= started && d <= data.today);
  let md = 0;
  let ma = 0;
  for (const d of past)
    for (const p of slotsOf(d)) {
      md += doneCount(p, on);
      ma += total;
    }
  const pct = ma ? Math.round((md / ma) * 100) : 0;
  const pending = (id: string) =>
    past.reduce(
      (n, d) =>
        n + titled(slotsOf(d)).filter((p) => p.status[id] !== "done").length,
      0,
    );
  const worst = on
    .map((c) => ({ c, n: pending(c.id) }))
    .sort((a, b) => b.n - a.n)[0];
  const dayCls = (d: string) => {
    const ps = slotsOf(d);
    const t = titled(ps);
    const done = ps.reduce((n, p) => n + doneCount(p, on), 0);
    if (d < started)
      return t.length
        ? done === ps.length * total
          ? "full"
          : "part"
        : "empty";
    if (d < data.today && done < ps.length * total) return "miss";
    if (!t.length) return "empty";
    if (done === ps.length * total) return "full";
    return done ? "part" : "none";
  };
  const goView = (v: View) => {
    setView(v);
    setPick(null);
  };

  return (
    <div className="mk">
      <div className="mk-top">
        <div className="mk-seg" role="group" aria-label="มุมมอง">
          {(
            [
              ["today", "วันนี้"],
              ["cal", "ปฏิทิน"],
              ["board", "บอร์ด"],
              ["rules", "ตั้งค่า"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => goView(v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="mk-strip">
        <span
          className="mk-ring"
          style={{
            ["--p" as string]: total
              ? (todayDone / (todayPosts.length * total)) * 100
              : 0,
          }}
          data-t={`${todayDone}/${todayPosts.length * total}`}
          aria-label={`วันนี้ลงแล้ว ${todayDone} จาก ${todayPosts.length * total}`}
        />
        <span>
          <b>{todayLeft ? `เหลือ ${todayLeft} เรื่อง` : "ครบแล้ว"}</b>{" "}
          <small>ของวันนี้</small>
        </span>
        <span>
          <b>{pct}%</b> <small>ทำตามแผนเดือนนี้ (ถึงวันนี้)</small>
        </span>
        <span>
          <b>{worst && worst.n ? worst.c.name : "ไม่มี"}</b>{" "}
          <small>
            {worst && worst.n
              ? `ค้างมากสุด ${worst.n} โพสต์`
              : "ไม่มีช่องที่ค้าง"}
          </small>
        </span>
      </div>
      {goals && goals.goals.some((g) => g.active) && (
        <div className="mk-goals">
          {goals.goals
            .filter((g) => g.active)
            .map((g) => {
              const pct = Math.min(100, Math.round((g.value / g.target) * 100));
              return (
                <div
                  key={g.id}
                  className={`mk-goal${g.achieved ? " won" : ""}`}
                >
                  <div className="mk-goal-h">
                    <b>{goalLabel(g)}</b>
                    <span>
                      {g.value}/{g.target}
                    </span>
                  </div>
                  <i className="mk-gbar">
                    <u style={{ width: `${pct}%` }} />
                  </i>
                  <p>
                    รางวัล: <strong>{g.reward}</strong>
                  </p>
                  {g.claimed ? (
                    <small className="mk-gok">รับรางวัลรอบนี้แล้ว ✓</small>
                  ) : g.achieved ? (
                    <button
                      type="button"
                      className="btn primary-sm"
                      onClick={() =>
                        goalCall("PUT", { goalId: g.id }).then(
                          (ok) =>
                            ok && flash(`ยินดีด้วย! ได้รางวัล: ${g.reward}`),
                        )
                      }
                    >
                      ทำได้แล้ว! กดรับรางวัล
                    </button>
                  ) : (
                    <small>
                      {g.daysLeft > 0
                        ? `เหลืออีก ${g.daysLeft} วัน`
                        : "วันสุดท้ายของรอบ"}{" "}
                      · ขาดอีก {g.target - g.value}
                      {g.metric === "posts" ? " เรื่อง" : " วัน"}
                    </small>
                  )}
                </div>
              );
            })}
        </div>
      )}
      {msg && (
        <p className="mk-flash" role="status">
          {msg}
        </p>
      )}

      {view === "cal" && (
        <>
          <div className="mk-filt">
            <span>ดูเฉพาะช่องที่ค้าง</span>
            {on.map((c) => {
              const n = pending(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className="mk-fc"
                  aria-pressed={filter === c.id}
                  onClick={() => setFilter(filter === c.id ? null : c.id)}
                >
                  <Logo c={c} size={22} />
                  {c.name}
                  {n > 0 && <em>ค้าง {n}</em>}
                </button>
              );
            })}
          </div>
          {pick !== null && (
            <p className="mk-hint">
              แตะวันที่ต้องการวาง “
              {data.ideas.find((i) => i.id === pick)?.title}”{" "}
              <button
                type="button"
                className="btn ghost-sm"
                onClick={() => setPick(null)}
              >
                ยกเลิก
              </button>
            </p>
          )}
          <div className="mk-work">
            <section className="panel">
              <div className="mk-calh">
                <button
                  type="button"
                  aria-label="เดือนก่อน"
                  onClick={() => setMonth(shiftMonth(data.month, -1))}
                >
                  ‹
                </button>
                <h2>
                  {thDate(`${data.month}-01`, {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                {!inMonth && (
                  <button
                    type="button"
                    className="mk-now"
                    onClick={() => setMonth(null)}
                  >
                    เดือนนี้
                  </button>
                )}
                <button
                  type="button"
                  aria-label="เดือนถัดไป"
                  onClick={() => setMonth(shiftMonth(data.month, 1))}
                >
                  ›
                </button>
              </div>
              <div className="mk-grid">
                {DOW.map((x) => (
                  <div key={x} className="mk-dow">
                    {x}
                  </div>
                ))}
                {Array.from({ length: dowMon(data.days[0]) }, (_, i) => (
                  <div key={`o${i}`} className="mk-cell" data-k="out" />
                ))}
                {data.days.map((d) => {
                  const ps = slotsOf(d);
                  const flag =
                    filter &&
                    d <= data.today &&
                    titled(ps).some((p) => p.status[filter] !== "done");
                  return (
                    <button
                      key={d}
                      type="button"
                      className={`mk-cell${d === data.today ? " is-today" : ""}${sel === d ? " is-sel" : ""}${pick !== null ? " is-pick" : ""}${over === d ? " is-drop" : ""}`}
                      data-k={dayCls(d)}
                      data-flag={flag ? "1" : undefined}
                      aria-label={dayLabel(d)}
                      onClick={() =>
                        pick !== null ? place(pick, d) : setSel(d)
                      }
                      onDragOver={(e) => {
                        if (drag === null) return;
                        e.preventDefault();
                        setOver(d);
                      }}
                      onDragLeave={() => setOver((o) => (o === d ? null : o))}
                      onDrop={(e) => {
                        e.preventDefault();
                        setOver(null);
                        if (drag !== null) place(drag, d);
                        setDrag(null);
                      }}
                    >
                      <span className="mk-dn">{Number(d.slice(8))}</span>
                      {ps.map((p) => (
                        <span key={p.slot} className="mk-sl">
                          <span className={`mk-tt${p.title ? "" : " none"}`}>
                            {p.title || "—"}
                          </span>
                          {p.title && <Dots post={p} channels={on} />}
                        </span>
                      ))}
                    </button>
                  );
                })}
              </div>
              <p className="mk-lgd">
                <span>
                  <i
                    className="mk-dot"
                    data-s="done"
                    style={{ ["--c" as string]: "#1877F2" }}
                  />{" "}
                  ลงแล้ว (สีของช่องทาง)
                </span>
                <span>
                  <i className="mk-dot" data-s="sched" /> ตั้งเวลา
                </span>
                <span>
                  <i className="mk-dot" data-s="todo" /> ยังไม่ลง
                </span>
                <span>
                  <i className="mk-sw" data-k="full" /> ครบ
                </span>
                <span>
                  <i className="mk-sw" data-k="part" /> ลงบางช่อง
                </span>
                <span>
                  <i className="mk-sw" data-k="miss" /> ค้างอยู่
                </span>
              </p>
              {(() => {
                const used = new Map<string, number>();
                for (const p of data.posts)
                  if (p.title && p.psychology)
                    used.set(p.psychology, (used.get(p.psychology) ?? 0) + 1);
                const list = [...used.entries()].sort((a, b) => b[1] - a[1]);
                const unused = Object.keys(PSYCH).filter((k) => !used.has(k));
                return (
                  <p className="mk-psy">
                    <b>หลักจิตวิทยาเดือนนี้:</b>{" "}
                    {list.length
                      ? list.map(([k, n]) => `${k} ${n}`).join(" · ")
                      : "ยังไม่ได้ระบุ"}
                    {list.length > 0 && unused.length > 0 && (
                      <small>
                        {" "}
                        · ยังไม่ได้ใช้: {unused.slice(0, 5).join(", ")}
                      </small>
                    )}
                  </p>
                );
              })()}
            </section>

            <aside className="panel mk-tray">
              <h3>คลังไอเดีย</h3>
              <p>ลากไปวางบนวัน หรือกด “วางลงวัน” แล้วแตะวัน</p>
              <form
                className="mk-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  addIdea();
                }}
              >
                <input
                  className="text"
                  value={idea}
                  maxLength={120}
                  placeholder="จดไอเดียใหม่"
                  aria-label="ไอเดียใหม่"
                  onChange={(e) => setIdea(e.target.value)}
                />
                <button className="btn primary-sm" disabled={!idea.trim()}>
                  เพิ่ม
                </button>
              </form>
              {data.ideas.length === 0 && (
                <p className="mk-empty">ยังไม่มีไอเดีย จดไว้ตอนนึกออก</p>
              )}
              {data.ideas.map((x) => (
                <div
                  key={x.id}
                  className={`mk-idea${pick === x.id ? " picked" : ""}`}
                  draggable
                  onDragStart={(e) => {
                    setDrag(x.id);
                    e.dataTransfer.setData("text/plain", String(x.id));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDrag(null);
                    setOver(null);
                  }}
                >
                  <b>{x.title}</b>
                  <div className="mk-ir">
                    <span className="mk-pill">{PILLARS[x.pillar]}</span>
                    <span>
                      <button
                        type="button"
                        onClick={() => setPick(pick === x.id ? null : x.id)}
                      >
                        วางลงวัน
                      </button>
                      <button
                        type="button"
                        className="del"
                        onClick={() => delIdea(x.id)}
                        aria-label="ลบไอเดีย"
                      >
                        ลบ
                      </button>
                    </span>
                  </div>
                </div>
              ))}
            </aside>
          </div>
        </>
      )}

      {view === "today" &&
        (inMonth ? (
          <>
            <p className="mk-hint soft">
              แตะที่ช่องทางเมื่อลงโพสต์แล้ว · แตะซ้ำเพื่อเปลี่ยน (ยังไม่ลง →
              ตั้งเวลา → ลงแล้ว)
            </p>
            <div className="mk-tday">
              {todayPosts.map((p) => (
                <article key={p.slot} className="panel mk-big">
                  <span className="mk-m">
                    เรื่องที่ {p.slot} ของวัน
                    {p.title
                      ? ` · ${PILLARS[p.pillar]}${p.format ? ` · ${p.format}` : ""}`
                      : ""}
                  </span>
                  <h3>{p.title || "ยังไม่ตั้งหัวข้อ"}</h3>
                  <div className="mk-tg">
                    {on.map((c) => {
                      const s = p.status[c.id] ?? "todo";
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className="mk-tb"
                          data-s={s}
                          onClick={() =>
                            save(data.today, p.slot, {
                              status: { [c.id]: NEXT_STATE[s] },
                            })
                          }
                        >
                          <Logo c={c} size={28} />
                          <span className="t">
                            {c.name}
                            <small>
                              {STATE_LABEL[s]}
                              {s === "done" && p.done_at[c.id]
                                ? ` ${p.done_at[c.id]}`
                                : ""}
                            </small>
                          </span>
                          <span className="ck" aria-hidden="true">
                            ✓
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mk-row">
                    <button
                      type="button"
                      className="btn ghost-sm"
                      onClick={() => setSel(data.today)}
                    >
                      แก้หัวข้อ / แคปชัน
                    </button>
                    <button
                      type="button"
                      className="btn ghost-sm"
                      disabled={doneCount(p, on) === total}
                      onClick={() =>
                        save(data.today, p.slot, {
                          status: Object.fromEntries(
                            on
                              .filter((c) => p.status[c.id] !== "done")
                              .map((c) => [c.id, "done"]),
                          ),
                        })
                      }
                    >
                      ลงครบทุกช่องแล้ว
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="mk-empty">
            กำลังดูเดือนอื่นอยู่{" "}
            <button
              type="button"
              className="btn ghost-sm"
              onClick={() => setMonth(null)}
            >
              กลับไปเดือนนี้
            </button>
          </p>
        ))}

      {view === "board" &&
        (() => {
          type Card = {
            key: string;
            title: string;
            meta: string;
            date?: string;
            post?: MkPost;
          };
          const cols: [string, Card[]][] = [
            [
              "ไอเดีย",
              data.ideas.map((x) => ({
                key: `i${x.id}`,
                title: x.title,
                meta: PILLARS[x.pillar],
              })),
            ],
            ["ตั้งหัวข้อแล้ว", []],
            ["พร้อมลง", []],
            ["กำลังลง", []],
            ["ลงครบแล้ว", []],
          ];
          for (const d of data.days.filter((x) => x >= addDays(data.today, -3)))
            for (const p of titled(slotsOf(d))) {
              const n = doneCount(p, on);
              const k = n === total ? 4 : n ? 3 : p.caption ? 2 : 1;
              cols[k][1].push({
                key: `${d}-${p.slot}`,
                title: p.title,
                meta: `${dayLabel(d)} · ${n}/${total} ช่อง${p.psychology ? ` · ${p.psychology}` : ""}`,
                date: d,
                post: p,
              });
            }
          return (
            <>
              <div className="mk-board">
                {cols.map(([h, cs]) => (
                  <section key={h} className="mk-col">
                    <h3>
                      {h}
                      <span>{cs.length}</span>
                    </h3>
                    {cs.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        className="mk-kc"
                        onClick={() =>
                          c.date ? setSel(c.date) : goView("cal")
                        }
                      >
                        <b>{c.title}</b>
                        <small>{c.meta}</small>
                        {c.post && <Dots post={c.post} channels={on} />}
                      </button>
                    ))}
                    {cs.length === 0 && <p className="mk-empty">ว่าง</p>}
                  </section>
                ))}
              </div>
              <p className="mk-lgd">
                แสดงเรื่องตั้งแต่ {dayLabel(addDays(data.today, -3))}{" "}
                ถึงสิ้นเดือน · กดการ์ดเพื่อเปิดรายละเอียดของวันนั้น
              </p>
            </>
          );
        })()}

      {view === "rules" && (
        <div className="mk-rules">
          <section className="panel mk-gset">
            <h3>เป้าหมายและรางวัล</h3>
            <p className="mk-hint2">
              ตั้งเป้าให้ตัวเอง ทำถึงแล้วกดรับรางวัลได้รอบละครั้ง
              (สัปดาห์เริ่มวันจันทร์)
            </p>
            {goals?.goals.map((g) => (
              <GoalForm
                key={g.id}
                goal={g}
                onSave={(v) =>
                  goalCall("POST", { ...v, id: g.id }).then(
                    (ok) => ok && flash("บันทึกเป้าหมายแล้ว"),
                  )
                }
                onDelete={() => goalCall("DELETE", undefined, `?id=${g.id}`)}
              />
            ))}
            <GoalForm
              onSave={(v) =>
                goalCall("POST", v).then(
                  (ok) => ok && flash("เพิ่มเป้าหมายแล้ว"),
                )
              }
            />
            {goals && goals.claims.length > 0 && (
              <div className="mk-claims">
                <b>รางวัลที่ได้แล้ว</b>
                {goals.claims.map((c) => (
                  <small key={c.id}>
                    {c.period_key.startsWith("W:")
                      ? `สัปดาห์ ${thDate(c.period_key.slice(2), { day: "numeric", month: "short" })}`
                      : `เดือน ${thDate(`${c.period_key.slice(2)}-01`, { month: "short", year: "numeric" })}`}{" "}
                    · {c.reward} ({c.value})
                  </small>
                ))}
              </div>
            )}
          </section>
          <section className="panel">
            <h3>เป้าหมายต่อวัน</h3>
            <p className="mk-hint2">ปฏิทินจะแสดงจำนวนเรื่องต่อวันตามนี้</p>
            <div className="mk-row">
              <span>ทุกวันต้องลง</span>
              <span className="mk-step">
                <button
                  type="button"
                  aria-label="ลด"
                  onClick={() =>
                    data.perDay > 1 && setup({ perDay: data.perDay - 1 })
                  }
                >
                  −
                </button>
                <output>{data.perDay}</output>
                <button
                  type="button"
                  aria-label="เพิ่ม"
                  onClick={() =>
                    data.perDay < 10 && setup({ perDay: data.perDay + 1 })
                  }
                >
                  +
                </button>
              </span>
              <span>เรื่อง</span>
            </div>
          </section>
          <section className="panel">
            <h3>แฮชแท็กประจำแบรนด์</h3>
            <p className="mk-hint2">
              เติมท้ายแคปชันให้ทุกโพสต์ตอนกด “คัดลอกพร้อมแฮชแท็ก”
            </p>
            <BrandTags
              value={data.brandTags}
              onSave={(brandTags) => setup({ brandTags }, "บันทึกแฮชแท็กแล้ว")}
            />
          </section>
          <section className="panel">
            <h3>ช่องทางที่ลง</h3>
            <p className="mk-hint2">
              เปิดเฉพาะช่องที่ร้านใช้จริง เพิ่มช่องใหม่ได้เอง
            </p>
            {data.channels.map((c) => (
              <div key={c.id} className="mk-chset">
                <label className="row">
                  <span className="mk-cn">
                    <Logo c={c} />
                    {c.name}
                  </span>
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={(e) =>
                      setup({
                        channel: { id: c.id, enabled: e.target.checked },
                      })
                    }
                  />
                </label>
                {c.enabled && (
                  <ChannelUrl
                    c={c}
                    onSave={(url) =>
                      setup(
                        { channelUrl: { id: c.id, url } },
                        url
                          ? `บันทึกลิงก์ ${c.name} แล้ว`
                          : `ลบลิงก์ ${c.name} แล้ว`,
                      )
                    }
                  />
                )}
              </div>
            ))}
            <form
              className="mk-add"
              onSubmit={(e) => {
                e.preventDefault();
                if (newCh.trim())
                  setup(
                    { addChannel: newCh },
                    `เพิ่มช่อง ${newCh.trim()} แล้ว`,
                  ).then(() => setNewCh(""));
              }}
            >
              <input
                className="text"
                value={newCh}
                maxLength={30}
                placeholder="ชื่อช่องใหม่ เช่น Shopee Live, Lemon8"
                aria-label="ชื่อช่องทางใหม่"
                onChange={(e) => setNewCh(e.target.value)}
              />
              <button className="btn primary-sm" disabled={!newCh.trim()}>
                เพิ่มช่อง
              </button>
            </form>
          </section>
        </div>
      )}

      {mounted &&
        createPortal(
          <>
            <div
              className={`mk-scrim${sel ? " on" : ""}`}
              onClick={() => setSel(null)}
            />
            <aside
              className={`mk-drawer${sel ? " on" : ""}`}
              aria-hidden={!sel}
              aria-label="รายละเอียดวัน"
            >
              {sel && (
                <>
                  <div className="mk-dh">
                    <h2>
                      {dayLabel(sel)}
                      <small>
                        {sel === data.today
                          ? "วันนี้"
                          : sel < data.today
                            ? "ผ่านมาแล้ว"
                            : "วางแผน"}{" "}
                        · วันละ {data.perDay} เรื่อง × {total} ช่องทาง
                      </small>
                    </h2>
                    <button
                      type="button"
                      className="mk-x"
                      onClick={() => setSel(null)}
                      aria-label="ปิด"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mk-db">
                    {slotsOf(sel).map((p) => (
                      <PostEditor
                        key={`${sel}-${p.slot}`}
                        post={p}
                        channels={on}
                        brandTags={data.brandTags}
                        onSave={(patch) => save(sel, p.slot, patch)}
                      />
                    ))}
                  </div>
                </>
              )}
            </aside>
          </>,
          document.body,
        )}
    </div>
  );
}

function BrandTags({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <form
      className="mk-add"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
    >
      <input
        className="text"
        value={v}
        maxLength={300}
        placeholder="#CODEMATCHA #มัทฉะ"
        aria-label="แฮชแท็กแบรนด์"
        onChange={(e) => setV(e.target.value)}
      />
      <button className="btn primary-sm" disabled={v.trim() === value}>
        บันทึก
      </button>
    </form>
  );
}

type GoalDraft = {
  period: GoalPeriod;
  metric: GoalMetric;
  target: number;
  reward: string;
  strict: boolean;
  active: boolean;
};
// ฟอร์มเป้าหมาย 1 รายการ (ไม่มี goal = ฟอร์มเพิ่มใหม่)
function GoalForm({
  goal,
  onSave,
  onDelete,
}: {
  goal?: MkGoalProgress;
  onSave: (v: GoalDraft) => Promise<unknown>;
  onDelete?: () => void;
}) {
  const init: GoalDraft = goal
    ? {
        period: goal.period,
        metric: goal.metric,
        target: goal.target,
        reward: goal.reward,
        strict: goal.strict,
        active: goal.active,
      }
    : {
        period: "week",
        metric: "posts",
        target: 10,
        reward: "",
        strict: false,
        active: true,
      };
  const [v, setV] = useState<GoalDraft>(init);
  const [confirm, setConfirm] = useState(false);
  const changed = JSON.stringify(v) !== JSON.stringify(init);
  const set = (p: Partial<GoalDraft>) => setV({ ...v, ...p });
  return (
    <form
      className={`mk-gf${goal ? "" : " new"}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v).then(() => !goal && setV({ ...init, reward: "" }));
      }}
    >
      <div className="mk-gf-row">
        <select
          className="text"
          value={v.period}
          aria-label="รอบ"
          onChange={(e) => set({ period: e.target.value as GoalPeriod })}
        >
          <option value="week">ทุกสัปดาห์</option>
          <option value="month">ทุกเดือน</option>
        </select>
        <select
          className="text"
          value={v.metric}
          aria-label="ชนิดเป้าหมาย"
          onChange={(e) => set({ metric: e.target.value as GoalMetric })}
        >
          <option value="posts">โพสต์ครบ (เรื่อง)</option>
          <option value="days">ลงครบทุกวัน (วัน)</option>
        </select>
        <input
          className="text"
          type="number"
          min={1}
          max={v.metric === "days" ? (v.period === "week" ? 7 : 31) : 400}
          value={v.target}
          aria-label="ตัวเลขเป้าหมาย"
          onChange={(e) => set({ target: Number(e.target.value) })}
        />
      </div>
      <input
        className="text"
        value={v.reward}
        maxLength={120}
        placeholder="รางวัลที่จะให้ตัวเอง เช่น ซื้อชุดชงมัทฉะ 1 ชุด"
        aria-label="รางวัล"
        onChange={(e) => set({ reward: e.target.value })}
      />
      <div className="mk-gf-row">
        <label className="mk-chk">
          <input
            type="checkbox"
            checked={v.strict}
            onChange={(e) => set({ strict: e.target.checked })}
          />{" "}
          นับเมื่อลงครบทุกช่อง
        </label>
        {goal && (
          <label className="mk-chk">
            <input
              type="checkbox"
              checked={v.active}
              onChange={(e) => set({ active: e.target.checked })}
            />{" "}
            ใช้อยู่
          </label>
        )}
        <span className="mk-gf-btns">
          {goal && (
            <button
              type="button"
              className={`btn ${confirm ? "danger-sm" : "ghost-sm"}`}
              onClick={() => (confirm ? onDelete?.() : setConfirm(true))}
            >
              {confirm ? "ยืนยันลบ" : "ลบ"}
            </button>
          )}
          <button
            className="btn primary-sm"
            disabled={goal ? !changed : !v.reward.trim()}
          >
            {goal ? "บันทึก" : "เพิ่มเป้าหมาย"}
          </button>
        </span>
      </div>
    </form>
  );
}

// ลิงก์โพสต์จริงของช่องหนึ่ง: วางแล้วบันทึกทันที สถานะเป็น "ลงแล้ว" เอง
function PostLink({
  post,
  c,
  onSave,
}: {
  post: MkPost;
  c: MkChannel;
  onSave: (patch: Partial<MkPost>) => void;
}) {
  const cur = post.links[c.id] ?? "";
  const [v, setV] = useState(cur);
  const [err, setErr] = useState("");
  useEffect(() => setV(cur), [cur]);
  const commit = (val: string) => {
    const url = val.trim();
    if (url === cur) return setErr("");
    const problem = url ? linkProblem(url, c.id, c.name) : null;
    if (problem) return setErr(problem);
    setErr("");
    onSave({ links: { [c.id]: url } });
  };
  return (
    <div className="mk-link">
      {cur && !err ? (
        <div className="mk-row">
          <a
            className="mk-open"
            href={cur}
            target="_blank"
            rel="noopener noreferrer"
          >
            เปิดโพสต์ใน {c.name} ↗
          </a>
          <button
            type="button"
            className="mk-unlink"
            onClick={() => onSave({ links: { [c.id]: "" } })}
          >
            เปลี่ยนลิงก์
          </button>
        </div>
      ) : (
        <input
          className="text"
          inputMode="url"
          value={v}
          maxLength={500}
          placeholder={`วางลิงก์โพสต์ ${c.name} ที่ลงแล้ว (ระบบติ๊ก “ลงแล้ว” ให้เอง)`}
          aria-label={`ลิงก์โพสต์ ${c.name}`}
          onChange={(e) => setV(e.target.value)}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (t) {
              e.preventDefault();
              setV(t.trim());
              commit(t);
            }
          }}
          onBlur={() => commit(v)}
        />
      )}
      {err && <small className="mk-err">{err}</small>}
    </div>
  );
}

// ลิงก์เพจ/โปรไฟล์ร้านของช่อง (หน้า ตั้งค่า)
function ChannelUrl({
  c,
  onSave,
}: {
  c: MkChannel;
  onSave: (url: string) => void;
}) {
  const [v, setV] = useState(c.url ?? "");
  const [err, setErr] = useState("");
  useEffect(() => setV(c.url ?? ""), [c.url]);
  return (
    <form
      className="mk-add mk-churl"
      onSubmit={(e) => {
        e.preventDefault();
        const url = v.trim();
        const problem = url ? linkProblem(url, c.id, c.name) : null;
        if (problem) return setErr(problem);
        setErr("");
        onSave(url);
      }}
    >
      <input
        className="text"
        inputMode="url"
        value={v}
        maxLength={500}
        placeholder={`ลิงก์เพจ/โปรไฟล์ร้านใน ${c.name}`}
        aria-label={`ลิงก์เพจร้านใน ${c.name}`}
        onChange={(e) => setV(e.target.value)}
      />
      <button className="btn ghost-sm" disabled={v.trim() === (c.url ?? "")}>
        บันทึก
      </button>
      {err && <small className="mk-err">{err}</small>}
    </form>
  );
}
