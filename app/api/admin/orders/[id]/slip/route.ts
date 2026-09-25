import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

// รูปสลิปเก็บแบบส่วนตัว: สร้างลิงก์ชั่วคราวให้เฉพาะบาริสต้าที่ล็อกอิน
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await db().from("orders").select("slip_path").eq("id", Number((await params).id)).maybeSingle();
  if (error) throw error;
  if (!data?.slip_path) return NextResponse.json({ error: "ไม่มีสลิป" }, { status: 404 });
  const signed = await db().storage.from("slips").createSignedUrl(data.slip_path, 600);
  if (signed.error) throw signed.error;
  return NextResponse.redirect(signed.data.signedUrl);
}
