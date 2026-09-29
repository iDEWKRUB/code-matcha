// หน้าโหลดมาม่าบาร์: ถ้วยมาม่ากำลังใส่ท็อปปิ้ง+เครื่องปรุง แล้วเทน้ำร้อนตาม (CSS ล้วน ขยับได้ทันที)

const INK = "#1c2419";
const STEPS = ["ฉีกซองเครื่องปรุงลงถ้วย…", "ใส่ท็อปปิ้งที่สแกนมา…", "เติมน้ำร้อนถึงขีด…", "เกือบพร้อมแล้ว…"];

export default function BarLoader({ label }: { label?: string }) {
  return (
    <main className="loader bl" role="status" aria-live="polite">
      <svg className="ld-art" viewBox="0 0 220 220" width="200" height="200" aria-hidden="true">
        {/* ไอร้อน */}
        <g className="ld-steam" fill="none" stroke="#e3b47a" strokeWidth="5" strokeLinecap="round">
          <path d="M66 66 q-8 -12 0 -24 q8 -12 0 -24" />
          <path d="M150 70 q-8 -12 0 -24 q8 -12 0 -24" />
        </g>

        {/* ถ้วยมาม่า */}
        <ellipse cx="110" cy="204" rx="70" ry="9" fill="#1c2419" opacity=".12" />
        <path d="M34 112 H186 Q183 196 110 200 Q37 196 34 112Z" fill="#fdfaf3" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
        <path d="M34 148 H186" stroke="#e0482f" strokeWidth="7" />
        <path d="M52 160 Q56 178 84 190" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".5" />
        <ellipse cx="110" cy="112" rx="76" ry="17" fill="#e9a23b" stroke={INK} strokeWidth="5" />

        {/* ของที่หล่นลงถ้วย: ซองเครื่องปรุง + ท็อปปิ้ง (ตกจากบนแล้วลับหายไปที่ขอบถ้วย) */}
        <g clipPath="url(#bl-drop-area)">
          <g className="bl-drop bl-drop1" transform="translate(85 -20) rotate(-12)">
            <rect x="-13" y="-9" width="26" height="18" rx="3" fill="#e0482f" stroke={INK} strokeWidth="3" />
            <rect x="-9" y="-4" width="18" height="4" fill="#fff" opacity=".8" />
          </g>
          <circle className="bl-drop bl-drop2" r="7" fill="#f6a623" stroke={INK} strokeWidth="2.5" transform="translate(120 -20)" />
          <rect className="bl-drop bl-drop3" x="-9" y="-6" width="18" height="12" rx="6" fill="#f08a5d" stroke={INK} strokeWidth="2.5" transform="translate(135 -20)" />
        </g>
        <defs>
          <clipPath id="bl-drop-area">
            <rect x="0" y="0" width="220" height="112" />
          </clipPath>
        </defs>

        {/* น้ำร้อนค่อย ๆ เต็ม + เส้นมาม่าลอยผิวน้ำ (วาดทับของที่ตกไว้ ให้ดูเหมือนจมลงถ้วยไปแล้ว) */}
        <clipPath id="bl-cup-fill">
          <ellipse cx="110" cy="112" rx="70" ry="13" />
        </clipPath>
        <g className="bl-broth" clipPath="url(#bl-cup-fill)">
          <rect x="34" y="100" width="152" height="30" fill="#f6c766" />
          <path d="M84 112c-4 6 4 9 0 15s4 9 0 14M100 112c-4 6 4 9 0 15s4 8 0 13M118 112c-4 6 4 9 0 15s4 9 0 14M136 112c-4 6 4 9 0 15s4 8 0 13" fill="none" stroke="#fff2cf" strokeWidth="3" strokeLinecap="round" />
        </g>
        <ellipse cx="110" cy="112" rx="76" ry="17" fill="none" stroke={INK} strokeWidth="5" />

        {/* หน้า */}
        <g className="ld-eyes">
          <ellipse cx="92" cy="150" rx="4.5" ry="6" fill={INK} />
          <ellipse cx="128" cy="150" rx="4.5" ry="6" fill={INK} />
        </g>
        <path d="M103 163 Q110 170 117 163" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="78" cy="162" r="7" fill="#f29c9c" opacity=".55" />
        <circle cx="142" cy="162" r="7" fill="#f29c9c" opacity=".55" />

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
