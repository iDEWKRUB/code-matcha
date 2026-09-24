import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Shippori_Mincho } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});
const mincho = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--font-mincho",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = { title: "CODE-MACHA สั่งมัทฉะ" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#eef1e2" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${sans.variable} ${mincho.variable}`}>
      <body>{children}</body>
    </html>
  );
}
