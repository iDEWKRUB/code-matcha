// การ์ตูนสอนจ่ายเงิน 3 ฉาก วนเองทุก 3 วินาที (CSS ล้วน): บันทึก QR → สแกนจ่ายในแอปธนาคาร → แนบสลิป

const INK = "#1C2118";
const QR = ({ x, y, s }: { x: number; y: number; s: number }) => {
  const m = s / 7;
  const finder = (fx: number, fy: number) => (
    <g>
      <rect x={fx} y={fy} width={m * 2.2} height={m * 2.2} rx={m * 0.3} fill={INK} />
      <rect x={fx + m * 0.45} y={fy + m * 0.45} width={m * 1.3} height={m * 1.3} rx={m * 0.2} fill="#fff" />
      <rect x={fx + m * 0.75} y={fy + m * 0.75} width={m * 0.7} height={m * 0.7} fill={INK} />
    </g>
  );
  const dots = [
    [3, 0.4], [4.2, 0.4], [3.6, 1.5], [0.4, 3.2], [1.6, 3.6], [3, 3], [4.4, 3.4], [5.6, 3], [3.4, 4.4], [4.8, 4.8], [5.8, 5.8], [3, 5.8], [4.2, 5.6], [5.6, 4.2],
  ];
  return (
    <g>
      <rect x={x - 2} y={y - 2} width={s + 4} height={s + 4} rx={4} fill="#fff" />
      {finder(x, y)}
      {finder(x + s - m * 2.2, y)}
      {finder(x, y + s - m * 2.2)}
      {dots.map(([dx, dy], i) => (
        <rect key={i} x={x + dx * m} y={y + dy * m} width={m * 0.8} height={m * 0.8} rx={m * 0.15} fill={INK} />
      ))}
    </g>
  );
};

const Phone = ({ children, head }: { children: React.ReactNode; head?: string }) => (
  <g>
    <rect x="80" y="12" width="80" height="138" rx="14" fill={INK} />
    <rect x="86" y="22" width="68" height="118" rx="8" fill="#fff" />
    <rect x="110" y="16" width="20" height="3" rx="1.5" fill="#3a4236" />
    {head && <rect x="86" y="22" width="68" height="18" rx="8" fill={head} />}
    {head && <rect x="86" y="32" width="68" height="8" fill={head} />}
    {children}
  </g>
);

const Check = ({ cx, cy, r, className }: { cx: number; cy: number; r: number; className?: string }) => (
  <g className={className}>
    <circle cx={cx} cy={cy} r={r} fill="#4b8a3a" />
    <path d={`M${cx - r * 0.45} ${cy + r * 0.02}l${r * 0.32} ${r * 0.32} ${r * 0.62}-${r * 0.62}`} fill="none" stroke="#fff" strokeWidth={r * 0.26} strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

export default function PayHowTo({ auto }: { auto: boolean }) {
  const steps = [
    { t: "บันทึกรูป QR", d: "กดปุ่มบันทึก หรือกดค้างที่ QR" },
    { t: "สแกนจ่ายในแอปธนาคาร", d: "เลือกรูป QR จากอัลบั้ม ยอดขึ้นให้เอง" },
    { t: "แนบสลิปที่นี่", d: auto ? "ระบบตรวจให้ใน 2–3 วินาที" : "ร้านตรวจยอดให้สักครู่" },
  ];
  return (
    <section className="ph" aria-label="วิธีชำระเงิน 3 ขั้น">
      <div className="ph-stage" aria-hidden="true">
        <svg viewBox="0 0 240 160" width="100%" height="100%">
          <ellipse cx="120" cy="152" rx="62" ry="6" fill="#1c2118" opacity=".08" />

          {/* ฉาก 1: กดค้างที่ QR → บันทึกแล้ว */}
          <g className="ph-scene ph-s1">
            <Phone>
              <QR x={98} y={52} s={44} />
            </Phone>
            <circle className="ph-ripple" cx="126" cy="80" r="10" fill="none" stroke="#8FA86A" strokeWidth="3" />
            <circle className="ph-ripple r2" cx="126" cy="80" r="10" fill="none" stroke="#8FA86A" strokeWidth="3" />
            <g className="ph-finger">
              <path d="M126 80c-3 0-5 2-5 5v26c0 8 6 14 14 14h6c8 0 13-6 13-13V96c0-3-2-5-5-5s-5 2-5 5v-2c0-3-2-5-5-5s-5 2-5 5v-4c0-3-2-5-5-5-1 0-2 0-3 1V85c0-3-2-5-5-5z" fill="#FCE5D2" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
            </g>
            <g className="ph-pop">
              <rect x="150" y="30" width="70" height="24" rx="12" fill="#2F4A2A" />
              <text x="185" y="46" textAnchor="middle" fontSize="11" fontWeight="700" fill="#F3EFE4" fontFamily="var(--sans)">บันทึกแล้ว ✓</text>
            </g>
          </g>

          {/* ฉาก 2: แอปธนาคารสแกน QR → ยอดขึ้น → จ่ายสำเร็จ */}
          <g className="ph-scene ph-s2">
            <Phone head="#1D3C6E">
              <text x="120" y="35" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff" fontFamily="var(--sans)">สแกนจ่าย</text>
              <QR x={100} y={52} s={40} />
              <path d="M96 50v-6h6M144 50v-6h-6M96 94v6h6M144 94v6h-6" fill="none" stroke="#1D3C6E" strokeWidth="3" strokeLinecap="round" />
              <rect className="ph-scan" x="96" y="48" width="48" height="3" rx="1.5" fill="#E0482F" />
              <g className="ph-amount">
                <rect x="92" y="110" width="56" height="22" rx="6" fill="#EEF2FA" />
                <text x="120" y="125" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1D3C6E" fontFamily="var(--sans)">โอน ✓</text>
              </g>
            </Phone>
            <g className="ph-coin">
              <circle cx="40" cy="70" r="16" fill="#F3C44C" stroke={INK} strokeWidth="2.5" />
              <text x="40" y="76" textAnchor="middle" fontSize="16" fontWeight="800" fill={INK} fontFamily="var(--sans)">฿</text>
            </g>
          </g>

          {/* ฉาก 3: สลิปลอยเข้ามือถือ → ตรวจผ่าน */}
          <g className="ph-scene ph-s3">
            <Phone>
              <text x="120" y="40" textAnchor="middle" fontSize="8" fontWeight="700" fill="#2F4A2A" fontFamily="var(--sans)">CODE-MATCHA</text>
              <Check cx={120} cy={84} r={20} className="ph-ok" />
              <text className="ph-ok" x="120" y="124" textAnchor="middle" fontSize="9" fontWeight="700" fill="#2F4A2A" fontFamily="var(--sans)">ตรวจสลิปแล้ว</text>
            </Phone>
            <g className="ph-slip">
              <rect x="18" y="44" width="48" height="66" rx="5" fill="#fff" stroke={INK} strokeWidth="2.5" />
              <rect x="26" y="54" width="32" height="4" rx="2" fill="#8FA86A" />
              <rect x="26" y="64" width="24" height="3" rx="1.5" fill="#CFC6AF" />
              <rect x="26" y="72" width="28" height="3" rx="1.5" fill="#CFC6AF" />
              <rect x="26" y="88" width="20" height="10" rx="2" fill={INK} opacity=".85" />
              <path d="M18 110l6 5 6-5 6 5 6-5 6 5 6-5 6 5 6-5" fill="#fff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
            </g>
            <g className="ph-spark" fill="#F3C44C">
              <path d="M178 40l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" />
              <path d="M190 100l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" />
            </g>
          </g>
        </svg>
      </div>
      <ol className="ph-steps">
        {steps.map((s, i) => (
          <li key={i}>
            <span className="ph-n">{i + 1}</span>
            <span>
              <b>{s.t}</b>
              <small>{s.d}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
