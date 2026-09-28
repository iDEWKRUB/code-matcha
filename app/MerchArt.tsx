// ภาพการ์ตูนของพรีเมียม (สเกลเดียวกับ Cup/Food: viewBox 200x250) ใช้เมื่อร้านยังไม่ได้อัปโหลดรูปจริง

const INK = "#1c2419";
const S = { stroke: INK, strokeWidth: 5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

export const MERCH_TINT: Record<string, string> = {
  tumbler: "#e3edd0",
  keychain: "#fdf0cf",
  plush: "#f7e3e3",
  chasen: "#efe6d4",
  tote: "#e6ecef",
  gift: "#eef4dc",
};

function Face({ x = 100, y, s = 1 }: { x?: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="-14" cy="0" rx="4.5" ry="6" fill={INK} />
      <ellipse cx="14" cy="0" rx="4.5" ry="6" fill={INK} />
      <circle cx="-12.5" cy="-2.5" r="1.6" fill="#fff" />
      <circle cx="15.5" cy="-2.5" r="1.6" fill="#fff" />
      <path d="M-7 12 Q0 19 7 12" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="-27" cy="12" r="7" fill="#f29c9c" opacity=".6" />
      <circle cx="27" cy="12" r="7" fill="#f29c9c" opacity=".6" />
    </g>
  );
}

function Tumbler() {
  return (
    <>
      <rect x="62" y="30" width="76" height="26" rx="9" fill="#2f4a1b" {...S} />
      <rect x="92" y="14" width="16" height="20" rx="5" fill="#2f4a1b" {...S} />
      <path d="M58 56 H142 L134 226 Q133 236 122 236 H78 Q67 236 66 226 Z" fill="#6f9a35" {...S} />
      <path d="M76 70 L80 220" stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity=".35" />
      <rect x="84" y="172" width="32" height="32" rx="4" fill="#c23b22" stroke={INK} strokeWidth="4" />
      <text x="100" y="194" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="serif">暗号</text>
      <Face y={118} />
    </>
  );
}

function Keychain() {
  return (
    <>
      <circle cx="100" cy="42" r="22" fill="none" stroke="#b9b9b0" strokeWidth="8" />
      <circle cx="100" cy="42" r="22" fill="none" stroke={INK} strokeWidth="3" />
      <path d="M100 64 V88" stroke="#9c9c93" strokeWidth="6" strokeDasharray="6 5" strokeLinecap="round" />
      <path d="M58 96 H142 L132 218 Q131 228 120 228 H80 Q69 228 68 218 Z" fill="#fff" {...S} />
      <path d="M62 134 H138 L132 218 Q131 228 120 228 H80 Q69 228 68 218 Z" fill="#8fb34a" stroke="none" />
      <path d="M58 96 H142 L132 218 Q131 228 120 228 H80 Q69 228 68 218 Z" fill="none" {...S} />
      <path d="M62 134 Q80 124 100 134 T138 134" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <rect x="112" y="72" width="10" height="40" rx="3" fill="#d9432b" stroke={INK} strokeWidth="3.5" transform="rotate(12 117 92)" />
      <Face y={172} s={0.85} />
    </>
  );
}

function Plush() {
  return (
    <>
      <path d="M100 58 C96 38 108 26 124 24 C122 42 114 54 100 58Z" fill="#9db54a" {...S} />
      <ellipse cx="46" cy="160" rx="18" ry="24" fill="#8fb34a" {...S} transform="rotate(-25 46 160)" />
      <ellipse cx="154" cy="160" rx="18" ry="24" fill="#8fb34a" {...S} transform="rotate(25 154 160)" />
      <ellipse cx="74" cy="226" rx="22" ry="14" fill="#7fa33f" {...S} />
      <ellipse cx="126" cy="226" rx="22" ry="14" fill="#7fa33f" {...S} />
      <path d="M100 56 C150 56 166 100 166 150 C166 200 138 224 100 224 C62 224 34 200 34 150 C34 100 50 56 100 56Z" fill="#a6c35a" {...S} />
      <ellipse cx="100" cy="182" rx="38" ry="30" fill="#dfeab8" />
      <Face y={130} />
    </>
  );
}

function Chasen() {
  return (
    <>
      {/* ช้อนตัก */}
      <path d="M22 206 L78 186" stroke="#c9a46a" strokeWidth="9" strokeLinecap="round" />
      <path d="M22 206 L78 186" stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity=".5" />
      {/* ถ้วยชง */}
      <path d="M30 150 H130 Q128 214 80 222 Q32 214 30 150Z" fill="#3d3a36" {...S} />
      <ellipse cx="80" cy="150" rx="50" ry="12" fill="#7fae3a" {...S} />
      <path d="M58 150 Q70 145 84 150 T104 149" fill="none" stroke="#b9d27a" strokeWidth="3" strokeLinecap="round" />
      <Face x={80} y={184} s={0.8} />
      {/* แปรงตี (ฉะเซ็น) */}
      <rect x="150" y="30" width="18" height="84" rx="6" fill="#d8b77a" {...S} />
      <path d="M140 116 Q159 104 178 116 L184 214 Q159 226 134 214 Z" fill="#ead3a0" {...S} />
      {[146, 153, 159, 165, 172].map((x) => (
        <path key={x} d={`M${x} 122 Q${x + (x - 159) * 0.25} 170 ${x + (x - 159) * 0.4} 212`} stroke="#b89556" strokeWidth="2.5" fill="none" />
      ))}
    </>
  );
}

function Tote() {
  return (
    <>
      <path d="M72 88 C72 40 128 40 128 88" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M72 88 C72 40 128 40 128 88" fill="none" stroke="#e9dfc6" strokeWidth="4" strokeLinecap="round" />
      <path d="M40 84 H160 L168 228 Q168 236 160 236 H40 Q32 236 32 228 Z" fill="#f4ecd8" {...S} />
      <path d="M78 116 H122 L117 176 Q116 182 110 182 H90 Q84 182 83 176 Z" fill="#fff" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M80 136 H120 L117 176 Q116 182 110 182 H90 Q84 182 83 176 Z" fill="#8fb34a" />
      <path d="M78 116 H122 L117 176 Q116 182 110 182 H90 Q84 182 83 176 Z" fill="none" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M112 100 L106 126" stroke="#d9432b" strokeWidth="5" strokeLinecap="round" />
      <Face y={156} s={0.55} />
      <text x="100" y="214" textAnchor="middle" fontSize="14" fontWeight="800" letterSpacing="1.5" fill={INK} fontFamily="serif">CODE-MATCHA</text>
    </>
  );
}

function Gift() {
  return (
    <>
      <path d="M100 78 C78 40 44 50 58 72 C66 84 88 80 100 78 C112 80 134 84 142 72 C156 50 122 40 100 78Z" fill="#d9432b" {...S} />
      <rect x="40" y="110" width="120" height="112" rx="12" fill="#9db54a" {...S} />
      <rect x="30" y="80" width="140" height="38" rx="10" fill="#b8cf64" {...S} />
      <rect x="88" y="80" width="24" height="142" fill="#d9432b" {...S} />
      <ellipse cx="72" cy="158" rx="4.5" ry="6" fill={INK} />
      <ellipse cx="128" cy="158" rx="4.5" ry="6" fill={INK} />
      <circle cx="73.5" cy="155.5" r="1.6" fill="#fff" />
      <circle cx="129.5" cy="155.5" r="1.6" fill="#fff" />
      <path d="M62 180 Q70 186 78 180M122 180 Q130 186 138 180" fill="none" stroke="#f29c9c" strokeWidth="6" strokeLinecap="round" opacity=".7" />
    </>
  );
}

const ART: Record<string, () => React.ReactElement> = { tumbler: Tumbler, keychain: Keychain, plush: Plush, chasen: Chasen, tote: Tote, gift: Gift };

export default function MerchArt({ look, size }: { look: string | null; size: number }) {
  const Art = ART[look ?? "gift"] ?? Gift;
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 200 250" aria-hidden="true">
      <Art />
    </svg>
  );
}
