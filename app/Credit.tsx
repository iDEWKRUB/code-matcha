// เครดิตผู้ออกแบบ: ใช้ทั้งหน้าลูกค้าและหลังร้าน
export default function Credit({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <p className={`credit ${tone}${className ? ` ${className}` : ""}`}>
      <span>© 2026 uxuidesign by </span>
      <a href="https://cv-titsanan.vercel.app" target="_blank" rel="noopener noreferrer">
        Titsanan
      </a>
    </p>
  );
}
