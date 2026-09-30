import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { hasPowder } from "@/lib/menu";
import { getMenu, getPowders } from "@/lib/orders";
import { orderQrSvg } from "@/lib/qr";
import Login from "../Login";
import MenuBoard from "./MenuBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เมนูหน้าร้าน · พิมพ์", robots: { index: false } };

// เมนูตั้งหน้าร้าน: ราคาแต่ละเมนูตามผงมัทฉะ (ไม่แสดงต้นทุน/กำไร) เรียงลำดับเองแล้วพิมพ์ A4
export default async function MenuBoardPage() {
  if (!(await isAdmin())) return <Login />;
  const [menu, powders, qr] = await Promise.all([getMenu(), getPowders(), orderQrSvg()]);
  const rows = menu.filter((m) => hasPowder(m) && !m.hidden);
  return <MenuBoard menu={rows} powders={powders} qr={qr} />;
}
