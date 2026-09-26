import { NextResponse } from "next/server";
import { POINTS } from "@/lib/config";
import type { Card } from "@/lib/flex";
import { orderLink, replyCard, replyText, validSignature } from "@/lib/line";
import { basePrice } from "@/lib/menu";
import { getMenu, getSettings, openNow, pointsBalance, rowWhen } from "@/lib/orders";
import { db } from "@/lib/supabase";
import { nowInShop } from "@/lib/time";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; groupId?: string; userId?: string };
  message?: { type: string; text?: string };
};

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "รอชำระเงิน",
  payment_review: "รอร้านตรวจสลิป",
  pending: "เข้าคิวแล้ว",
  preparing: "กำลังทำ",
  ready: "พร้อมรับแล้ว",
};

const welcome = (link: string, first: boolean): Card => ({
  tone: "matcha",
  title: first ? "ยินดีต้อนรับสู่ CODE-MACHA" : "สั่งมัทฉะได้ที่นี่เลย",
  subtitle: "สั่งผ่าน LINE ไม่ต้องต่อคิว",
  rows: [
    ["ทานที่ร้าน", "สั่งแล้วทำให้เลย"],
    ["รับกลับบ้าน", "รอรับที่เคาน์เตอร์"],
    ["สั่งล่วงหน้า", "เลือกเวลามารับ"],
    ["สะสมแต้ม", `ทุก ฿${POINTS.bahtPerPoint} = 1 แต้ม`],
  ],
  note: "กดปุ่มเมนูด้านล่างแชทได้ตลอด",
  button: { label: "ดูเมนู / สั่งเลย", uri: link },
});

// ปุ่มใน Rich Menu ส่งข้อความเหล่านี้มา → ตอบเป็นการ์ด (reply ไม่นับโควตา)
async function commandCard(cmd: string, userId: string, link: string): Promise<Card | null> {
  if (cmd === "ออเดอร์ของฉัน") {
    const { data } = await db()
      .from("orders")
      .select("daily_no,status,total,service,pickup_time,table_no")
      .eq("line_user_id", userId)
      .eq("pickup_date", nowInShop().date)
      .in("status", Object.keys(STATUS_LABEL))
      .order("id", { ascending: false })
      .limit(5);
    if (!data?.length)
      return { tone: "matcha", title: "วันนี้ยังไม่มีออเดอร์", subtitle: "สั่งได้เลย ร้านรอทำให้อยู่", button: { label: "สั่งเลย", uri: link } };
    return {
      tone: "matcha",
      title: "ออเดอร์ของฉันวันนี้",
      rows: data.map((o) => [`#${o.daily_no} · ฿${o.total}`, `${STATUS_LABEL[o.status]} · ${rowWhen(o)}`, o.status === "ready"] as [string, string, boolean]),
      note: "ร้านจะแจ้งทาง LINE ทุกครั้งที่สถานะเปลี่ยน",
      button: { label: "สั่งเพิ่ม", uri: link },
    };
  }
  if (cmd === "แต้มสะสม") {
    const bal = await pointsBalance(userId);
    const need = Math.max(0, POINTS.minRedeem - bal);
    return {
      tone: "matcha",
      title: `คุณมี ${bal.toLocaleString()} แต้ม`,
      subtitle: need ? `อีก ${need} แต้มก็ใช้เป็นส่วนลดได้แล้ว` : `ใช้เป็นส่วนลดได้สูงสุด ฿${bal}`,
      rows: [
        ["ได้แต้ม", `ทุก ฿${POINTS.bahtPerPoint} ที่จ่าย = 1 แต้ม`],
        ["ใช้แต้ม", `1 แต้ม = ฿1 (ขั้นต่ำ ${POINTS.minRedeem})`],
        ["หมดอายุ", "ไม่มีวันหมดอายุ"],
      ],
      button: { label: "สั่งและใช้แต้ม", uri: link },
    };
  }
  if (cmd === "โปรโมชั่น") {
    const [s, menu] = await Promise.all([getSettings(), getMenu()]);
    const deals = menu.filter((m) => m.available && (m.promoPrice !== null || m.recommended)).slice(0, 6);
    return {
      tone: "ready",
      title: "โปรโมชั่นวันนี้",
      subtitle: s.bannerActive && s.banner ? s.banner : "เมนูแนะนำจากร้าน",
      rows: deals.map((m) => [m.name, m.promoPrice !== null ? `฿${m.price} → ฿${basePrice(m)}` : `แนะนำ · ฿${m.price}`, m.promoPrice !== null] as [string, string, boolean]),
      note: deals.length ? undefined : "ตอนนี้ยังไม่มีโปร ติดตามได้เร็ว ๆ นี้",
      button: { label: "สั่งเลย", uri: link },
    };
  }
  if (cmd === "เวลาเปิด-ปิด") {
    const s = await getSettings();
    const open = openNow(s);
    return {
      tone: open ? "matcha" : "danger",
      title: open ? "ตอนนี้ร้านเปิดอยู่" : s.accepting ? "ตอนนี้ร้านปิดแล้ว" : "ร้านปิดรับออเดอร์ชั่วคราว",
      rows: [
        ["เวลาเปิด", `${s.openTime}–${s.closeTime} น.`, true],
        ["สั่งล่วงหน้า", `เลือกรอบรับทุก ${s.slotMinutes} นาที`],
        ["ทานที่ร้าน / กลับบ้าน", "สั่งได้ตอนร้านเปิด"],
      ],
      button: { label: "ดูเมนู", uri: link },
    };
  }
  if (cmd === "ติดต่อร้าน")
    return {
      tone: "matcha",
      title: "ติดต่อร้าน CODE-MACHA",
      subtitle: "พิมพ์ข้อความทิ้งไว้ในแชทนี้ได้เลย",
      rows: [["เวลาตอบ", "ในเวลาเปิดร้าน"]],
      note: "สอบถามเมนู แจ้งแพ้อาหาร หรือเรื่องออเดอร์ พนักงานจะตอบกลับโดยเร็ว",
    };
  return null;
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-line-signature")))
    return NextResponse.json({ error: "bad signature" }, { status: 401 });

  const { events = [] } = JSON.parse(raw) as { events?: LineEvent[] };
  const link = orderLink();

  for (const e of events) {
    if (!e.replyToken) continue;
    const src = e.source;
    const text = e.message?.text?.trim() ?? "";

    // เชิญบอทเข้ากลุ่มพนักงาน หรือพิมพ์ "groupid" ในกลุ่ม เพื่อดู Group ID
    if (src?.type === "group" && (e.type === "join" || text.toLowerCase() === "groupid")) {
      await replyText(e.replyToken, `Group ID ของกลุ่มนี้:\n${src.groupId}\n\nนำไปใส่ LINE_STAFF_GROUP_ID แล้ว deploy ใหม่`);
      continue;
    }
    if (src?.type !== "user" || !src.userId || !link) continue;

    if (e.type === "follow") {
      await replyCard(e.replyToken, welcome(link, true));
      continue;
    }
    if (e.type === "message") {
      const card = await commandCard(text, src.userId, link);
      if (card) await replyCard(e.replyToken, card);
      else if (/^(เมนู|สั่ง|menu|order)/i.test(text)) await replyCard(e.replyToken, welcome(link, false));
      // ข้อความอื่น ๆ ปล่อยให้พนักงานตอบเอง (บอทไม่แทรก)
    }
  }
  return NextResponse.json({ ok: true });
}
