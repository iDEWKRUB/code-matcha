// การ์ตูนสาวน้อยกินมาม่าอย่างมีความสุข (หน้าชำระเสร็จ มาม่าบาร์)
export default function Slurp({ size = 260 }: { size?: number }) {
  return (
    <svg className="slurp" width={size} height={size * (250 / 260)} viewBox="0 0 260 250" role="img" aria-label="สาวน้อยกำลังกินมาม่าอย่างมีความสุข">
      <circle cx="130" cy="128" r="108" fill="#E9E2CF" />
      <g className="sl-spark" fill="#B8412C">
        <path d="M40 70l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
        <path d="M222 150l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
      </g>
      <g className="sl-spark b" fill="#8FA86A">
        <path d="M214 58l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
        <path d="M34 168l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      </g>
      <path className="sl-heart" d="M200 96c0-5 6-8 9-3 3-5 9-2 9 3 0 6-9 11-9 11s-9-5-9-11z" fill="#E8826F" />

      {/* ตัว + เสื้อ */}
      <path d="M72 238c2-40 26-66 58-66s56 26 58 66z" fill="#2F4A2A" />
      <path d="M112 174l18 18 18-18" fill="#F3EFE4" />
      <path d="M130 192v46" stroke="#3D5C37" strokeWidth="3" />

      {/* หัวทั้งหมดขยับลงมาชิดถ้วย ไม่ให้คอดูลอย */}
      <g transform="translate(0 14)">
      {/* ผม (ด้านหลัง) + ดังโงะ */}
      <circle cx="130" cy="30" r="17" fill="#2B211C" />
      <rect x="116" y="42" width="28" height="7" rx="3.5" fill="#B8412C" />
      <path d="M80 96c-6-44 18-66 50-66s56 22 50 66l-4 42c-8 6-18 8-24 6l-22-40-22 40c-6 2-16 0-24-6z" fill="#2B211C" />

      {/* คอ + หน้า */}
      <rect x="120" y="128" width="20" height="20" rx="6" fill="#F2D2BC" />
      <ellipse cx="130" cy="98" rx="44" ry="42" fill="#FCE5D2" />
      <path d="M86 90c6-26 24-40 44-40s38 14 44 40c-14-4-24-14-28-24-8 12-26 22-60 24z" fill="#2B211C" />
      <path d="M111 99q7-8 14 0M135 99q7-8 14 0" fill="none" stroke="#2B211C" strokeWidth="3.4" strokeLinecap="round" />
      <ellipse cx="107" cy="111" rx="8" ry="5" fill="#F4A3A0" opacity=".75" />
      <ellipse cx="153" cy="111" rx="8" ry="5" fill="#F4A3A0" opacity=".75" />
      <path d="M122 113q8 12 16 0z" fill="#C2554A" />
      </g>

      {/* แขนขวา + ตะเกียบ + เส้นที่คีบขึ้นมา */}
      <path d="M176 196c10-18 14-40 8-64" stroke="#2F4A2A" strokeWidth="20" strokeLinecap="round" fill="none" />
      <path d="M204 70l-58 56M210 76l-60 54" stroke="#B5763E" strokeWidth="4" strokeLinecap="round" />
      <circle cx="183" cy="124" r="11" fill="#FCE5D2" />
      <path className="sl-noodle" d="M149 128c-4 8 4 12 0 20s4 12 0 20M155 130c-4 8 4 12 0 20s4 12 0 18M143 127c-4 8 4 12 0 20s4 10 0 18" fill="none" stroke="#F3C766" strokeWidth="3.4" strokeLinecap="round" />

      {/* ไอน้ำ */}
      <g className="sl-steam" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity=".9">
        <path d="M96 146c-6-8 6-12 0-20" />
        <path d="M112 142c-6-8 6-12 0-20" />
      </g>

      {/* ถ้วยมาม่า */}
      <ellipse cx="130" cy="170" rx="66" ry="15" fill="#E9A23B" />
      <path d="M86 168c6-6 12 6 18 0s12 6 18 0 12 6 18 0 12 6 18 0 12 6 12 0" fill="none" stroke="#FFE7A8" strokeWidth="3" strokeLinecap="round" />
      <path d="M100 164q6-6 12 0" stroke="#F08A5D" strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="164" cy="166" r="7" fill="#FFFFFF" />
      <circle cx="164" cy="166" r="3.5" fill="#F6A623" />
      <path d="M64 170c2 34 28 52 66 52s64-18 66-52c-10 10-36 16-66 16s-56-6-66-16z" fill="#FFFFFF" stroke="#E4DDCB" strokeWidth="2" />
      <path d="M72 194c14 10 34 14 58 14s44-4 58-14" stroke="#B8412C" strokeWidth="13" fill="none" />
      <text x="130" y="212" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF" fontFamily="var(--sans)">มาม่า</text>

      {/* มือซ้ายจับถ้วย */}
      <path d="M84 238c-8-16-14-34-10-52" stroke="#2F4A2A" strokeWidth="20" strokeLinecap="round" fill="none" />
      <circle cx="72" cy="182" r="11" fill="#FCE5D2" />
    </svg>
  );
}
