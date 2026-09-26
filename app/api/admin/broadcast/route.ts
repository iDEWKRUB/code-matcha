import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { altText, bubble, orderUri, type Card } from "@/lib/flex";
import { broadcastCard } from "@/lib/line";
import { promoLabel } from "@/lib/promo";
import { listPromos } from "@/lib/promoServer";

const H = () => ({ Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`, "Content-Type": "application/json" });
const thaiDate = (d: string) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

type Body = { title?: unknown; subtitle?: unknown; detail?: unknown; code?: unknown; image?: unknown; send?: unknown };

async function buildCard(b: Body): Promise<Card | { error: string }> {
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 60) : "";
  if (!title) return { error: "กรุณาใส่หัวข้อโปร" };
  const rows: [string, string, boolean?][] = [];
  if (typeof b.code === "string" && b.code) {
    const rule = (await listPromos()).find((p) => p.code === b.code);
    if (!rule || !rule.active) return { error: "โค้ดนี้ไม่มีหรือถูกปิดอยู่" };
    rows.push(["โค้ดส่วนลด", rule.code, true], ["ส่วนลด", promoLabel(rule)]);
    if (rule.expiresOn) rows.push(["ใช้ได้ถึง", thaiDate(rule.expiresOn)]);
  }
  const image = typeof b.image === "string" && /^https:\/\/\S+$/.test(b.image) ? b.image : undefined;
  return {
    tone: "ready",
    hero: image,
    title,
    subtitle: typeof b.subtitle === "string" ? b.subtitle.trim().slice(0, 80) || undefined : undefined,
    rows,
    note: typeof b.detail === "string" ? b.detail.trim().slice(0, 160) || undefined : undefined,
    button: { label: "สั่งเลย", uri: orderUri() },
  };
}

// โควตาข้อความคงเหลือเดือนนี้
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [q, c] = await Promise.all([
    fetch("https://api.line.me/v2/bot/message/quota", { headers: H() }).then((r) => r.json()),
    fetch("https://api.line.me/v2/bot/message/quota/consumption", { headers: H() }).then((r) => r.json()),
  ]);
  return NextResponse.json({ limit: q.type === "limited" ? q.value : null, used: c.totalUsage ?? 0 });
}

// send=false: ให้ LINE ตรวจการ์ดอย่างเดียว / send=true: บรอดแคสต์ถึงเพื่อนทุกคน
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  const card = await buildCard(b);
  if ("error" in card) return NextResponse.json(card, { status: 400 });
  if (b.send === true) {
    const r = await broadcastCard(card);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    return NextResponse.json({ ok: true, sent: true });
  }
  const messages = [{ type: "flex", altText: altText(card), contents: bubble(card) }];
  const r = await fetch("https://api.line.me/v2/bot/message/validate/broadcast", { method: "POST", headers: H(), body: JSON.stringify({ messages }) });
  if (!r.ok) return NextResponse.json({ error: `LINE ตอบกลับ: ${await r.text()}` }, { status: 502 });
  return NextResponse.json({ ok: true, sent: false });
}
