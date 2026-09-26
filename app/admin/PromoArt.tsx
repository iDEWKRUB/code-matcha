"use client";

import { forwardRef } from "react";
import type { MenuItem } from "@/lib/menu";
import type { PromoRule } from "@/lib/promo";
import MenuArt from "../MenuArt";
import Seal from "../Seal";

// แม่แบบรูปโปร 1040x676 (สัดส่วน 20:13 ตรงกับช่องรูปในการ์ด LINE) ใช้ gen เป็นรูปจริงด้วย html-to-image

export const THEMES = {
  orange: { label: "ส้มอบอุ่น", bg: "radial-gradient(120% 120% at 0% 0%, #fff4d6 0%, #fde3b5 55%, #f7c98a 100%)", ink: "#3a2410", accent: "#c23b22", soft: "#6b4a2a", circle: "#fff8e8", code: "#4b6b2f" },
  matcha: { label: "เขียวมัทฉะ", bg: "radial-gradient(120% 120% at 0% 0%, #f4f8e6 0%, #dfeac2 55%, #b9cf86 100%)", ink: "#1f2e14", accent: "#3f6b1f", soft: "#4b5a3a", circle: "#fbfdf3", code: "#c23b22" },
  sakura: { label: "ชมพูซากุระ", bg: "radial-gradient(120% 120% at 0% 0%, #fff4f5 0%, #fbdde2 55%, #f3b6c1 100%)", ink: "#3d1a22", accent: "#c2334f", soft: "#7a4a55", circle: "#fff9fa", code: "#4b6b2f" },
} as const;
export type Theme = keyof typeof THEMES;

// "เมนูใหม่! ข้าวไข่เจียว" → หัวเล็ก "เมนูใหม่!" + หัวใหญ่ "ข้าวไข่เจียว"
function splitTitle(t: string) {
  const i = t.indexOf("!");
  return i > 0 && i < t.length - 1 ? { kicker: t.slice(0, i + 1).trim(), head: t.slice(i + 1).trim() } : { kicker: "", head: t.trim() };
}

// ขยายตัวเลขราคา (฿29) ให้ใหญ่และเด่น
function PriceLine({ text, color }: { text: string; color: string }) {
  const m = text.match(/฿\s?\d[\d,]*/);
  if (!m || m.index === undefined) return <>{text}</>;
  return (
    <>
      {text.slice(0, m.index)}
      <b style={{ fontSize: 76, color, margin: "0 10px 0 6px", lineHeight: 1 }}>{m[0].replace(/\s/, "")}</b>
      {text.slice(m.index + m[0].length)}
    </>
  );
}

const SAMPLE_TOPPINGS = ["shrimp", "crab", "tomato", "herbs", "chili"];

type Props = { title: string; subtitle: string; item: MenuItem | null; code: PromoRule | null; theme: Theme; showNew: boolean };

const PromoArt = forwardRef<HTMLDivElement, Props>(function PromoArt({ title, subtitle, item, code, theme, showNew }, ref) {
  const t = THEMES[theme];
  const { kicker, head } = splitTitle(title || "โปรโมชั่น");
  const headSize = head.length > 16 ? 58 : head.length > 11 ? 72 : 92;
  return (
    <div
      ref={ref}
      style={{
        width: 1040,
        height: 676,
        display: "grid",
        gridTemplateColumns: "470px 1fr",
        background: t.bg,
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--sans)",
        color: t.ink,
      }}
    >
      <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: t.circle, boxShadow: "0 30px 60px -30px rgba(120,70,20,.45)" }} />
        {showNew && (
          <div
            style={{
              position: "absolute",
              top: 70,
              left: 50,
              zIndex: 2,
              width: 110,
              height: 110,
              borderRadius: "50%",
              background: t.accent,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 34,
              transform: "rotate(-12deg)",
              border: "5px dashed rgba(255,255,255,.55)",
            }}
          >
            NEW
          </div>
        )}
        <div style={{ position: "relative" }}>
          {item && <MenuArt item={item} size={item.kind === "food" ? 380 : 300} toppings={item.id === "omelette-rice" ? SAMPLE_TOPPINGS : undefined} />}
        </div>
      </div>

      <div style={{ position: "relative", padding: "56px 48px 40px 10px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontWeight: 700, fontSize: 22, letterSpacing: ".06em", color: "#4b6b2f" }}>
          <Seal size={54} />
          <span>CODE-MACHA</span>
        </div>
        {kicker && <p style={{ margin: "26px 0 0", fontSize: 34, fontWeight: 700, color: t.accent }}>{kicker}</p>}
        <h1 style={{ margin: kicker ? 0 : "30px 0 0", fontSize: headSize, lineHeight: 1.1, color: t.ink }}>{head}</h1>
        {subtitle && (
          <p style={{ margin: "10px 0 0", fontSize: 34, fontWeight: 600, color: t.soft, display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
            <PriceLine text={subtitle} color={t.accent} />
          </p>
        )}
        {code && (
          <div style={{ marginTop: "auto", display: "flex", alignItems: "stretch", background: "#fff", borderRadius: 20, border: `3px dashed ${t.accent}`, overflow: "hidden" }}>
            <div style={{ padding: "14px 22px", display: "grid" }}>
              <small style={{ fontSize: 20, color: t.soft, fontWeight: 600 }}>{code.newCustomersOnly ? "ลูกค้าใหม่ลดเพิ่ม" : "ส่วนลด"}</small>
              <b style={{ fontSize: 44, color: t.accent, lineHeight: 1.1 }}>{code.kind === "percent" ? `${code.value}%` : `฿${code.value}`}</b>
            </div>
            <div style={{ flex: 1, background: t.code, padding: "14px 22px", display: "grid" }}>
              <small style={{ fontSize: 20, color: "#ffffffcc", fontWeight: 600 }}>ใช้โค้ด</small>
              <b style={{ fontSize: 44, color: "#fff", lineHeight: 1.1, fontFamily: "ui-monospace, Consolas, monospace", letterSpacing: ".08em" }}>{code.code}</b>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default PromoArt;
