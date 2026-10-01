import "server-only";
import crypto from "crypto";
import { env } from "./env";

// ข้อความบนแก้วเก็บแบบเข้ารหัส (AES-256-GCM) ร้าน/ฐานข้อมูลอ่านไม่ได้
// กุญแจของแต่ละแก้ว = HMAC(ความลับเซิร์ฟเวอร์, รหัสใน QR) → ถอดได้เฉพาะตอนมีคนสแกน QR ของแก้วนั้น
// ระวัง: เปลี่ยน ADMIN_SESSION_SECRET แล้วข้อความเก่าจะเปิดไม่ได้ (ข้อความหมดอายุใน 60 วันอยู่แล้ว)
export type CupMsg = { msg: string; to: string; from: string };

const keyFor = (token: string) => crypto.createHmac("sha256", env("ADMIN_SESSION_SECRET")).update(`cup-msg:${token}`).digest();

export function sealCup(token: string, m: CupMsg) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", keyFor(token), iv);
  const body = Buffer.concat([c.update(JSON.stringify(m), "utf8"), c.final()]);
  return "v1:" + Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

export function openCup(token: string, sealed: string): CupMsg | null {
  if (!sealed.startsWith("v1:")) return null;
  try {
    const raw = Buffer.from(sealed.slice(3), "base64url");
    const d = crypto.createDecipheriv("aes-256-gcm", keyFor(token), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const m = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8"));
    return { msg: String(m.msg ?? ""), to: String(m.to ?? ""), from: String(m.from ?? "") };
  } catch {
    return null;
  }
}
