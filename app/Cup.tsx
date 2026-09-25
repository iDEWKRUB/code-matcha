import { useId } from "react";
import { MILKS, type Temp } from "@/lib/menu";

// ถ้วยการ์ตูน: โหมด still สำหรับการ์ดเมนู, โหมด animate เล่นฉากชง (เทฐาน → เทมัทฉะ → น้ำแข็ง/ฟอง)

const INK = "#1c2419";
const WATER = "#d3ebf1";
const SODA = "#f6dc72";
const COCONUT = "#e6f0d8";
const MILK_COLOR: Record<string, string> = { fresh: "#fbfaf3", oat: "#efdfc0", almond: "#f3e2cf" };

type Recipe = {
  base: "water" | "milk" | "soda" | "coconut";
  top: string;
  topLabel: string;
  mixed: string;
  layered: boolean;
  tint: string;
  bottom?: { color: string; label: string }; // ชั้นล่างสุด เช่น ซอสสตรอว์เบอร์รี่
  foamCap?: boolean; // ฟองมัทฉะตีเย็นด้านบน
  premixed?: string; // เทแบบคนมาแล้วทั้งแก้ว (ไม่เห็นสีนม) + ชื่อที่ใช้ในคำบรรยาย
};

const RECIPES: Record<string, Recipe> = {
  usucha: { base: "water", top: "#6f9a35", topLabel: "มัทฉะ", mixed: "#7fa640", layered: false, tint: "#e3eecd" },
  "matcha-latte": { base: "milk", top: "#6f9a35", topLabel: "มัทฉะ", mixed: "#a9c47a", layered: true, tint: "#e8f0d8" },
  "ceremonial-latte": { base: "milk", top: "#3f6b1f", topLabel: "มัทฉะเกรดพิธี", mixed: "#8fb060", layered: true, tint: "#dbe8c6" },
  "hojicha-latte": { base: "milk", top: "#8a5a35", topLabel: "โฮจิฉะ", mixed: "#c49a74", layered: true, tint: "#f1e4d3" },
  "yuzu-sparkling": { base: "soda", top: "#6f9a35", topLabel: "มัทฉะ", mixed: "#b5c957", layered: true, tint: "#fbf0c4" },
  "cold-whisk-latte": {
    base: "milk",
    top: "#c9dc6a",
    topLabel: "ฟองมัทฉะตีเย็น",
    mixed: "#a3c23c",
    layered: false,
    tint: "#eef3cf",
    foamCap: true,
    premixed: "มัทฉะลาเต้ที่คนแล้ว",
  },
  "coconut-matcha": { base: "coconut", top: "#6f9a35", topLabel: "มัทฉะ", mixed: "#a8c46e", layered: true, tint: "#e9f3e1" },
  "strawberry-matcha": {
    base: "milk",
    top: "#6f9a35",
    topLabel: "มัทฉะ",
    mixed: "#c9b08f",
    layered: true,
    tint: "#fbe2e6",
    bottom: { color: "#e0566b", label: "ซอสสตรอว์เบอร์รี่" },
  },
};
const FALLBACK = RECIPES["matcha-latte"];

export const tintOf = (id: string) => (RECIPES[id] ?? FALLBACK).tint;

const GLASS = "M42 62 L158 62 L147 226 Q146 234 138 234 L62 234 Q54 234 53 226 Z";
const MUG = "M44 96 L156 96 L150 222 Q148 236 134 236 L66 236 Q52 236 50 222 Z";
const ICE: [number, number, number][] = [
  [62, 96, -14],
  [98, 102, 12],
  [126, 94, -6],
];

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.min(255, Math.round(((n >> s) & 255) * f));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

function Pour({ color, delay, bottom }: { color: string; delay: number; bottom: number }) {
  return (
    <>
      <rect className="stream" x="96" y="40" width="8" height={bottom - 44} rx="4" fill={color} stroke={INK} strokeWidth="1.5" style={{ animationDelay: `${delay + 0.25}s` }} />
      <g className="vessel" style={{ animationDelay: `${delay}s` }}>
        <path d="M150 12 q12 0 12 10 q0 10 -12 10" fill="none" stroke={INK} strokeWidth="3.5" />
        <path d="M112 6 H150 V34 Q150 40 144 40 H118 Q112 40 112 34 V22 L98 30 L106 14 Z" fill={color} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      </g>
    </>
  );
}

type Props = {
  itemId: string;
  temp: Temp;
  milk: string | null;
  sweet?: number; // -1 = ไม่แสดงก้อนน้ำตาล
  powder?: string | null;
  extraShot?: boolean;
  softCream?: boolean;
  animate?: boolean;
  size?: number;
};

const BASE_COLOR = { water: WATER, soda: SODA, coconut: COCONUT } as const;
const BASE_LABEL = { soda: "โซดายูซุ", coconut: "น้ำมะพร้าว" } as const;

export default function Cup(props: Props) {
  const { itemId, temp, milk, sweet = -1, powder = null, extraShot = false, softCream = false, animate = false, size = 160 } = props;
  const clip = "cup" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = RECIPES[itemId] ?? FALLBACK;
  const hot = temp === "hot";
  const g = hot ? { body: MUG, top: 118, bottom: 236, layer: 160 } : { body: GLASS, top: 92, bottom: 234, layer: 138 };
  // ผงยาเมะสีเข้มกว่า, เพิ่มช็อตเข้มขึ้นอีก
  const depth = (powder === "yame" ? 0.88 : 1) * (extraShot ? 0.8 : 1);
  const top = shade(r.top, depth);
  const mixed = shade(r.mixed, 0.4 + depth * 0.6);
  const base = r.premixed ? mixed : r.base === "milk" ? MILK_COLOR[milk ?? "fresh"] ?? MILK_COLOR.fresh : BASE_COLOR[r.base];
  const layered = r.layered && !hot;
  const latteArt = hot && r.base === "milk";
  const wave = `M0 ${g.layer} ${"q12.5 9 25 0 ".repeat(8)}V${g.top} H0 Z`;
  const bottomY = g.bottom - 50;
  const bottomWave = `M0 ${bottomY} ${"q12.5 -9 25 0 ".repeat(8)}V${g.bottom + 4} H0 Z`;
  const cream = softCream && !hot;

  const baseLabel = r.premixed
    ? r.premixed
    : r.base === "milk" ? MILKS.find((m) => m.id === milk)?.label ?? "นม" : r.base === "water" ? (hot ? "น้ำอุ่น" : "น้ำ") : BASE_LABEL[r.base];
  const steps: [string, number][] = [
    [r.bottom ? `ใส่${r.bottom.label}และ${baseLabel}…` : `เท${baseLabel}…`, 0.05],
    [`ใส่${r.topLabel}…`, 1.1],
    [hot ? (latteArt ? "ตีฟองนม…" : "ตีให้เป็นฟอง…") : "ใส่น้ำแข็ง…", 1.95],
    ["เสร็จแล้ว! พร้อมเสิร์ฟ", 2.7],
  ];

  return (
    <div className="cup-wrap">
      <svg className={`cup ${animate ? "brew" : "still"}`} viewBox="0 0 200 250" width={size} height={size * 1.25} aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <path d={g.body} />
          </clipPath>
        </defs>

        {hot && (
          <g className="steam">
            {[78, 100, 122].map((x, i) => (
              <path key={x} d={`M${x} 86 q-8 -10 0 -20 q8 -10 0 -20`} style={{ animationDelay: `${(animate ? 2.4 : 0) + i * 0.6}s` }} />
            ))}
          </g>
        )}

        {animate && <Pour color={base} delay={0} bottom={g.bottom} />}
        {animate && <Pour color={top} delay={1.15} bottom={g.bottom} />}

        <g className="body-g">
          <path d={g.body} fill="rgba(255,255,255,.6)" />
          {!hot && <path d="M142 26 L124 214" stroke="#c23b22" strokeWidth="8" strokeLinecap="round" />}
          <g clipPath={`url(#${clip})`}>
            <rect className="rise" x="0" y={g.top} width="200" height={g.bottom - g.top + 4} fill={base} style={{ animationDelay: ".3s" }} />
            {r.bottom && layered && (
              <g className="rise" style={{ animationDelay: ".3s" }}>
                <path d={bottomWave} fill={r.bottom.color} />
              </g>
            )}
            {layered ? (
              <g className="settle" style={{ animationDelay: "1.45s" }}>
                <path d={wave} fill={top} />
                {r.foamCap && <rect x="0" y={g.top} width="200" height="16" fill={shade(r.top, depth * 1.35)} />}
              </g>
            ) : (
              <g className="blend" style={{ animationDelay: "1.55s" }}>
                <rect x="0" y={g.top} width="200" height={g.bottom - g.top + 4} fill={mixed} />
                {r.foamCap && !hot && <path d={`M0 ${g.top + 16} ${"q12.5 5 25 0 ".repeat(8)}V${g.top} H0 Z`} fill={shade(r.mixed, depth * 1.12)} />}
              </g>
            )}
            {r.base === "soda" &&
              [60, 85, 110, 135, 72, 124].map((x, i) => (
                <circle key={i} className="bubble" cx={x} cy={222 - (i % 3) * 30} r={i % 2 ? 3 : 4} style={{ animationDelay: `${i * 0.35}s` }} />
              ))}
            {hot && (
              <g className="foam" style={{ animationDelay: "2s" }}>
                <ellipse cx="100" cy={g.top} rx="60" ry="12" fill={latteArt ? "#fbf6ea" : "#bcd47c"} />
                {latteArt && (
                  <path
                    d={`M100 ${g.top + 5} c-5 -3.5 -9 -6.5 -9 -9.5 a4.5 4.5 0 0 1 9 -1 a4.5 4.5 0 0 1 9 1 c0 3 -4 6 -9 9.5 z`}
                    fill={top}
                    opacity=".6"
                  />
                )}
              </g>
            )}
            {!hot &&
              ICE.map(([x, y, rot], i) => (
                <g key={i} className="ice" style={{ animationDelay: `${2 + i * 0.12}s` }}>
                  <rect x={x} y={y} width="26" height="26" rx="6" transform={`rotate(${rot} ${x + 13} ${y + 13})`} fill="rgba(255,255,255,.72)" stroke="#fff" strokeWidth="2" />
                </g>
              ))}
          </g>

          <path d={g.body} fill="none" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          {hot && (
            <>
              <path d="M153 122 Q186 122 184 156 Q182 188 148 190" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
              <path d="M152 136 Q171 136 170 156 Q169 175 149 176" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
            </>
          )}
          <path d={hot ? "M60 112 L64 200" : "M58 78 L66 204"} stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".75" />
          {cream && (
            <g className="pop">
              <ellipse cx="100" cy="60" rx="48" ry="13" fill="#fffaf0" stroke={INK} strokeWidth="3" />
              <ellipse cx="100" cy="45" rx="36" ry="12" fill="#fffaf0" stroke={INK} strokeWidth="3" />
              <ellipse cx="100" cy="31" rx="23" ry="10" fill="#fffaf0" stroke={INK} strokeWidth="3" />
              <path d="M92 24 Q100 4 108 22" fill="#fffaf0" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
              <path d="M76 44 Q84 40 90 44" fill="none" stroke="#e6dcc6" strokeWidth="3" strokeLinecap="round" />
            </g>
          )}

          <g className="eyes">
            <ellipse cx="86" cy="180" rx="4.5" ry="6" fill={INK} />
            <ellipse cx="114" cy="180" rx="4.5" ry="6" fill={INK} />
            <circle cx="87.5" cy="177.5" r="1.6" fill="#fff" />
            <circle cx="115.5" cy="177.5" r="1.6" fill="#fff" />
          </g>
          <path d="M93 192 Q100 199 107 192" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="74" cy="192" r="7" fill="#f29c9c" opacity=".6" />
          <circle cx="126" cy="192" r="7" fill="#f29c9c" opacity=".6" />
        </g>

        {sweet > 0 && (
          <g key={`sweet-${sweet}`}>
            {Array.from({ length: sweet / 25 }, (_, i) => (
              <g key={i} className="pop" style={{ animationDelay: `${i * 0.07}s` }}>
                <rect x="8" y={214 - i * 22} width="20" height="20" rx="4" fill="#fff" stroke={INK} strokeWidth="2.5" />
                <circle cx="15" cy={223 - i * 22} r="1.4" fill={INK} />
                <circle cx="21" cy={223 - i * 22} r="1.4" fill={INK} />
              </g>
            ))}
          </g>
        )}
        {extraShot && (
          <g className="pop">
            <path d="M176 58 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z" fill="#9db54a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <text x="166" y="104" fontSize="15" fontWeight="700" fill={INK}>+1</text>
          </g>
        )}
      </svg>

      {animate && (
        <p className="brew-cap" aria-hidden="true">
          {steps.map(([t, d], i) => (
            <span key={i} className={`cap${i === steps.length - 1 ? " last" : ""}`} style={{ animationDelay: `${d}s` }}>
              {t}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
