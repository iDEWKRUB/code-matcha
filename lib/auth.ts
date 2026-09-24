import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { env } from "./env";

const COOKIE = "cm_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;

const sign = (exp: number) =>
  crypto.createHmac("sha256", env("ADMIN_SESSION_SECRET")).update(String(exp)).digest("hex");

const sha = (s: string) => crypto.createHash("sha256").update(s).digest();

export function passwordMatches(input: string) {
  return crypto.timingSafeEqual(sha(input), sha(env("ADMIN_PASSWORD")));
}

export async function isAdmin() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(Number(exp));
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}

export async function startSession() {
  const exp = Date.now() + SESSION_MS;
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}
