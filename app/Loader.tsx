// หน้าโหลด: น้องถ้วยชากำลังถูกตีมัทฉะด้วยฉะเซ็น (แอนิเมชันด้วย CSS ล้วน ขยับได้ทันทีแม้ JS ยังโหลดไม่เสร็จ)

const INK = "#1c2419";
const STEPS = ["ร่อนผงมัทฉะลงถ้วย…", "เทน้ำอุ่น 80°C…", "ตีเป็นรูปตัว M ให้ฟองฟู…", "เกือบพร้อมแล้ว…"];

export default function Loader({ label }: { label?: string }) {
  return (
    <main className="loader" role="status" aria-live="polite">
      <svg className="ld-art" viewBox="0 0 220 220" width="200" height="200" aria-hidden="true">
        {/* ไอร้อน */}
        <g className="ld-steam" fill="none" stroke="#b9c7a0" strokeWidth="5" strokeLinecap="round">
          <path d="M62 70 q-8 -12 0 -24 q8 -12 0 -24" />
          <path d="M150 74 q-8 -12 0 -24 q8 -12 0 -24" />
        </g>
        {/* ถ้วยชา */}
        <ellipse cx="110" cy="204" rx="70" ry="9" fill="#1c2419" opacity=".12" />
        <path d="M34 112 H186 Q183 196 110 200 Q37 196 34 112Z" fill="#3d3a36" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
        <path d="M52 124 Q56 172 92 186" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".18" />
        <ellipse cx="110" cy="112" rx="76" ry="17" fill="#7fae3a" stroke={INK} strokeWidth="5" />
        {/* ฟองนม มัทฉะ */}
        <g className="ld-foam" fill="#c9df8c">
          <circle cx="78" cy="110" r="5" />
          <circle cx="96" cy="116" r="3.5" />
          <circle cx="132" cy="108" r="4.5" />
          <circle cx="150" cy="115" r="3" />
          <circle cx="116" cy="118" r="3" />
        </g>
        {/* หน้า */}
        <g className="ld-eyes">
          <ellipse cx="92" cy="150" rx="4.5" ry="6" fill="#fff" />
          <ellipse cx="128" cy="150" rx="4.5" ry="6" fill="#fff" />
        </g>
        <path d="M103 163 Q110 170 117 163" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="78" cy="162" r="7" fill="#f29c9c" opacity=".55" />
        <circle cx="142" cy="162" r="7" fill="#f29c9c" opacity=".55" />
        {/* ฉะเซ็น (แปรงไม้ไผ่) ตีไปมา */}
        <defs>
          <clipPath id="ld-cut">
            <rect x="0" y="0" width="220" height="112" />
            <ellipse cx="110" cy="112" rx="74" ry="15" />
          </clipPath>
        </defs>
        <g clipPath="url(#ld-cut)">
          <g className="ld-whisk">
            <rect x="102" y="20" width="16" height="62" rx="6" fill="#d8b77a" stroke={INK} strokeWidth="4.5" />
            <path
              d="M96 82 Q110 74 124 82 L128 128 Q110 136 92 128 Z"
              fill="#ead3a0"
              stroke={INK}
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            {[99, 105, 110, 115, 121].map((x) => (
              <path key={x} d={`M${x} 86 L${x + (x - 110) * 0.35} 126`} stroke="#b89556" strokeWidth="2" />
            ))}
          </g>
        </g>
        {/* ประกายวิ้ง */}
        <g className="ld-spark" fill="#f3c44c">
          <path d="M28 64 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
          <path d="M188 52 l2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4 -5.6 -5.6 -2.4 5.6 -2.4z" />
        </g>
      </svg>
      {label ? (
        <p className="ld-cap">
          <span className="ld-one">{label}</span>
        </p>
      ) : (
        <p className="ld-cap">
          {STEPS.map((s, i) => (
            <span key={s} style={{ animationDelay: `${i * 1.6}s` }}>
              {s}
            </span>
          ))}
        </p>
      )}
      <span className="ld-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </main>
  );
}
