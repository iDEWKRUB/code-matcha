import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import type { BarScan } from "@/lib/bar";
import { purgeOldTrays, trayUrls } from "@/lib/barServer";
import type { OrderItem } from "@/lib/menu";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// บิลมาม่าบาร์ของวันที่เลือก พร้อมรูปถาด ผลสแกน และสลิป (ไว้ตรวจย้อนหลัง/เทียบสต๊อก)
export async function GET(req: Request) {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const q = new URL(req.url).searchParams.get("date");
  const date = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : nowInShop().date;
  await purgeOldTrays();
  const { data, error } = await db()
    .from("orders")
    .select("id,daily_no,created_at,customer_name,items,total,status,slip_path,tray_path,bar_scan,terms_at,bar_extra,bar_extra_note")
    .eq("source", "bar")
    .eq("pickup_date", date)
    .neq("status", "awaiting_payment")
    .order("id", { ascending: false });
  if (error) throw error;
  const urls = await trayUrls(data.map((o) => o.tray_path));
  return NextResponse.json({
    date,
    bills: data.map((o) => ({
      id: o.id,
      no: o.daily_no,
      at: o.created_at,
      name: o.customer_name,
      items: o.items as OrderItem[],
      total: o.total,
      status: o.status,
      hasSlip: !!o.slip_path,
      photo: o.tray_path ? (urls.get(o.tray_path) ?? null) : null,
      scan: (o.bar_scan as BarScan | null) ?? null,
      termsAt: o.terms_at,
      extra: o.bar_extra,
      extraNote: o.bar_extra_note,
    })),
  });
}

// บันทึกเรียกเก็บเพิ่ม (ร้านตรวจพบของในถาดไม่ตรงกับบิล)
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return fail("unauthorized", 401);
  const b = (await req.json().catch(() => null)) as { id?: unknown; extra?: unknown; note?: unknown } | null;
  const id = Number(b?.id);
  const extra = Number(b?.extra);
  if (!Number.isInteger(id)) return fail("ไม่พบบิล");
  if (!Number.isInteger(extra) || extra < 0 || extra > 100000) return fail("จำนวนเงินไม่ถูกต้อง");
  const note = typeof b?.note === "string" ? b.note.trim().slice(0, 200) : "";
  const { data, error } = await db().from("orders").update({ bar_extra: extra, bar_extra_note: note }).eq("id", id).eq("source", "bar").select("id");
  if (error) throw error;
  if (!data.length) return fail("ไม่พบบิล", 404);
  return NextResponse.json({ ok: true });
}
