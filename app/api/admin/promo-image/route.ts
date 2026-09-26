import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

const MAX = 1024 * 1024; // LINE รับรูปในการ์ดได้ไม่เกิน 1MB (ฝั่งหน้าเว็บย่อรูปให้ก่อนแล้ว)

// อัปโหลดรูปโปร → คืนลิงก์สาธารณะ (https) สำหรับใส่ในการ์ด LINE
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const file = (await req.formData().catch(() => null))?.get("image");
  if (!(file instanceof File) || !/^image\/(jpeg|png)$/.test(file.type)) return NextResponse.json({ error: "รองรับเฉพาะรูป JPG หรือ PNG" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "รูปใหญ่เกิน 1MB" }, { status: 400 });
  const path = `${Date.now()}.${file.type === "image/png" ? "png" : "jpg"}`;
  const up = await db().storage.from("promo").upload(path, await file.arrayBuffer(), { contentType: file.type });
  if (up.error) throw up.error;
  return NextResponse.json({ url: db().storage.from("promo").getPublicUrl(path).data.publicUrl });
}
