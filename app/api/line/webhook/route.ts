import { NextResponse } from "next/server";
import { orderLink, replyCard, replyText, validSignature } from "@/lib/line";

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

    // ลูกค้าแอดเพื่อน/ทักแชท: ตอบการ์ดต้อนรับพร้อมปุ่มสั่ง (reply ไม่นับโควตา)
    if (src?.type === "user" && (e.type === "follow" || e.type === "message") && link) {
      await replyCard(e.replyToken, {
        tone: "matcha",
        title: e.type === "follow" ? "ยินดีต้อนรับสู่ CODE-MACHA" : "สั่งมัทฉะได้ที่นี่เลย",
        subtitle: "สั่งล่วงหน้า ไม่ต้องต่อคิว",
        rows: [
          ["ทานที่ร้าน", "สั่งแล้วทำให้เลย"],
          ["รับกลับบ้าน", "รอรับที่เคาน์เตอร์"],
          ["สั่งล่วงหน้า", "เลือกเวลามารับ"],
          ["สะสมแต้ม", "ทุก ฿25 = 1 แต้ม"],
        ],
        note: "จ่ายผ่านพร้อมเพย์ แล้วร้านจะแจ้งทาง LINE เมื่อพร้อม",
        button: { label: "ดูเมนู / สั่งเลย", uri: link },
      });
    }
  }
  return NextResponse.json({ ok: true });
}
