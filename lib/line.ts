import "server-only";
import crypto from "crypto";
import { env } from "./env";

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

async function callLine(path: string, body: unknown) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log(`[LINE ${path} skipped: no token]`, JSON.stringify(body));
    return;
  }
  const res = await fetch(`https://api.line.me/v2/bot/message/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) console.error(`LINE ${path} failed`, res.status, await res.text());
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
