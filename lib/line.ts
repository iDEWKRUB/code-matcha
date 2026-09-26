import "server-only";
import crypto from "crypto";
import { env } from "./env";
import { altText, bubble, type Card } from "./flex";
import { db } from "./supabase";

export type LineUser = { userId: string; name: string };

// ตรวจ ID token จาก LIFF กับเซิร์ฟเวอร์ LINE เพื่อรู้ว่าใครสั่งจริง
export async function verifyIdToken(idToken: string): Promise<LineUser | null> {
  if (process.env.NODE_ENV !== "production" && idToken === "dev") return { userId: "dev", name: "Dev" };
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: env("LINE_LOGIN_CHANNEL_ID") }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { sub?: string; name?: string };
  if (!j.sub) return null;
  return { userId: j.sub, name: j.name ?? "ลูกค้า" };
}

type SendResult = { ok: boolean; error: string; requestId: string | null };

async function callLine(path: string, body: unknown): Promise<SendResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log(`[LINE ${path} skipped: no token]`, JSON.stringify(body));
    return { ok: false, error: "ยังไม่ได้ตั้งค่า LINE token", requestId: null };
  }
  const res = await fetch(`https://api.line.me/v2/bot/message/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const requestId = res.headers.get("x-line-request-id");
  if (res.ok) return { ok: true, error: "", requestId };
  const detail = await res.text();
  console.error(`LINE ${path} failed`, res.status, detail);
  return { ok: false, error: res.status === 429 ? "โควตาข้อความเดือนนี้หมดแล้ว" : `LINE ตอบกลับ ${res.status}`, requestId };
}

// LINE ส่งหาได้เฉพาะคนที่เป็นเพื่อน (โปรไฟล์ดูได้เฉพาะเพื่อน: 404 = ยังไม่แอด/บล็อก)
async function isFriend(userId: string) {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    cache: "no-store",
  });
  return res.status !== 404;
}

type LogEntry = {
  kind: "customer" | "staff" | "broadcast";
  to_id: string;
  to_name: string;
  title: string;
  order_no?: number | null;
  ok: boolean;
  error?: string;
  request_id?: string | null;
};

export async function logMessage(e: LogEntry) {
  const { error } = await db().from("message_log").insert(e);
  if (error) console.error("message_log insert failed", error.message);
}

// การแจ้งเตือนล้มเหลวต้องไม่ทำให้ออเดอร์ล้ม จึงแค่บันทึก error
export async function pushText(to: string | undefined, text: string) {
  if (!to || to === "dev") {
    console.log("[LINE push skipped]", to, text);
    return;
  }
  try {
    await callLine("push", { to, messages: [{ type: "text", text }] });
  } catch (e) {
    console.error("LINE push error", e);
  }
}

export async function replyText(replyToken: string, text: string) {
  await callLine("reply", { replyToken, messages: [{ type: "text", text }] });
}

const flexMessage = (c: Card) => ({ type: "flex", altText: altText(c), contents: bubble(c) });

// ส่งการ์ด Flex (ล้มเหลวก็ไม่กระทบออเดอร์) และบันทึกประวัติ
export async function pushCard(to: string | undefined, c: Card, meta: { name?: string; orderNo?: number } = {}) {
  const staff = !!to && to === process.env.LINE_STAFF_GROUP_ID;
  if (!to || to === "dev") {
    console.log("[LINE card skipped]", to, altText(c));
    return;
  }
  const base = { kind: staff ? "staff" : "customer", to_id: to, to_name: staff ? "กลุ่มพนักงาน" : meta.name ?? "", title: c.title, order_no: meta.orderNo ?? null } as const;
  try {
    // ไม่ใช่เพื่อน = ส่งไม่ถึงแน่นอน ไม่ต้องยิง (ไม่เสียโควตา)
    if (!staff && to.startsWith("U") && !(await isFriend(to))) {
      await logMessage({ ...base, ok: false, error: "ลูกค้ายังไม่ได้แอดเพื่อน หรือบล็อกร้าน" });
      return;
    }
    const r = await callLine("push", { to, messages: [flexMessage(c)] });
    await logMessage({ ...base, ok: r.ok, error: r.error, request_id: r.requestId });
  } catch (e) {
    console.error("LINE push error", e);
    await logMessage({ ...base, ok: false, error: "เชื่อมต่อ LINE ไม่ได้" });
  }
}

export async function broadcastCard(c: Card) {
  const r = await callLine("broadcast", { messages: [flexMessage(c)] });
  await logMessage({ kind: "broadcast", to_id: "all", to_name: "เพื่อนทุกคน", title: c.title, ok: r.ok, error: r.error, request_id: r.requestId });
  return r;
}

export async function replyCard(replyToken: string, c: Card) {
  await callLine("reply", { replyToken, messages: [flexMessage(c)] });
}

export function validSignature(body: string, signature: string | null) {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", env("LINE_CHANNEL_SECRET")).update(body).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

export function orderLink() {
  const id = process.env.NEXT_PUBLIC_LIFF_ID;
  return id ? `https://liff.line.me/${id}` : "";
}
