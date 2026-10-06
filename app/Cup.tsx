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
  soda?: string; // สีโซดา (แทนสีโซดายูซุเดิม)
  baseLabel?: string; // ชื่อฐานในคำบรรยายตอนชง
  noTop?: boolean; // ไม่มีชั้นบน (โซดาผลไม้: ไซรัปอยู่ล่าง โซดาใสด้านบน)
  garnish?: Garnish; // ผลไม้แต่งขอบแก้ว
  seeds?: boolean; // เมล็ดในชั้นไซรัป (เสาวรส)
};
type Garnish = "yuzu" | "strawberry" | "lychee" | "mango" | "passion" | "kiwi";

// โซดาผลไม้: ไซรัปผลไม้ชั้นล่าง + โซดาใส + ฟองซ่า + ผลไม้บนขอบแก้ว
const fruitSoda = (syrup: string, label: string, soda: string, tint: string, garnish: Garnish, extra: Partial<Recipe> = {}): Recipe => ({
  base: "soda",
  soda,
  baseLabel: "โซดา",
  top: syrup,
  topLabel: `${label === "ไซรัปยูซุ" ? "ยูซุ" : label.replace("ไซรัป", "")}แต่งแก้ว`,
  mixed: syrup,
  layered: true,
  noTop: true,
  tint,
  bottom: { color: syrup, label },
  garnish,
  ...extra,
});

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
  "yuzu-soda": fruitSoda("#f2c531", "ไซรัปยูซุ", "#fbf5d4", "#fbf0c4", "yuzu"),
  "strawberry-soda": fruitSoda("#e0566b", "ไซรัปสตรอว์เบอร์รี่", "#fde6ea", "#fbe2e6", "strawberry"),
  "lychee-soda": fruitSoda("#f2a7b6", "ไซรัปลิ้นจี่", "#fdf0f2", "#fceef1", "lychee"),
  "mango-soda": fruitSoda("#f6a524", "ไซรัปมะม่วง", "#fef0d2", "#fdebc8", "mango"),
  "passion-soda": fruitSoda("#eaa11e", "ไซรัปเสาวรส", "#fdf1d0", "#f3e6ef", "passion", { seeds: true }),
  "kiwi-soda": fruitSoda("#8cc63f", "ไซรัปกีวี", "#eef7dc", "#e6f2d2", "kiwi", { seeds: true }),
  cocoa: { base: "milk", top: "#6b4027", topLabel: "โกโก้", mixed: "#9a6a4a", layered: true, tint: "#f0e2d6" },
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

// ผลไม้บนขอบแก้วด้านซ้าย (จุดกลางราว x 58, y 62)
function GarnishArt({ kind }: { kind: Garnish }) {
  const ring = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
  switch (kind) {
    case "yuzu":
      return (
        <g>
          <circle cx="56" cy="60" r="21" fill="#f2c531" stroke={INK} strokeWidth="3.5" />
          <circle cx="56" cy="60" r="15" fill="#fbe58c" />
          {ring.map((a, i) => (
            <path key={i} d={`M56 60 L${56 + Math.cos(a) * 14} ${60 + Math.sin(a) * 14}`} stroke="#f2c531" strokeWidth="2.5" />
          ))}
          <circle cx="56" cy="60" r="2.5" fill="#f2c531" />
        </g>
      );
    case "kiwi":
      return (
        <g>
          <circle cx="56" cy="60" r="21" fill="#7a5a33" stroke={INK} strokeWidth="3.5" />
          <circle cx="56" cy="60" r="17" fill="#8cc63f" />
          <circle cx="56" cy="60" r="11" fill="#c4e07a" />
          <ellipse cx="56" cy="60" rx="5" ry="4" fill="#f6f3d8" />
          {ring.map((a, i) => (
            <ellipse key={i} cx={56 + Math.cos(a) * 8} cy={60 + Math.sin(a) * 8} rx="1.6" ry="2.4" transform={`rotate(${(a * 180) / Math.PI + 90} ${56 + Math.cos(a) * 8} ${60 + Math.sin(a) * 8})`} fill={INK} />
          ))}
        </g>
      );
    case "strawberry":
      return (
        <g>
          <path d="M40 50 Q56 40 72 50 Q74 70 56 84 Q38 70 40 50 Z" fill="#e0566b" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M44 48 L50 40 L56 47 L62 40 L68 48 Q56 54 44 48 Z" fill="#6fae3b" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          {[[50, 60], [62, 60], [56, 68], [48, 70], [64, 70], [56, 77]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="1.4" ry="2" fill="#fde7a8" />
          ))}
        </g>
      );
    case "lychee":
      return (
        <g>
          <circle cx="50" cy="62" r="17" fill="#d9475f" stroke={INK} strokeWidth="3.5" />
          {[[44, 56], [54, 54], [46, 66], [56, 66], [51, 74], [40, 62]].map(([x, y], i) => (
            <path key={i} d={`M${x - 3} ${y} l3 -3 l3 3`} fill="none" stroke="#a52d43" strokeWidth="2" strokeLinecap="round" />
          ))}
          <circle cx="68" cy="68" r="12" fill="#fbf7ee" stroke={INK} strokeWidth="3" />
          <ellipse cx="65" cy="65" rx="4" ry="3" fill="#fff" />
          <path d="M44 46 q2 -6 8 -6" fill="none" stroke="#6fae3b" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "mango":
      return (
        <g strokeLinejoin="round">
          <path d="M38 56 L54 50 L66 58 L50 64 Z" fill="#ffd27a" stroke={INK} strokeWidth="3" />
          <path d="M38 56 L50 64 L50 80 L38 72 Z" fill="#f6a524" stroke={INK} strokeWidth="3" />
          <path d="M50 64 L66 58 L66 74 L50 80 Z" fill="#e38c12" stroke={INK} strokeWidth="3" />
          <path d="M60 46 L70 42 L78 48 L68 52 Z" fill="#ffd27a" stroke={INK} strokeWidth="2.5" />
          <path d="M60 46 L68 52 L68 62 L60 56 Z" fill="#f6a524" stroke={INK} strokeWidth="2.5" />
          <path d="M68 52 L78 48 L78 58 L68 62 Z" fill="#e38c12" stroke={INK} strokeWidth="2.5" />
        </g>
      );
    case "passion":
      return (
        <g>
          <circle cx="56" cy="60" r="21" fill="#6d3a6b" stroke={INK} strokeWidth="3.5" />
          <circle cx="56" cy="60" r="15" fill="#f2c94c" />
          {Array.from({ length: 11 }, (_, i) => {
            const a = (i / 11) * Math.PI * 2;
            const d = i % 2 ? 9 : 5;
            return <ellipse key={i} cx={56 + Math.cos(a) * d} cy={60 + Math.sin(a) * d} rx="2.2" ry="1.8" fill={INK} />;
          })}
        </g>
      );
  }
}

type Props = {
  itemId: string;
  temp: Temp;
  milk: string | null;
  sweet?: number; // -1 = ไม่แสดงก้อนน้ำตาล
  powder?: string | null; // "rich" = ผงเกรดสูง สีเข้มขึ้น
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
  const depth = (powder === "rich" ? 0.88 : 1) * (extraShot ? 0.8 : 1);
  const top = shade(r.top, depth);
  const mixed = shade(r.mixed, 0.4 + depth * 0.6);
  const base = r.premixed ? mixed : r.base === "milk" ? MILK_COLOR[milk ?? "fresh"] ?? MILK_COLOR.fresh : r.soda ?? BASE_COLOR[r.base];
  const layered = r.layered && !hot;
  const latteArt = hot && r.base === "milk";
  const wave = `M0 ${g.layer} ${"q12.5 9 25 0 ".repeat(8)}V${g.top} H0 Z`;
  const bottomY = g.bottom - 50;
  const bottomWave = `M0 ${bottomY} ${"q12.5 -9 25 0 ".repeat(8)}V${g.bottom + 4} H0 Z`;
  const cream = softCream && !hot;

  const baseLabel = r.premixed
    ? r.premixed
    : r.baseLabel ?? (r.base === "milk" ? MILKS.find((m) => m.id === milk)?.label ?? "นม" : r.base === "water" ? (hot ? "น้ำอุ่น" : "น้ำ") : BASE_LABEL[r.base]);
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
            {r.seeds && layered && (
              <g className="rise" style={{ animationDelay: ".3s" }} fill={INK} opacity=".75">
                {[64, 82, 100, 118, 136, 74, 92, 110, 128].map((x, i) => (
                  <ellipse key={i} cx={x} cy={bottomY + 22 + (i % 3) * 8} rx="2.4" ry="1.6" />
                ))}
              </g>
            )}
            {layered && r.noTop ? null : layered ? (
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
          {r.garnish && !hot && (
            <g className="pop" style={{ animationDelay: "2.3s" }}>
              <GarnishArt kind={r.garnish} />
            </g>
          )}
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
