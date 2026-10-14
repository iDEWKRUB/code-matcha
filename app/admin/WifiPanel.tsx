"use client";

import { useEffect, useState } from "react";
import Icon from "../Icon";

// ชื่อ/รหัส Wi-Fi ท้ายใบเสร็จหน้าร้าน (ทั้งใบเสร็จบนจอและเครื่องพิมพ์ Bluetooth)
export default function WifiPanel() {
  const [ssid, setSsid] = useState("");
  const [pass, setPass] = useState("");
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/wifi", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          setSsid(j.ssid ?? "");
          setPass(j.pass ?? "");
          setReady(true);
        } else setMsg({ ok: false, text: j.error ?? "โหลดไม่สำเร็จ" });
      })
      .catch(() => setMsg({ ok: false, text: "โหลดไม่สำเร็จ" }));
  }, []);

  async function save() {
    setMsg(null);
    const r = await fetch("/api/admin/wifi", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ssid, pass }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setSsid(j.ssid);
      setPass(j.pass);
      setMsg({ ok: true, text: j.ssid ? "บันทึกแล้ว ใบเสร็จใบถัดไปใช้ชื่อและรหัสนี้" : "ลบ Wi-Fi แล้ว ใบเสร็จจะไม่พิมพ์ส่วน Wi-Fi" });
    } else setMsg({ ok: false, text: j.error ?? "บันทึกไม่สำเร็จ" });
  }

  return (
    <section className="panel">
      <header>
        <h2>
          <Icon name="store" size={20} /> Wi-Fi ท้ายใบเสร็จ
        </h2>
        <p>พิมพ์ท้ายใบเสร็จหน้าร้านทุกใบ · เว้นชื่อว่างไว้ = ไม่พิมพ์ส่วน Wi-Fi</p>
      </header>
      <div className="hours">
        <label>
          ชื่อ Wi-Fi
          <input className="text" value={ssid} maxLength={64} disabled={!ready} onChange={(e) => setSsid(e.target.value)} autoComplete="off" />
        </label>
        <label>
          รหัส Wi-Fi
          <input className="text" value={pass} maxLength={64} disabled={!ready} onChange={(e) => setPass(e.target.value)} autoComplete="off" />
        </label>
      </div>
      <div className="panel-row">
        <button className="btn primary-sm" onClick={save} disabled={!ready}>
          บันทึก Wi-Fi
        </button>
        {msg && <span className={msg.ok ? "hint-ok" : "err"}>{msg.text}</span>}
      </div>
    </section>
  );
}
