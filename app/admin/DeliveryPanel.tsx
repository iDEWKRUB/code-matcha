"use client";

import { useEffect, useState } from "react";
import type { ShopSettings } from "@/lib/menu";

const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// ตั้งค่า "ร้านไปส่ง" (ฟรีในรัศมี) + "สั่งล่วงหน้าของพรุ่งนี้" (รอบเช้าก่อนเปิดร้านได้)
export default function DeliveryPanel() {
  const [s, setS] = useState<ShopSettings | null>(null);
  const [pos, setPos] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ShopSettings | null) => {
        if (!j) return;
        setS(j);
        if (j.shopLat !== null && j.shopLng !== null) setPos(`${j.shopLat}, ${j.shopLng}`);
      });
  }, []);

  async function save(patch: Partial<ShopSettings>) {
    setMsg(null);
    const r = await fetch("/api/admin/settings", json("PUT", patch));
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setS(j);
      setMsg({ ok: true, text: "บันทึกแล้ว มีผลกับหน้าสั่งทันที" });
    } else setMsg({ ok: false, text: j.error ?? "บันทึกไม่สำเร็จ" });
  }

  // วางพิกัดจาก Google Maps ได้ทั้ง "13.85, 100.51" หรือลิงก์ที่มี @13.85,100.51
  function savePos() {
    const m = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/.exec(pos);
    if (!m) return setMsg({ ok: false, text: "รูปแบบพิกัดไม่ถูกต้อง ตัวอย่าง 13.8451, 100.5123" });
    save({ shopLat: Number(m[1]), shopLng: Number(m[2]) });
  }
  function here() {
    if (!("geolocation" in navigator)) return setMsg({ ok: false, text: "เครื่องนี้หาตำแหน่งไม่ได้" });
    navigator.geolocation.getCurrentPosition(
      (p) => setPos(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`),
      () => setMsg({ ok: false, text: "หาตำแหน่งไม่ได้ (อาจไม่ได้อนุญาต)" }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  if (!s) return null;
  const noPos = s.shopLat === null || s.shopLng === null;
  return (
    <section className="panel dp">
      <header>
        <h2>ร้านไปส่ง &amp; สั่งล่วงหน้า</h2>
        <p>ร้านส่งเองฟรีในรัศมีที่ตั้ง · ลูกค้าสั่งของพรุ่งนี้ได้ล่วงหน้า รวมรอบเช้าก่อนเปิดร้าน</p>
      </header>

      <h3>ร้านไปส่ง (ส่งฟรี)</h3>
      <label className="row">
        <span>เปิดให้ลูกค้าเลือก "ร้านไปส่ง"</span>
        <input type="checkbox" checked={s.deliveryEnabled} onChange={(e) => save({ deliveryEnabled: e.target.checked })} />
      </label>
      {s.deliveryEnabled && noPos && <p className="err">ยังไม่ได้ตั้งพิกัดร้าน ลูกค้าจะยังไม่เห็นตัวเลือกนี้ ตั้งพิกัดด้านล่างก่อน</p>}
      <div className="two">
        <label>
          รัศมีส่ง (กม.)
          <input className="text" type="number" min="0.5" max="20" step="0.5" defaultValue={s.deliveryKm} onBlur={(e) => save({ deliveryKm: Number(e.target.value) })} />
        </label>
        <label>
          ยอดขั้นต่ำสั่งส่ง (บาท)
          <input className="text" inputMode="numeric" defaultValue={s.deliveryMin} onBlur={(e) => save({ deliveryMin: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
        </label>
      </div>
      <label>
        พิกัดร้าน <small>(เปิด Google Maps › กดค้างที่ร้าน › คัดลอกตัวเลขมาวาง หรือกดใช้ตำแหน่งเครื่องนี้ตอนอยู่ที่ร้าน)</small>
        <div className="dp-pos">
          <input className="text" placeholder="เช่น 13.8451, 100.5123" value={pos} onChange={(e) => setPos(e.target.value)} />
          <button type="button" className="btn ghost-sm" onClick={here}>
            ใช้ตำแหน่งเครื่องนี้
          </button>
          <button type="button" className="btn primary-sm" disabled={!pos.trim()} onClick={savePos}>
            บันทึกพิกัด
          </button>
        </div>
      </label>
      {!noPos && (
        <a className="dp-check" href={`https://www.google.com/maps?q=${s.shopLat},${s.shopLng}`} target="_blank" rel="noreferrer">
          เช็กหมุดร้านบน Google Maps ›
        </a>
      )}

      <h3>สั่งล่วงหน้าของพรุ่งนี้</h3>
      <label className="row">
        <span>เปิดให้สั่งล่วงหน้าของพรุ่งนี้</span>
        <input type="checkbox" checked={s.preorderEnabled} onChange={(e) => save({ preorderEnabled: e.target.checked })} />
      </label>
      <div className="two">
        <label>
          รอบแรกของพรุ่งนี้
          <input className="text" type="time" defaultValue={s.preorderFrom} onBlur={(e) => e.target.value && save({ preorderFrom: e.target.value })} />
        </label>
        <label>
          ปิดรับสั่งของพรุ่งนี้ (วันนี้กี่โมง)
          <input className="text" type="time" defaultValue={s.preorderCutoff} onBlur={(e) => e.target.value && save({ preorderCutoff: e.target.value })} />
        </label>
      </div>
      <p className="ds">
        รอบของพรุ่งนี้: {s.preorderFrom} ถึงก่อน {s.closeTime} น. ทุก {s.slotMinutes} นาที · รับได้รอบละ {s.slotCapacity} แก้ว (ใช้ค่าเดียวกับรอบปกติ)
      </p>
      {msg && <p className={msg.ok ? "hint-ok" : "err"}>{msg.text}</p>}
    </section>
  );
}
