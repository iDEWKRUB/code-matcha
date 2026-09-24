import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import Board from "./Board";
import Login from "./Login";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "CODE-MACHA บาริสต้า", robots: { index: false } };

export default async function AdminPage() {
  return (await isAdmin()) ? <Board /> : <Login />;
}
