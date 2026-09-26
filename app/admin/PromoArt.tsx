"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import type { MenuItem } from "@/lib/menu";
import type { PromoRule } from "@/lib/promo";
import MenuArt from "../MenuArt";
import Seal from "../Seal";

// แม่แบบรูปโปรของร้าน ใช้ gen เป็นรูปจริงด้วย html-to-image (ฟอนต์และการ์ตูนชุดเดียวกับหน้าเว็บ)

export const THEMES = {
  orange: { label: "ส้มอบอุ่น", bg: "radial-gradient(120% 120% at 0% 0%, #fff4d6 0%, #fde3b5 55%, #f7c98a 100%)", ink: "#3a2410", accent: "#c23b22", soft: "#6b4a2a", circle: "#fff8e8", code: "#4b6b2f" },
  matcha: { label: "เขียวมัทฉะ", bg: "radial-gradient(120% 120% at 0% 0%, #f4f8e6 0%, #dfeac2 55%, #b9cf86 100%)", ink: "#1f2e14", accent: "#3f6b1f", soft: "#4b5a3a", circle: "#fbfdf3", code: "#c23b22" },
  sakura: { label: "ชมพูซากุระ", bg: "radial-gradient(120% 120% at 0% 0%, #fff4f5 0%, #fbdde2 55%, #f3b6c1 100%)", ink: "#3d1a22", accent: "#c2334f", soft: "#7a4a55", circle: "#fff9fa", code: "#4b6b2f" },
  night: { label: "มัทฉะเข้ม", bg: "radial-gradient(120% 120% at 0% 0%, #4a6b2c 0%, #2c4220 60%, #1c2a15 100%)", ink: "#fbfcf6", accent: "#f6c445", soft: "#dfe8c9", circle: "#3d5a26", code: "#c23b22" },
} as const;
export type Theme = keyof typeof THEMES;

export const LAYOUTS = {
  classic: "คลาสสิก",
  price: "ราคาเด่น",
  duo: "คู่หู (2 เมนู)",
  ticket: "คูปอง",
} as const;
export type Layout = keyof typeof LAYOUTS;

export const FORMATS = {
  line: { label: "การ์ด LINE (แนวนอน)", w: 1040, h: 676 },
  square: { label: "โพสต์ IG/FB (1:1)", w: 1080, h: 1080 },
  story: { label: "Story (แนวตั้ง)", w: 1080, h: 1920 },
} as const;
export type Format = keyof typeof FORMATS;

type Props = {
  title: string;
  subtitle: string;
  item: MenuItem | null;
  item2?: MenuItem | null;
  code: PromoRule | null;
  theme: Theme;
  badge: string; // ป้ายมุม เช่น NEW, HOT, 1 แถม 1 (ว่าง = ไม่ใส่)
  layout: Layout;
  format: Format;
};

type T = (typeof THEMES)[Theme];

// "เมนูใหม่! ข้าวไข่เจียว" → หัวเล็ก + หัวใหญ่
function splitTitle(t: string) {
  const i = t.indexOf("!");
  return i > 0 && i < t.length - 1 ? { kicker: t.slice(0, i + 1).trim(), head: t.slice(i + 1).trim() } : { kicker: "", head: t.trim() };
}
const priceOf = (s: string) => s.match(/฿\s?\d[\d,]*/);

function PriceLine({ text, color, size }: { text: string; color: string; size: number }) {
  const m = priceOf(text);
  if (!m || m.index === undefined) return <>{text}</>;
  return (
    <>
      {text.slice(0, m.index)}
      <b style={{ fontSize: size, color, margin: "0 10px 0 6px", lineHeight: 1 }}>{m[0].replace(/\s/, "")}</b>
      {text.slice(m.index + m[0].length)}
    </>
  );
}

const SAMPLE_TOPPINGS = ["shrimp", "crab", "tomato", "herbs", "chili"];
const Art = ({ item, size }: { item: MenuItem | null | undefined; size: number }) =>
  item ? <MenuArt item={item} size={item.kind === "food" ? size : size * 0.8} toppings={item.id === "omelette-rice" ? SAMPLE_TOPPINGS : undefined} /> : null;

// onPaper = วางบนพื้นขาว (ตั๋วคูปอง) ใช้สีเขียวเสมอ
function Brand({ t, size = 54, onPaper = false }: { t: T; size?: number; onPaper?: boolean }) {
  const dark = !onPaper && t.ink === "#fbfcf6";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontWeight: 700, fontSize: size * 0.41, letterSpacing: ".06em", color: dark ? "#dfe8c9" : "#4b6b2f" }}>
      <Seal size={size} />
      <span>CODE-MACHA</span>
    </div>
  );
}

function Badge({ text, t, style }: { text: string; t: T; style: CSSProperties }) {
  if (!text) return null;
  const long = text.length > 4;
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 3,
        width: long ? 150 : 116,
        height: long ? 150 : 116,
        borderRadius: "50%",
        background: t.accent,
        color: t.accent === "#f6c445" ? "#1c2419" : "#fff",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        fontWeight: 800,
        fontSize: long ? 30 : 34,
        lineHeight: 1.1,
        padding: 12,
        transform: "rotate(-12deg)",
        border: "5px dashed rgba(255,255,255,.55)",
        boxShadow: "0 10px 20px -8px rgba(0,0,0,.35)",
        ...style,
      }}
    >
      {text}
    </div>
  );
}

function Coupon({ code, t, scale = 1 }: { code: PromoRule; t: T; scale?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", background: "#fff", borderRadius: 20 * scale, border: `${3 * scale}px dashed ${t.accent}`, overflow: "hidden" }}>
      <div style={{ padding: `${14 * scale}px ${22 * scale}px`, display: "grid" }}>
        <small style={{ fontSize: 20 * scale, color: "#6b4a2a", fontWeight: 600 }}>{code.newCustomersOnly ? "ลูกค้าใหม่ลดเพิ่ม" : "ส่วนลด"}</small>
        <b style={{ fontSize: 44 * scale, color: t.accent === "#f6c445" ? "#c23b22" : t.accent, lineHeight: 1.1 }}>{code.kind === "percent" ? `${code.value}%` : `฿${code.value}`}</b>
      </div>
      <div style={{ flex: 1, background: t.code, padding: `${14 * scale}px ${22 * scale}px`, display: "grid" }}>
        <small style={{ fontSize: 20 * scale, color: "#ffffffcc", fontWeight: 600 }}>ใช้โค้ด</small>
        <b style={{ fontSize: 44 * scale, color: "#fff", lineHeight: 1.1, fontFamily: "ui-monospace, Consolas, monospace", letterSpacing: ".08em" }}>{code.code}</b>
      </div>
    </div>
  );
}

function Circle({ t, size, children }: { t: T; size: number; children: ReactNode }) {
  return (
    <div style={{ position: "relative", display: "grid", placeItems: "center", width: size, height: size }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: t.circle, boxShadow: "0 30px 60px -30px rgba(80,50,20,.45)" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 10 }}>{children}</div>
    </div>
  );
}

// ---------- แนวนอน (การ์ด LINE) ----------
function Landscape({ title, subtitle, item, item2, code, t, badge, layout }: Omit<Props, "theme" | "format"> & { t: T }) {
  const { kicker, head } = splitTitle(title || "โปรโมชั่น");
  const headSize = head.length > 16 ? 58 : head.length > 11 ? 72 : 92;

  if (layout === "price") {
    const m = priceOf(subtitle);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", height: "100%" }}>
        <div style={{ padding: "50px 20px 40px 56px", display: "flex", flexDirection: "column" }}>
          <Brand t={t} />
          <p style={{ margin: "22px 0 0", fontSize: 40, fontWeight: 700, color: t.ink }}>{title}</p>
          <p style={{ margin: 0, fontSize: 200, fontWeight: 800, color: t.accent, lineHeight: 1, letterSpacing: "-.02em" }}>{m ? m[0].replace(/\s/, "") : ""}</p>
          <p style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 600, color: t.soft }}>{m ? subtitle.replace(m[0], "").trim() : subtitle}</p>
          {code && <div style={{ marginTop: "auto" }}><Coupon code={code} t={t} scale={0.85} /></div>}
        </div>
        <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
          <Badge text={badge} t={t} style={{ top: 60, right: 40 }} />
          <Circle t={t} size={380}>
            <Art item={item} size={340} />
          </Circle>
        </div>
      </div>
    );
  }

  if (layout === "duo") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", padding: "34px 50px 36px" }}>
        <Brand t={t} size={46} />
        <p style={{ margin: "14px 0 0", fontSize: 54, fontWeight: 800, color: t.ink, textAlign: "center", lineHeight: 1.15 }}>{title}</p>
        <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 40, margin: "10px 0 0" }}>
          <Circle t={t} size={290}>
            <Art item={item} size={260} />
          </Circle>
          <div style={{ alignSelf: "center", fontSize: 70, fontWeight: 800, color: t.accent }}>+</div>
          <Circle t={t} size={290}>
            <Art item={item2 ?? item} size={260} />
          </Circle>
          <Badge text={badge} t={t} style={{ top: -20, left: -40 }} />
        </div>
        <p style={{ margin: "auto 0 0", fontSize: 34, fontWeight: 600, color: t.soft, display: "flex", alignItems: "baseline" }}>
          <PriceLine text={subtitle} color={t.accent} size={64} />
          {code && <span style={{ marginLeft: 18, fontSize: 26, background: "#fff", color: "#1c2419", borderRadius: 999, padding: "6px 18px", fontFamily: "ui-monospace, Consolas, monospace" }}>โค้ด {code.code}</span>}
        </p>
      </div>
    );
  }

  if (layout === "ticket") {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
        <div style={{ position: "relative", width: 900, height: 520, background: "#fffdf7", borderRadius: 34, display: "grid", gridTemplateColumns: "1fr 300px", boxShadow: "0 30px 60px -30px rgba(0,0,0,.45)", overflow: "hidden" }}>
          <div style={{ padding: "40px 30px 36px 46px", display: "flex", flexDirection: "column", color: "#1c2419" }}>
            <Brand t={t} size={46} onPaper />
            <p style={{ margin: "18px 0 0", fontSize: 30, fontWeight: 700, color: t.accent === "#f6c445" ? "#c23b22" : t.accent }}>{title}</p>
            <p style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 600, color: "#6b4a2a", display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
              <PriceLine text={subtitle} color={t.accent === "#f6c445" ? "#c23b22" : t.accent} size={60} />
            </p>
            <div style={{ marginTop: "auto", borderTop: "3px dashed #e3d8c2", paddingTop: 20 }}>
              <small style={{ fontSize: 22, color: "#6b7163", fontWeight: 600 }}>ใช้โค้ดตอนสั่งผ่าน LINE</small>
              <p style={{ margin: 0, fontSize: 64, fontWeight: 800, letterSpacing: ".08em", fontFamily: "ui-monospace, Consolas, monospace", color: "#1c2419" }}>{code?.code ?? "—"}</p>
            </div>
          </div>
          <div style={{ position: "relative", background: t.code, display: "grid", placeItems: "center", borderLeft: "4px dashed #fffdf7" }}>
            <div style={{ color: "#fff", textAlign: "center" }}>
              <small style={{ fontSize: 24, opacity: 0.85, fontWeight: 600 }}>{code?.newCustomersOnly ? "ลูกค้าใหม่ลด" : "ส่วนลด"}</small>
              <p style={{ margin: 0, fontSize: 110, fontWeight: 800, lineHeight: 1 }}>{code ? (code.kind === "percent" ? `${code.value}%` : `฿${code.value}`) : "SALE"}</p>
            </div>
            <div style={{ position: "absolute", bottom: 14, right: 14, opacity: 0.95 }}>
              <Art item={item} size={120} />
            </div>
          </div>
          {/* รอยเจาะตั๋ว */}
          <div style={{ position: "absolute", top: -26, right: 274, width: 52, height: 52, borderRadius: "50%", background: "rgba(0,0,0,.08)" }} />
          <div style={{ position: "absolute", bottom: -26, right: 274, width: 52, height: 52, borderRadius: "50%", background: "rgba(0,0,0,.08)" }} />
        </div>
        <Badge text={badge} t={t} style={{ top: 40, left: 50 }} />
      </div>
    );
  }

  // classic
  return (
    <div style={{ display: "grid", gridTemplateColumns: "470px 1fr", height: "100%" }}>
      <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
        <Badge text={badge} t={t} style={{ top: 70, left: 50 }} />
        <Circle t={t} size={400}>
          <Art item={item} size={380} />
        </Circle>
      </div>
      <div style={{ padding: "56px 48px 40px 10px", display: "flex", flexDirection: "column" }}>
        <Brand t={t} />
        {kicker && <p style={{ margin: "26px 0 0", fontSize: 34, fontWeight: 700, color: t.accent }}>{kicker}</p>}
        <h1 style={{ margin: kicker ? 0 : "30px 0 0", fontSize: headSize, lineHeight: 1.1, color: t.ink }}>{head}</h1>
        {subtitle && (
          <p style={{ margin: "10px 0 0", fontSize: 34, fontWeight: 600, color: t.soft, display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
            <PriceLine text={subtitle} color={t.accent} size={76} />
          </p>
        )}
        {code && <div style={{ marginTop: "auto" }}><Coupon code={code} t={t} /></div>}
      </div>
    </div>
  );
}

// ---------- แนวตั้ง / สี่เหลี่ยม (โพสต์โซเชียล) ----------
function Portrait({ title, subtitle, item, item2, code, t, badge, layout, story }: Omit<Props, "theme" | "format"> & { t: T; story: boolean }) {
  const { kicker, head } = splitTitle(title || "โปรโมชั่น");
  const artSize = story ? 620 : 470;
  const duo = layout === "duo";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", padding: story ? "120px 80px 140px" : "56px 70px 60px", textAlign: "center" }}>
      <Brand t={t} size={story ? 72 : 56} />
      <div style={{ position: "relative", margin: story ? "70px 0 40px" : "26px 0 16px", display: "flex", alignItems: "flex-end", gap: 24 }}>
        <Badge text={badge} t={t} style={{ top: -10, left: -30 }} />
        {duo ? (
          <>
            <Circle t={t} size={artSize * 0.7}>
              <Art item={item} size={artSize * 0.62} />
            </Circle>
            <Circle t={t} size={artSize * 0.7}>
              <Art item={item2 ?? item} size={artSize * 0.62} />
            </Circle>
          </>
        ) : (
          <Circle t={t} size={artSize}>
            <Art item={item} size={artSize * (item?.kind === "food" ? 0.74 : 0.9)} />
          </Circle>
        )}
      </div>
      {kicker && <p style={{ margin: 0, fontSize: story ? 56 : 40, fontWeight: 700, color: t.accent }}>{kicker}</p>}
      <h1 style={{ margin: 0, fontSize: story ? 130 : head.length > 12 ? 76 : 96, lineHeight: 1.1, color: t.ink }}>{head}</h1>
      {subtitle && (
        <p style={{ margin: story ? "20px 0 0" : "8px 0 0", fontSize: story ? 50 : 38, fontWeight: 600, color: t.soft, display: "flex", alignItems: "baseline", justifyContent: "center", flexWrap: "wrap" }}>
          <PriceLine text={subtitle} color={t.accent} size={story ? 130 : layout === "price" ? 120 : 90} />
        </p>
      )}
      {code && (
        <div style={{ marginTop: "auto", width: "100%" }}>
          <Coupon code={code} t={t} scale={story ? 1.5 : 1.15} />
        </div>
      )}
      <p style={{ margin: story ? "40px 0 0" : "18px 0 0", fontSize: story ? 38 : 26, fontWeight: 700, color: t.soft }}>สั่งผ่าน LINE @745plqxi</p>
    </div>
  );
}

const PromoArt = forwardRef<HTMLDivElement, Props>(function PromoArt(props, ref) {
  const t = THEMES[props.theme];
  const f = FORMATS[props.format];
  return (
    <div ref={ref} style={{ width: f.w, height: f.h, background: t.bg, position: "relative", overflow: "hidden", fontFamily: "var(--sans)", color: t.ink }}>
      {props.format === "line" ? <Landscape {...props} t={t} /> : <Portrait {...props} t={t} story={props.format === "story"} />}
    </div>
  );
});

export default PromoArt;
