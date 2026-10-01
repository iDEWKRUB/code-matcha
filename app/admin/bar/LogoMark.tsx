// โลโก้ร้านหมึกดำล้วน สำหรับเครื่องพิมพ์ความร้อน (Sbarco) · สัดส่วนเท่าสติ๊กเกอร์ 32×25 มม.
// solid = ตราดำทึบ ตัวอักษรขาว · line = ตราเส้น (ประหยัดหมึก/ริบบอน ขอบคมกว่าบนเครื่องความละเอียดต่ำ)
export default function LogoMark({ variant = "solid", tagline = true }: { variant?: "solid" | "line"; tagline?: boolean }) {
  const solid = variant === "solid";
  const mincho = { fontFamily: "var(--font-mincho), 'Shippori Mincho', serif", fontWeight: 800 };
  return (
    <svg className="logo-mark" viewBox="0 0 320 250" role="img" aria-label="CODE-MATCHA">
      <rect x="92" y="12" width="136" height="136" rx="14" fill={solid ? "#000" : "#fff"} stroke="#000" strokeWidth={solid ? 0 : 7} />
      <rect x="102" y="22" width="116" height="116" rx="8" fill="none" stroke={solid ? "#fff" : "#000"} strokeWidth="2.5" />
      <text x="160" y="76" textAnchor="middle" fontSize="54" fill={solid ? "#fff" : "#000"} style={mincho}>
        暗
      </text>
      <text x="160" y="130" textAnchor="middle" fontSize="54" fill={solid ? "#fff" : "#000"} style={mincho}>
        号
      </text>
      <text x="160" y={tagline ? 196 : 214} textAnchor="middle" fontSize="33" letterSpacing="4" fill="#000" style={mincho}>
        CODE-MATCHA
      </text>
      {tagline && (
        <text x="160" y="232" textAnchor="middle" fontSize="17" letterSpacing="2" fill="#000" style={{ fontFamily: "var(--font-sans), sans-serif", fontWeight: 600 }}>
          Matcha &amp; Working Space
        </text>
      )}
    </svg>
  );
}
