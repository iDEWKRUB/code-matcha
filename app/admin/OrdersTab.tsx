"use client";

import { useState } from "react";
import type { Order, OrderStatus } from "@/lib/menu";
import Icon from "../Icon";

export type Stats = { orders: number; revenue: number; cups: number };

const COLS: { st: OrderStatus; title: string; tone: string }[] = [
  { st: "payment_review", title: "รอตรวจสลิป", tone: "amber" },
  { st: "pending", title: "ออเดอร์ใหม่", tone: "red" },
  { st: "preparing", title: "กำลังทำ", tone: "leaf" },
  { st: "ready", title: "รอลูกค้ารับ", tone: "matcha" },
];
const ACTIONS: Partial<Record<OrderStatus, [OrderStatus, string][]>> = {
  payment_review: [["pending", "ยอดเงินถูกต้อง"], ["cancelled", "สลิปไม่ถูกต้อง"]],
  pending: [["preparing", "เริ่มทำ"], ["cancelled", "ยกเลิก"]],
  preparing: [["ready", "พร้อมรับ · ส่ง LINE"], ["cancelled", "ยกเลิก"]],
  ready: [["completed", "ลูกค้ารับแล้ว"]],
};

type Props = {
  orders: Order[];
  stats: Stats;
  fresh: Set<number>;
  reload: () => void;
  onError: (msg: string) => void;
};

export default function OrdersTab({ orders, stats, fresh, reload, onError }: Props) {
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

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
    if (!r.ok) onError((await r.json().catch(() => ({}))).error ?? "อัปเดตไม่สำเร็จ");
    setBusy(null);
    reload();
  }

  const count = (st: OrderStatus) => orders.filter((o) => o.status === st).length;
  const cards = [
    { label: "ออเดอร์ที่จ่ายแล้ว", value: stats.orders.toLocaleString(), sub: `${stats.cups} แก้ว` },
    { label: "ยอดขายวันนี้", value: `฿${stats.revenue.toLocaleString()}`, sub: "รวมที่ยืนยันสลิปแล้ว" },
    { label: "รอตรวจสลิป", value: String(count("payment_review")), sub: "เช็กแอปธนาคารก่อนยืนยัน", alert: count("payment_review") > 0 },
    { label: "ต้องทำตอนนี้", value: String(count("pending") + count("preparing")), sub: `กำลังทำ ${count("preparing")}` },
  ];

  return (
    <>
      <div className="stats">
        {cards.map((c) => (
          <div key={c.label} className={`stat${c.alert ? " alert" : ""}`}>
            <span>{c.label}</span>
            <b>{c.value}</b>
            <small>{c.sub}</small>
          </div>
        ))}
      </div>

      <div className="kanban">
        {COLS.map(({ st, title, tone }) => {
          const list = orders.filter((o) => o.status === st);
          return (
            <section key={st} className={`lane ${tone}`}>
              <h2>
                <i aria-hidden="true" />
                {title}
                <span className="count">{list.length}</span>
              </h2>
              {list.length === 0 && <p className="empty">ว่าง</p>}
              <ul>
                {list.map((o) => (
                  <li key={o.id} className={`ticket ${st}${fresh.has(o.id) ? " fresh" : ""}`}>
                    <div className="th">
                      <b>#{o.no}</b>
                      <span className={`time svc-${o.service}`}>
                        {o.service === "pickup" ? `มารับ ${o.pickupTime} น.` : o.service === "dine_in" ? `ทานที่ร้าน${o.tableNo ? ` · โต๊ะ ${o.tableNo}` : ""}` : "กลับบ้าน · รอที่ร้าน"}
                      </span>
                    </div>
                    <p className="who">
                      {o.customerName} · <strong>฿{o.total}</strong>
                      {o.promoDiscount > 0 && (
                        <span className="tag">
                          {o.promoCode} −฿{o.promoDiscount}
                        </span>
                      )}
                      {o.discount > 0 && <span className="tag">ใช้แต้ม −฿{o.discount}</span>}
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
                    {o.note && (
                      <p className="note">
                        <Icon name="note" size={16} /> {o.note}
                      </p>
                    )}
                    {st === "payment_review" && o.hasSlip && (
                      <a className="slip" href={`/api/admin/orders/${o.id}/slip`} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/admin/orders/${o.id}/slip?v=${o.id}`} alt={`สลิปออเดอร์ #${o.no}`} loading="lazy" />
                        <span>ต้องได้รับ ฿{o.total} · แตะเพื่อขยาย</span>
                      </a>
                    )}
                    <div className="tacts">
                      {confirming === o.id ? (
                        <>
                          <button className="danger" disabled={busy === o.id} onClick={() => move(o, "cancelled")}>
                            ยืนยันยกเลิก · แจ้งลูกค้า
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
    </>
  );
}
