import { randomInt } from "node:crypto";
import { POINTS, REFERRAL } from "./config";
import { bubble, memberUri, orderUri } from "./flex";
import { pointsBalance } from "./orders";
import { pushCard } from "./line";
import { db } from "./supabase";

const PAID = ["pending", "preparing", "ready", "completed"];
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ไม่มี 0/O 1/I ที่อ่านสับสน

export const normalizeRef = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
export const inviteUrl = (code: string) => `${orderUri()}?ref=${code}`;

// โค้ดชวนของฉัน (สร้างครั้งแรกที่เปิดบัตรสมาชิก และอัปเดตชื่อให้เป็นชื่อ LINE ล่าสุด)
export async function ensureCode(userId: string, name: string) {
  const { data, error } = await db().from("referral_codes").select("code,name").eq("line_user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) {
    if (name && data.name !== name) await db().from("referral_codes").update({ name }).eq("line_user_id", userId);
    return data.code as string;
  }
  for (let i = 0; i < 5; i++) {
    const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const { error: e } = await db().from("referral_codes").insert({ line_user_id: userId, code, name });
    if (!e) return code;
    if (e.code !== "23505") throw e; // ซ้ำ → สุ่มใหม่
    const again = await db().from("referral_codes").select("code").eq("line_user_id", userId).maybeSingle();
    if (again.data) return again.data.code as string; // เปิดสองแท็บพร้อมกัน
  }
  throw new Error("สร้างโค้ดชวนไม่สำเร็จ");
}

async function hasPaidOrder(userId: string) {
  const { count, error } = await db().from("orders").select("id", { count: "exact", head: true }).eq("line_user_id", userId).in("status", PAID);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function referralInfo(userId: string, name: string) {
  const [code, mine, invited, paid] = await Promise.all([
    ensureCode(userId, name),
    db().from("referrals").select("referrer,status").eq("referee", userId).maybeSingle(),
    db().from("referrals").select("referee_name,status,created_at").eq("referrer", userId).order("created_at", { ascending: false }),
    hasPaidOrder(userId),
  ]);
  if (mine.error) throw mine.error;
  if (invited.error) throw invited.error;
  let referredBy: { name: string; status: string } | null = null;
  if (mine.data) {
    const { data } = await db().from("referral_codes").select("name").eq("line_user_id", mine.data.referrer).maybeSingle();
    referredBy = { name: data?.name || "เพื่อน", status: mine.data.status };
  }
  const friends = invited.data.map((r) => ({ name: r.referee_name || "เพื่อน", rewarded: r.status === "rewarded" }));
  return {
    code,
    url: inviteUrl(code),
    referrerPoints: REFERRAL.referrerPoints,
    friendPoints: REFERRAL.friendPoints,
    friends,
    earned: friends.filter((f) => f.rewarded).length * REFERRAL.referrerPoints,
    referredBy,
    canEnterCode: !mine.data && !paid,
    shareMessage: shareMessage(name, code),
  };
}

// เพื่อนใช้โค้ดชวน: ต้องยังไม่เคยสั่ง (จ่ายแล้ว) และยังไม่เคยถูกชวน
export async function claimReferral(userId: string, name: string, rawCode: string) {
  const code = normalizeRef(rawCode);
  if (code.length < 4) return { error: "โค้ดชวนไม่ถูกต้อง" };
  const { data: owner, error } = await db().from("referral_codes").select("line_user_id,name").eq("code", code).maybeSingle();
  if (error) throw error;
  if (!owner) return { error: "ไม่พบโค้ดชวนนี้" };
  if (owner.line_user_id === userId) return { error: "ใช้โค้ดของตัวเองไม่ได้" };
  if (await hasPaidOrder(userId)) return { error: "โค้ดชวนใช้ได้เฉพาะลูกค้าที่ยังไม่เคยสั่ง" };
  const { error: e } = await db().from("referrals").insert({ referrer: owner.line_user_id, referee: userId, referee_name: name.slice(0, 60) });
  if (e?.code === "23505") return { error: "คุณใช้โค้ดชวนไปแล้ว" };
  if (e) throw e;
  return { referrerName: (owner.name as string) || "เพื่อน" };
}

// ร้านยืนยันการจ่าย → ถ้าเป็นออเดอร์แรกของเพื่อนที่ถูกชวน ให้แต้มทั้งคู่ และแจ้งคนชวนทาง LINE
export async function rewardReferral(o: { id: number; line_user_id: string; customer_name: string }) {
  const { data: referrer, error } = await db().rpc("reward_referral", {
    p_referee: o.line_user_id,
    p_order: o.id,
    p_referrer_points: REFERRAL.referrerPoints,
    p_friend_points: REFERRAL.friendPoints,
  });
  if (error) {
    console.error("rewardReferral failed", error);
    return 0;
  }
  if (!referrer) return 0;
  if (REFERRAL.referrerPoints > 0) {
    const balance = await pointsBalance(referrer as string);
    await pushCard(
      referrer as string,
      {
        tone: "ready",
        title: "เพื่อนที่คุณชวนสั่งแล้ว!",
        subtitle: `ขอบคุณที่ชวน ${o.customer_name} มาลอง CODE-MATCHA`,
        rows: [
          ["ได้รับ", `+${REFERRAL.referrerPoints} แต้ม`, true],
          ["แต้มคงเหลือ", `${balance.toLocaleString()} แต้ม`],
        ],
        note: "ชวนได้ไม่จำกัด ยิ่งชวนยิ่งได้แต้ม",
        button: { label: "เปิดบัตรสมาชิก", uri: memberUri() },
      },
      { name: "(ชวนเพื่อน)" },
    );
  }
  return REFERRAL.friendPoints;
}

// การ์ดชวนเพื่อนที่ลูกค้าส่งต่อใน LINE (liff.shareTargetPicker)
function shareMessage(name: string, code: string) {
  const who = name || "เพื่อนของคุณ";
  return {
    type: "flex",
    altText: `${who} ชวนคุณมาลอง CODE-MATCHA`,
    contents: bubble({
      tone: "matcha",
      title: `${who} ชวนคุณมาลอง CODE-MATCHA`,
      subtitle: `สั่งครั้งแรกผ่านการ์ดนี้ รับ ${REFERRAL.friendPoints} แต้ม`,
      rows: [
        ["โค้ดชวน", code, true],
        ["แต้มสะสม", `ทุก ฿${POINTS.bahtPerPoint} = 1 แต้ม`],
      ],
      button: { label: "สั่งมัทฉะเลย", uri: inviteUrl(code) },
    }),
  };
}
