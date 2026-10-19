import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const PALETTE = ["#7A4E0D", "#6B2E86", "#2C4A8C", "#A12C15", "#2F6B2A"];

// ตั้งกติกา: จำนวนเรื่องต่อวัน · เปิด/ปิดช่องทาง · เพิ่มช่องทางใหม่
export async function PUT(req: Request) {
  if (!(await isAdmin())) return bad("unauthorized", 401);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (b.perDay !== undefined) {
      const n = Number(b.perDay);
      if (!Number.isInteger(n) || n < 1 || n > 10) return bad("จำนวนเรื่องต่อวันต้องอยู่ระหว่าง 1–10");
      const { error } = await db().from("marketing_settings").upsert({ id: 1, per_day: n });
      if (error) throw error;
    }
    if (b.channel && typeof b.channel === "object") {
      const c = b.channel as { id?: unknown; enabled?: unknown };
      if (typeof c.id !== "string" || typeof c.enabled !== "boolean") return bad("ข้อมูลไม่ถูกต้อง");
      if (!c.enabled) {
        const { data } = await db().from("marketing_channels").select("id").eq("enabled", true);
        if ((data ?? []).filter((x) => x.id !== c.id).length === 0) return bad("ต้องเปิดไว้อย่างน้อย 1 ช่องทาง");
      }
      const { error } = await db().from("marketing_channels").update({ enabled: c.enabled }).eq("id", c.id);
      if (error) throw error;
    }
    if (b.addChannel !== undefined) {
      const name = typeof b.addChannel === "string" ? b.addChannel.trim() : "";
      if (!name || name.length > 30) return bad("ใส่ชื่อช่องทาง (ไม่เกิน 30 ตัวอักษร)");
      const { data: all } = await db().from("marketing_channels").select("id,sort");
      const sort = Math.max(0, ...(all ?? []).map((x) => x.sort as number)) + 1;
      const { error } = await db().from("marketing_channels").insert({ id: `c${Date.now().toString(36)}`, name, short: name.slice(0, 2).toUpperCase(), color: PALETTE[sort % PALETTE.length], enabled: true, sort });
      if (error) throw error;
    }
  } catch {
    return bad("ยังไม่ได้รัน migration-042-marketing.sql", 503);
  }
  return NextResponse.json({ ok: true });
}
