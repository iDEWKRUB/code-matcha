import type { Metadata } from "next";
import { Noto_Serif_Thai } from "next/font/google";

const serif = Noto_Serif_Thai({ subsets: ["thai", "latin"], weight: ["700"], variable: "--font-serif-th", display: "swap" });

// ยังไม่เปิดให้ลูกค้า: ไม่มีปุ่มลิงก์มาหน้านี้ และไม่ให้เครื่องมือค้นหาเก็บ
export const metadata: Metadata = { title: "CODE-MATCHA มาม่าบาร์", robots: { index: false, follow: false } };

export default function BarLayout({ children }: { children: React.ReactNode }) {
  return <div className={serif.variable}>{children}</div>;
}
