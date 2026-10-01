// โลโก้ร้านหมึกดำล้วน สำหรับเครื่องพิมพ์ความร้อน (Sbarco) · สัดส่วนเท่าสติ๊กเกอร์ 32×25 มม.
// solid = ตราดำทึบ ตัวอักษรขาว · line = ตราเส้น (ประหยัดหมึก/ริบบอน ขอบคมกว่าบนเครื่องความละเอียดต่ำ)
// vertical = แบบแนวตั้ง (25×32) วางหมุนลงในดวง 32×25 ให้ติดสติ๊กเกอร์ตั้งขึ้นได้
export default function LogoMark({ variant = "solid", vertical = false }: { variant?: "solid" | "line"; vertical?: boolean }) {
  const solid = variant === "solid";
  const mincho = { fontFamily: "var(--font-mincho), 'Shippori Mincho', serif", fontWeight: 800 };
  const sans = { fontFamily: "var(--font-sans), sans-serif", fontWeight: 600 };
  // ตราประทับ (สี่เหลี่ยม + 暗号) วางที่มุมซ้ายบน (x, y) ขนาด s
  const seal = (x: number, y: number, s: number) => {
    const k = s / 136;
    return (
      <>
        <rect x={x} y={y} width={s} height={s} rx={14 * k} fill={solid ? "#000" : "#fff"} stroke="#000" strokeWidth={solid ? 0 : 7 * k} />
        <rect x={x + 10 * k} y={y + 10 * k} width={s - 20 * k} height={s - 20 * k} rx={8 * k} fill="none" stroke={solid ? "#fff" : "#000"} strokeWidth={2.5 * k} />
        <text x={x + s / 2} y={y + 64 * k} textAnchor="middle" fontSize={54 * k} fill={solid ? "#fff" : "#000"} style={mincho}>
          暗
        </text>
        <text x={x + s / 2} y={y + 118 * k} textAnchor="middle" fontSize={54 * k} fill={solid ? "#fff" : "#000"} style={mincho}>
          号
        </text>
      </>
    );
  };
  if (vertical)
    return (
      <svg className="logo-mark" viewBox="0 0 250 320" role="img" aria-label="CODE-MATCHA">
        {seal(37, 14, 176)}
        <text x="125" y="236" textAnchor="middle" fontSize="24" letterSpacing="1.5" fill="#000" style={mincho}>
          CODE-MATCHA
        </text>
        <line x1="70" y1="254" x2="180" y2="254" stroke="#000" strokeWidth="2" />
        <text x="125" y="280" textAnchor="middle" fontSize="16" letterSpacing="1.5" fill="#000" style={sans}>
          Matcha &amp; Working Space
        </text>
        <text x="125" y="306" textAnchor="middle" fontSize="15" letterSpacing="3" fill="#000" style={mincho}>
          抹茶
        </text>
      </svg>
    );
  return (
    <svg className="logo-mark" viewBox="0 0 320 250" role="img" aria-label="CODE-MATCHA">
      {seal(92, 12, 136)}
      <text x="160" y="196" textAnchor="middle" fontSize="33" letterSpacing="4" fill="#000" style={mincho}>
        CODE-MATCHA
      </text>
      <text x="160" y="232" textAnchor="middle" fontSize="17" letterSpacing="2" fill="#000" style={sans}>
        Matcha &amp; Working Space
      </text>
    </svg>
  );
}
