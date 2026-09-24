import { NextResponse } from "next/server";
import { orderLink, replyText, validSignature } from "@/lib/line";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; groupId?: string; userId?: string };
  message?: { type: string; text?: string };
};

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-line-signature")))
    return NextResponse.json({ error: "bad signature" }, { status: 401 });

  const { events = [] } = JSON.parse(raw) as { events?: LineEvent[] };
  const link = orderLink();

  for (const e of events) {
    if (!e.replyToken) continue;
    const src = e.source;

    // เชิญบอทเข้ากลุ่มพนักงาน หรือพิมพ์ "groupid" ในกลุ่ม เพื่อดู Group ID
    if (src?.type === "group" && (e.type === "join" || e.message?.text?.trim().toLowerCase() === "groupid")) {
      await replyText(e.replyToken, `Group ID ของกลุ่มนี้:\n${src.groupId}\n\nนำไปใส่ LINE_STAFF_GROUP_ID แล้ว deploy ใหม่`);
      continue;
    }

    if (src?.type === "user" && (e.type === "follow" || e.type === "message") && link) {
      await replyText(e.replyToken, `สั่งมัทฉะล่วงหน้า แล้วมารับที่ร้านได้เลย 🍵\n${link}`);
    }
  }
  return NextResponse.json({ ok: true });
}
