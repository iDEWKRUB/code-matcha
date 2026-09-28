import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import Login from "../Login";
import BarAdmin from "./BarAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "มาม่าบาร์ · หลังร้าน", robots: { index: false } };

export default async function BarAdminPage() {
  return (await isAdmin()) ? <BarAdmin /> : <Login />;
}
