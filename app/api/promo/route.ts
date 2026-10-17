import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/line";
import { promoLabel } from "@/lib/promo";
import { checkPromo, customerPromos } from "@/lib/promoServer";

// โค้ดที่ลูกค้าคนนี้ใช้ได้ (ร้านเลือกให้แสดงในหน้าชำระ) · ไม่ส่งบันทึกช่วยจำของร้านออกไป
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return NextResponse.json({ promos: [] });
  const list = await customerPromos(user.userId);
  return NextResponse.json({
    promos: list.map((r) => ({ code: r.code, kind: r.kind, value: r.value, maxDiscount: r.maxDiscount, minSpend: r.minSpend, newCustomersOnly: r.newCustomersOnly, expiresOn: r.expiresOn, timeFrom: r.timeFrom, timeTo: r.timeTo, nowOk: r.nowOk, label: promoLabel(r) })),
  });
}

// ลูกค้ากด "ใช้โค้ด" ในตะกร้า → ตรวจสิทธิ์ แล้วส่งกติกากลับไปคำนวณส่วนลดในหน้าเว็บ
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = token ? await verifyIdToken(token) : null;
  if (!user) return NextResponse.json({ error: "เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  const { code, subtotal } = (await req.json().catch(() => ({}))) as { code?: unknown; subtotal?: unknown };
  const r = await checkPromo(String(code ?? ""), user.userId, Number(subtotal) || 0);
  if ("error" in r) return NextResponse.json({ error: r.error, hours: r.hours === true }, { status: 400 });
  const { code: c, kind, value, maxDiscount, minSpend, newCustomersOnly } = r.rule;
  return NextResponse.json({ code: c, kind, value, maxDiscount, minSpend, newCustomersOnly });
}
