import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

const EVENTS = new Set(["visit", "view_item", "add_cart", "order"]);
const PAGES = new Set(["order", "member"]);

// บันทึกการใช้งานหน้าเว็บลูกค้า (นับคนต่อวัน) — เก็บรหัสผู้ใช้แบบเข้ารหัสทางเดียว ไม่เก็บ LINE ID ตรง ๆ
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { event?: unknown; page?: unknown; id?: unknown };
  if (typeof b.event !== "string" || !EVENTS.has(b.event)) return new NextResponse(null, { status: 204 });
  if (typeof b.id !== "string" || b.id.length < 6 || b.id.length > 80) return new NextResponse(null, { status: 204 });
  const page = typeof b.page === "string" && PAGES.has(b.page) ? b.page : "";
  const visitor = createHash("sha256")
    .update(`${process.env.ADMIN_SESSION_SECRET ?? ""}:${b.id}`)
    .digest("hex")
    .slice(0, 24);
  const { error } = await db().rpc("track_event", { p_day: nowInShop().date, p_visitor: visitor, p_event: b.event, p_page: page });
  if (error) console.error("track_event failed", error.message);
  return new NextResponse(null, { status: 204 });
}
