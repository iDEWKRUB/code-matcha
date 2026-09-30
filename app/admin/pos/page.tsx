import type { Metadata, Viewport } from "next";
import { isAdmin } from "@/lib/auth";
import Login from "../Login";
import Pos from "./Pos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "หน้าร้าน (POS) · CODE-MATCHA", robots: { index: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function PosPage() {
  return (await isAdmin()) ? <Pos /> : <Login />;
}
