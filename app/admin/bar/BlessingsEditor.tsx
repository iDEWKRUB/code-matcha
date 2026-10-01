"use client";

import { useEffect, useState } from "react";
import { MAX_BLESSINGS, MAX_BLESSING_LEN, MOODS, type Blessing, type Mood } from "@/lib/blessings";

// แก้คำอวยพรของหน้า /gift (สติ๊กเกอร์ติดแก้ว): เพิ่ม/แก้/ลบ เลือกอารมณ์น้องมัทฉะ แล้วบันทึกทั้งชุด
export default function BlessingsEditor({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<Blessing[] | null>(null);
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/blessings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        setList(j.messages);
        setCustom(j.custom);
      })
      .catch(() => setMsg({ ok: false, text: "โหลดคำอวยพรไม่สำเร็จ (รัน migration-026 แล้วหรือยัง?)" }));
  }, []);

  async function save(reset = false) {
    if (reset && !confirm("กลับไปใช้คำอวยพรชุดตั้งต้นทั้งหมด?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/blessings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reset ? { reset: true } : { messages: list }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) return location.reload();
      if (!r.ok) throw new Error(j.error ?? "บันทึกไม่สำเร็จ");
      setList(j.messages);
      setCustom(j.custom);
      setMsg({ ok: true, text: reset ? "กลับไปใช้ชุดตั้งต้นแล้ว" : `บันทึกแล้ว ${j.messages.length} ข้อความ · ลูกค้าเห็นทันทีที่สแกนครั้งถัดไป` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  }

  const set = (i: number, p: Partial<Blessing>) => setList((l) => l && l.map((b, k) => (k === i ? { ...b, ...p } : b)));

  return (
    <div className="nba-modal nba-noprint" role="dialog" aria-modal="true" aria-label="แก้คำอวยพร">
      <div className="nba-form bl-form">
        <div className="nba-row-head">
          <h2>คำอวยพรบนแก้ว</h2>
          <button className="nba-ghost" onClick={onClose}>
            ปิด
          </button>
        </div>
        <p className="nba-muted">
          ลูกค้าสแกนแล้วสุ่มได้ 1 ข้อความ · ใส่ <code>{"{name}"}</code> = ชื่อเล่นที่ลูกค้ากรอก · <code>{"{name|เธอ}"}</code> = ถ้าไม่กรอกชื่อใช้คำว่า &quot;เธอ&quot; ·
          อารมณ์เปลี่ยนหน้าตาน้องมัทฉะ {custom ? "· ตอนนี้ใช้ชุดที่ร้านตั้งเอง" : "· ตอนนี้ใช้ชุดตั้งต้น"}
        </p>
        {!list ? (
          <p className="nba-muted">{msg?.text ?? "กำลังโหลด…"}</p>
        ) : (
          <ol className="bl-list">
            {list.map((b, i) => (
              <li key={i}>
                <span className="bl-n">{i + 1}</span>
                <select value={b.mood} onChange={(e) => set(i, { mood: e.target.value as Mood })} aria-label={`อารมณ์ข้อความที่ ${i + 1}`}>
                  {MOODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  value={b.text}
                  maxLength={MAX_BLESSING_LEN}
                  placeholder="พิมพ์คำอวยพร"
                  onChange={(e) => set(i, { text: e.target.value })}
                  aria-label={`คำอวยพรที่ ${i + 1}`}
                />
                <button className="bl-x" aria-label={`ลบข้อความที่ ${i + 1}`} onClick={() => setList(list.filter((_, k) => k !== i))}>
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}
        {msg && list && <p className={msg.ok ? "hint-ok" : "nba-err"}>{msg.text}</p>}
        <div className="nba-acts">
          <button className="nba-ghost" disabled={!list || list.length >= MAX_BLESSINGS} onClick={() => list && setList([...list, { mood: "love", text: "" }])}>
            + เพิ่มข้อความ
          </button>
          <button className="nba-ghost" disabled={busy} onClick={() => save(true)}>
            ใช้ชุดตั้งต้น
          </button>
          <button className="nba-primary" disabled={busy || !list} onClick={() => save()}>
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
