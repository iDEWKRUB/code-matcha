"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MenuItem, Order, OrderStatus } from "@/lib/menu";
import Seal from "../Seal";

const POLL_MS = 5000;
const COLS: [OrderStatus, string][] = [
  ["pending", "ออเดอร์ใหม่"],
  ["preparing", "กำลังทำ"],
  ["ready", "รอลูกค้ารับ"],
];
const ACTIONS: Partial<Record<OrderStatus, [OrderStatus, string][]>> = {
  pending: [["preparing", "เริ่มทำ"], ["cancelled", "ยกเลิก"]],
  preparing: [["ready", "พร้อมรับ (ส่ง LINE)"], ["cancelled", "ยกเลิก"]],
  ready: [["completed", "ลูกค้ารับแล้ว"]],
};

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
  } catch {}
}

export default function Board() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const seen = useRef<Set<number> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/board", { cache: "no-store" });
      if (r.status === 401) return router.refresh();
      if (!r.ok) throw new Error();
      const j = (await r.json()) as { orders: Order[]; menu: MenuItem[] };
      if (seen.current) {
        const added = j.orders.filter((o) => !seen.current!.has(o.id)).map((o) => o.id);
        if (added.length) {
          setFresh(new Set(added));
          beep();
        }
      }
      seen.current = new Set(j.orders.map((o) => o.id));
      setOrders(j.orders);
      setMenu(j.menu);
      setError("");
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กำลังลองใหม่…");
    }
  }, [router]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function move(o: Order, to: OrderStatus) {
    if (to === "cancelled" && confirming !== o.id) {
      setConfirming(o.id);
      return;
    }
    setConfirming(null);
    setBusy(o.id);
    const r = await fetch(`/api/admin/orders/${o.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? "อัปเดตไม่สำเร็จ");
    setBusy(null);
    load();
  }

  async function toggle(m: MenuItem) {
    setMenu(menu.map((x) => (x.id === m.id ? { ...x, available: !m.available } : x)));
    const r = await fetch(`/api/admin/menu/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !m.available }),
    });
    if (!r.ok) setError("บันทึกสถานะเมนูไม่สำเร็จ");
    load();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <main className="admin">
      <header>
        <Seal size={36} />
        <h1>ออเดอร์วันนี้</h1>
        <small>อัปเดตทุก 5 วินาที</small>
        <button className="link" onClick={logout}>ออกจากระบบ</button>
      </header>
      {error && <p className="banner" role="alert">{error}</p>}

      <div className="cols">
        {COLS.map(([st, title]) => {
          const list = orders.filter((o) => o.status === st);
          return (
            <section key={st}>
              <h2>
                {title} <span>({list.length})</span>
              </h2>
              {list.length === 0 && <p className="empty">ไม่มีออเดอร์</p>}
              <ul>
                {list.map((o) => (
                  <li key={o.id} className={`ticket ${st} ${fresh.has(o.id) ? "fresh" : ""}`}>
                    <div className="th">
                      <b>#{o.no}</b>
                      <span>{o.pickupTime} น.</span>
                    </div>
                    <p className="who">
                      {o.customerName} ฿{o.total}
                    </p>
                    <ul className="its">
                      {o.items.map((i, k) => (
                        <li key={k}>
                          <b>
                            {i.qty}× {i.name}
                          </b>
                          <small>{i.detail}</small>
                        </li>
                      ))}
                    </ul>
                    {o.note && <p className="note">📝 {o.note}</p>}
                    <div className="tacts">
                      {confirming === o.id ? (
                        <>
                          <button className="danger" disabled={busy === o.id} onClick={() => move(o, "cancelled")}>
                            ยืนยันยกเลิก (แจ้งลูกค้า)
                          </button>
                          <button onClick={() => setConfirming(null)}>ไม่ใช่</button>
                        </>
                      ) : (
                        ACTIONS[st]?.map(([to, label], k) => (
                          <button key={to} className={k === 0 ? "p" : ""} disabled={busy === o.id} onClick={() => move(o, to)}>
                            {label}
                          </button>
                        ))
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="stock">
        <h2>เมนูที่ขายวันนี้</h2>
        <ul>
          {menu.map((m) => (
            <li key={m.id}>
              <span>
                {m.name} <span style={{ color: "var(--stone)" }}>฿{m.price}</span>
              </span>
              <button className="switch" aria-pressed={m.available} onClick={() => toggle(m)}>
                {m.available ? "มีขาย" : "หมด"}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
