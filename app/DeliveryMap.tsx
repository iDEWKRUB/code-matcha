"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Marker } from "leaflet";
import { distanceKm } from "@/lib/geo";

export type Pin = { lat: number; lng: number };

// ปักหมุดตำแหน่งจัดส่ง: เริ่มที่ร้าน · ลากหมุด/แตะแผนที่ · ปุ่มใช้ตำแหน่งปัจจุบัน · วงรัศมีส่ง
export default function DeliveryMap({ shop, km, value, onChange }: { shop: Pin; km: number; value: Pin | null; onChange: (p: Pin) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const [msg, setMsg] = useState("");
  const set = useRef(onChange);
  set.current = onChange;

  useEffect(() => {
    let alive = true;
    import("leaflet").then((L) => {
      if (!alive || !box.current || map.current) return;
      const start = value ?? shop;
      const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      L.circle([shop.lat, shop.lng], { radius: km * 1000, color: "#2F4A2A", weight: 1.5, fillColor: "#A8D35A", fillOpacity: 0.12 }).addTo(m);
      L.marker([shop.lat, shop.lng], {
        icon: L.divIcon({ className: "dm-shop", html: "<span>暗<br>号</span>", iconSize: [30, 30], iconAnchor: [15, 15] }),
        interactive: false,
      }).addTo(m);
      const mk = L.marker([start.lat, start.lng], {
        draggable: true,
        icon: L.divIcon({ className: "dm-pin", html: "<i></i>", iconSize: [30, 40], iconAnchor: [15, 38] }),
      }).addTo(m);
      const put = (lat: number, lng: number) => {
        mk.setLatLng([lat, lng]);
        set.current({ lat, lng });
      };
      mk.on("dragend", () => {
        const p = mk.getLatLng();
        put(p.lat, p.lng);
      });
      m.on("click", (e) => put(e.latlng.lat, e.latlng.lng));
      map.current = m;
      pin.current = mk;
      if (!value) set.current(start);
    });
    return () => {
      alive = false;
      map.current?.remove();
      map.current = null;
    };
    // สร้างแผนที่ครั้งเดียว
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    if (!("geolocation" in navigator)) return setMsg("เครื่องนี้หาตำแหน่งไม่ได้ ลองลากหมุดแทน");
    setMsg("กำลังหาตำแหน่ง…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude: lat, longitude: lng } = p.coords;
        pin.current?.setLatLng([lat, lng]);
        map.current?.setView([lat, lng], 17);
        onChange({ lat, lng });
        setMsg("");
      },
      () => setMsg("หาตำแหน่งไม่ได้ (อาจไม่ได้อนุญาต) ลองลากหมุดหรือแตะแผนที่แทน"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const dist = value ? distanceKm(shop, value) : null;
  const over = dist !== null && dist > km;
  return (
    <div className="dm">
      <div ref={box} className="dm-map" />
      <div className="dm-bar">
        <button type="button" className="dm-loc" onClick={locate}>
          ใช้ตำแหน่งปัจจุบัน
        </button>
        {dist !== null && (
          <span className={over ? "dm-over" : "dm-ok"}>
            ห่างร้าน {dist.toFixed(1)} กม.{over ? ` · เกินรัศมี ${km} กม.` : " · อยู่ในรัศมีส่งฟรี"}
          </span>
        )}
      </div>
      {msg && <p className="dm-msg">{msg}</p>}
      <p className="dm-hint">ลากหมุดสีแดง หรือแตะบนแผนที่ ให้ตรงจุดที่จะรับของ</p>
    </div>
  );
}
