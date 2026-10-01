import { NextResponse } from "next/server";
import { cleanBlessings } from "@/lib/blessings";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// หน้า /gift ดึงคำอวยพรที่ร้านตั้งไว้ (ไม่มี = ใช้ชุดตั้งต้นในหน้าเว็บ)
export async function GET() {
  const { data } = await db().from("shop_settings").select("blessings").eq("id", 1).maybeSingle();
  const list = data?.blessings ? cleanBlessings(data.blessings) : null;
  return NextResponse.json({ messages: Array.isArray(list) ? list : null }, { headers: { "Cache-Control": "public, max-age=60" } });
}
