// กระป๋องผงมัทฉะการ์ตูน (ใช้แทนรูปจริงเมื่อยังไม่ได้อัปโหลด) tone 0 = ผงพื้นฐาน … 3 = เกรดสูงสุด
const INK = "#1c2419";
const TONES = [
  { body: "#b8d27a", lid: "#7fa33f", label: "#fdfbf2", text: "#4b6b2f" },
  { body: "#7fae3a", lid: "#4b6b2f", label: "#fdfbf2", text: "#3f5e1c" },
  { body: "#4b6b2f", lid: "#2c4418", label: "#f3ecd2", text: "#2c4418" },
  { body: "#1f2a18", lid: "#0f140c", label: "#d8b46a", text: "#1f2a18" },
];

export default function MatchaTin({ tone = 0, size = 28 }: { tone?: number; size?: number }) {
  const t = TONES[Math.max(0, tone) % TONES.length];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="14" y="8" width="36" height="10" rx="3" fill={t.lid} stroke={INK} strokeWidth="3" />
      <rect x="12" y="17" width="40" height="40" rx="6" fill={t.body} stroke={INK} strokeWidth="3" />
      <rect x="17" y="25" width="30" height="22" rx="3" fill={t.label} stroke={INK} strokeWidth="2" />
      <text x="32" y="41" textAnchor="middle" fontSize="12" fontWeight="800" fill={t.text} fontFamily="serif">
        抹茶
      </text>
    </svg>
  );
}
