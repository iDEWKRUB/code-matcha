import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { orderBtReceipt, receiptOrder } from "@/lib/orderReceipt";
import { getWifi } from "@/lib/receipt";

// ใบเสร็จของออเดอร์ LINE สำหรับพิมพ์ Bluetooth จากการ์ดออเดอร์ในหลังร้าน
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const order = await receiptOrder(Number((await params).id));
  if (!order) return NextResponse.json({ error: "ออเดอร์นี้ยังไม่มีใบเสร็จ (ยังไม่ชำระ หรือสั่งหน้าร้าน)" }, { status: 404 });
  return NextResponse.json({ receipt: orderBtReceipt(order, await getWifi()) });
}
