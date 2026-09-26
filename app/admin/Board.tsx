"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MenuItem, Order } from "@/lib/menu";
import Seal from "../Seal";
import MenuTab from "./MenuTab";
import OrdersTab, { type Stats } from "./OrdersTab";
import SettingsTab from "./SettingsTab";

const POLL_MS = 5000;
type Tab = "orders" | "menu" | "settings";

const TABS: { id: Tab; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    id: "orders",
    label: "ออเดอร์วันนี้",
    hint: "อัปเดตอัตโนมัติทุก 5 วินาที",
    icon: <path d="M7 4h10a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-2-2-3 2V6a2 2 0 0 1 2-2Zm2 5h6M9 13h6" />,
  },
  {
    id: "menu",
    label: "เมนูที่ขายวันนี้",
    hint: "กดสวิตช์เพื่อเปิด/ปิดการขายทันที",
    icon: <path d="M6 8h11l-1.2 11a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8Zm11 2h1.5a2.5 2.5 0 0 1 0 5H16.6M9 4c0 1 1 1 1 2M12 3c0 1 1 1 1 2" />,
  },
  {
    id: "settings",
    label: "ตั้งค่าร้าน",
    hint: "ร้าน · เมนู · โปรโมชั่น · ส่งข้อความ LINE",
    icon: <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.4 3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.2-1.3L14.3 2h-4l-.4 2.4a7.5 7.5 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z" />,
  },
];

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
  const [tab, setTab] = useState<Tab>("orders");
  const [collapsed, setCollapsed] = useState(false);

  // จำว่าย่อแถบเมนูไว้หรือไม่ (เฉพาะเครื่องนี้)
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("adm-collapsed") === "1");
    } catch {}
  }, []);
  function toggleSide() {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem("adm-collapsed", collapsed ? "0" : "1");
    } catch {}
  }
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [stats, setStats] = useState<Stats>({ orders: 0, revenue: 0, cups: 0 });
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const seen = useRef<Set<number> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/board", { cache: "no-store" });
      if (r.status === 401) return router.refresh();
      if (!r.ok) throw new Error();
      const j = (await r.json()) as { orders: Order[]; menu: MenuItem[]; stats: Stats };
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
      setStats(j.stats);
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

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  const slips = orders.filter((o) => o.status === "payment_review").length;
  const soldOut = menu.filter((m) => !m.available).length;
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className={`adm${collapsed ? " collapsed" : ""}`}>
      <aside className="adm-side">
        <div className="adm-brand">
          <Seal size={38} />
          <div>
            <b>CODE-MACHA</b>
            <small>หลังร้าน</small>
          </div>
        </div>
        <button
          className="adm-collapse"
          onClick={toggleSide}
          aria-label={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
          title={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
          aria-expanded={!collapsed}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          <span>ย่อแถบเมนู</span>
        </button>
        <nav className="adm-nav" aria-label="เมนูหลังร้าน">
          {TABS.map((t) => (
            <button key={t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)} title={t.label}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {t.icon}
              </svg>
              <span>{t.label}</span>
              {t.id === "orders" && slips > 0 && <em className="dot-badge">{slips}</em>}
              {t.id === "menu" && soldOut > 0 && <em className="dot-badge muted">{soldOut} หมด</em>}
            </button>
          ))}
        </nav>
        <button className="adm-logout" onClick={logout} title="ออกจากระบบ">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
          </svg>
          <span>ออกจากระบบ</span>
        </button>
      </aside>

      <main className="adm-main">
        <header className="adm-head">
          <div>
            <h1>{current.label}</h1>
            <p>{current.hint}</p>
          </div>
          <span className={`live${error ? " off" : ""}`}>{error ? "ออฟไลน์" : "ออนไลน์"}</span>
        </header>
        {error && (
          <p className="banner" role="alert">
            {error}
          </p>
        )}

        {tab === "orders" && <OrdersTab orders={orders} stats={stats} fresh={fresh} reload={load} onError={setError} />}
        {tab === "menu" && <MenuTab menu={menu} setMenu={setMenu} reload={load} onError={setError} />}
        {tab === "settings" && <SettingsTab menu={menu} reload={load} />}
      </main>
    </div>
  );
}
