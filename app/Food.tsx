// ภาพการ์ตูนอาหาร (สเกลเดียวกับ Cup: viewBox 200x250) ท็อปปิ้งที่เลือกจะเด้งขึ้นบนไข่เจียว

const INK = "#1c2419";

export const FOOD_TINT: Record<string, string> = { fries: "#fde6c4", "omelette-rice": "#fff0c2" };

function Face({ y, blush = "#f29c9c" }: { y: number; blush?: string }) {
  return (
    <>
      <g className="eyes">
        <ellipse cx="86" cy={y} rx="4.5" ry="6" fill={INK} />
        <ellipse cx="114" cy={y} rx="4.5" ry="6" fill={INK} />
        <circle cx="87.5" cy={y - 2.5} r="1.6" fill="#fff" />
        <circle cx="115.5" cy={y - 2.5} r="1.6" fill="#fff" />
      </g>
      <path d={`M93 ${y + 12} Q100 ${y + 19} 107 ${y + 12}`} fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="73" cy={y + 12} r="7" fill={blush} opacity=".6" />
      <circle cx="127" cy={y + 12} r="7" fill={blush} opacity=".6" />
    </>
  );
}

function Fries() {
  const sticks: [number, number, number][] = [
    [56, 52, -12], [72, 34, -6], [88, 44, -2], [100, 26, 1], [114, 40, 4], [128, 30, 8], [142, 50, 13],
  ];
  return (
    <>
      {sticks.map(([x, y, r], i) => (
        <rect key={i} x={x - 7} y={y} width="14" height="112" rx="4" fill={i % 2 ? "#f7c948" : "#f3bb33"} stroke={INK} strokeWidth="3" transform={`rotate(${r} ${x} 150)`} />
      ))}
      <path d="M38 112 L162 112 L149 228 Q148 236 139 236 L61 236 Q52 236 51 228 Z" fill="#d9432b" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M38 112 Q100 134 162 112" fill="#e8573e" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M58 132 L64 222" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".45" />
      <Face y={172} blush="#ffb4a8" />
    </>
  );
}

// ตำแหน่งท็อปปิ้งบนไข่เจียว (เลี่ยงบริเวณหน้า)
function ToppingArt({ id, i }: { id: string; i: number }) {
  switch (id) {
    case "crab":
      return (
        <g transform="rotate(-18 60 146)">
          <rect x="44" y="140" width="34" height="11" rx="5" fill="#fff" stroke={INK} strokeWidth="2.5" />
          <rect x="44" y="140" width="34" height="5" rx="2.5" fill="#e0493a" />
        </g>
      );
    case "beef":
      return (
        <>
          <circle cx="140" cy="146" r="8" fill="#8a5a3c" stroke={INK} strokeWidth="2.5" />
          <circle cx="152" cy="160" r="7" fill="#9b6a48" stroke={INK} strokeWidth="2.5" />
        </>
      );
    case "shrimp":
      return (
        <>
          {[[72, 126], [100, 120], [128, 126]].map(([x, y]) => (
            <path key={x} d={`M${x - 9} ${y + 2} Q${x - 8} ${y - 9} ${x + 2} ${y - 8} Q${x + 11} ${y - 6} ${x + 9} ${y + 3} Q${x + 4} ${y} ${x - 1} ${y + 4} Z`} fill="#f58a5b" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          ))}
        </>
      );
    case "tomato":
      return (
        <>
          <circle cx="56" cy="176" r="9" fill="#e84a3c" stroke={INK} strokeWidth="2.5" />
          <circle cx="56" cy="176" r="3.5" fill="#ffd0c6" />
        </>
      );
    case "chaom":
      return <path d="M136 182 q10 -10 22 -6 q-6 10 -22 6 Zm6 -3 l12 -3" fill="#6f9a35" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />;
    case "chili":
      return <path d="M112 142 q10 -6 20 2 q-8 2 -14 8 q-4 -2 -6 -10 Z" fill="#d7261e" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />;
    case "chicken":
      return (
        <>
          {[[80, 142], [90, 150], [70, 156]].map(([x, y]) => (
            <rect key={x} x={x - 4} y={y - 4} width="8" height="8" rx="2.5" fill="#e9d2a8" stroke={INK} strokeWidth="2" />
          ))}
        </>
      );
    case "herbs":
      return (
        <>
          {[[62, 130], [150, 132], [98, 138], [120, 190], [80, 192]].map(([x, y]) => (
            <path key={x} d={`M${x} ${y} q4 -6 8 0 q-4 6 -8 0Z`} fill="#58a33b" />
          ))}
        </>
      );
    default: {
      // ท็อปปิ้งที่ร้านเพิ่มเอง: จุดสีเล็ก ๆ
      const spots = [[66, 186], [136, 186], [100, 132], [60, 160], [146, 166]];
      const [x, y] = spots[i % spots.length];
      return <circle cx={x} cy={y} r="5" fill="#9db54a" stroke={INK} strokeWidth="2" />;
    }
  }
}

// toppings = ท็อปปิ้งที่วางบนไข่, choices = ตัวเลือกแบบกลุ่ม (takeaway = ใส่กล่อง, egg2/egg3 = จำนวนไข่)
function OmeletteRice({ toppings, choices }: { toppings: string[]; choices: string[] }) {
  const box = choices.includes("takeaway");
  const eggs = choices.includes("egg3") ? 3 : choices.includes("egg2") ? 2 : 1;
  const s = 1 + (eggs - 1) * 0.06; // ไข่เยอะ ไข่เจียวฟูขึ้น
  return (
    <>
      {box ? (
        // กล่องกระดาษใส่กลับบ้าน: ฝาหลัง
        <path d="M28 150 L172 150 L186 110 L14 110 Z" fill="#c9a06a" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      ) : (
        <>
          <ellipse cx="100" cy="214" rx="90" ry="23" fill="#fff" stroke={INK} strokeWidth="4" />
          <ellipse cx="100" cy="212" rx="70" ry="14" fill="none" stroke="#e6e2d6" strokeWidth="3" />
        </>
      )}
      <g transform={`translate(100 200) scale(${s}) translate(-100 -200)`}>
        <OmeletteBody toppings={toppings} />
      </g>
      {box && (
        <>
          <path d="M12 184 L188 184 L178 238 L22 238 Z" fill="#d9b27c" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <path d="M60 204 h80" stroke="#b8905a" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {eggs > 1 && (
        <g className="pop" key={eggs}>
          <ellipse cx="172" cy="74" rx="17" ry="20" fill="#fffaf0" stroke={INK} strokeWidth="3" />
          <text x="172" y="80" textAnchor="middle" fontSize="17" fontWeight="800" fill={INK}>
            ×{eggs}
          </text>
        </g>
      )}
    </>
  );
}

function OmeletteBody({ toppings }: { toppings: string[] }) {
  return (
    <>
      {/* กองข้าวสวยขอบหยัก โผล่รอบไข่เจียว */}
      <path
        d="M28 210 C24 198 30 188 40 186 C36 174 46 164 58 166 C62 154 76 150 86 154 C92 146 108 146 114 154 C124 150 138 154 142 166 C154 164 164 174 160 186 C170 188 176 198 172 210 Z"
        fill="#fffdf6"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {[[40, 200], [54, 205], [150, 202], [162, 198], [64, 196], [138, 206]].map(([x, y]) => (
        <ellipse key={`r${x}`} cx={x} cy={y} rx="4" ry="2.2" fill="#e9e4d4" transform={`rotate(${x % 3 ? 20 : -20} ${x} ${y})`} />
      ))}
      <path
        d="M46 186 C38 162 52 138 70 132 C78 116 96 110 110 116 C128 110 150 124 152 142 C166 152 166 176 156 188 C142 200 60 200 46 186 Z"
        fill="#f6c445"
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {[[58, 168, 7], [148, 150, 6], [126, 190, 5], [76, 190, 6], [108, 124, 5]].map(([x, y, r]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={r} ry={r * 0.7} fill="#e0a126" opacity=".7" />
      ))}
      {toppings.map((t, i) => (
        <g key={t} className="pop">
          <ToppingArt id={t} i={i} />
        </g>
      ))}
      <Face y={160} />
    </>
  );
}

export default function Food({
  look,
  toppings = [],
  choices = [],
  size = 160,
}: {
  look: string;
  toppings?: string[];
  choices?: string[];
  size?: number;
}) {
  return (
    <div className="cup-wrap">
      <svg className="cup still" viewBox="0 0 200 250" width={size} height={size * 1.25} aria-hidden="true">
        {look === "fries" ? <Fries /> : <OmeletteRice toppings={toppings} choices={choices} />}
      </svg>
    </div>
  );
}
