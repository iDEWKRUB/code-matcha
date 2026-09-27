import { createHash } from "node:crypto";
import type { MenuItem } from "./menu";
import { getMenu } from "./orders";
import { db } from "./supabase";

export type Reward = {
  id: number;
  name: string;
  description: string;
  points: number;
  menuItemId: string | null;
  stock: number | null;
  active: boolean;
  sort: number;
};

export type Coupon = {
  id: number;
  code: string;
  rewardName: string;
  points: number;
  status: "waiting" | "given" | "cancelled";
  createdAt: string;
  givenAt: string | null;
  customerName?: string;
};

export type HistoryRow = { at: string; delta: number; kind: string; label: string };

type RewardRow = {
  id: number;
  name: string;
  description: string;
  points: number;
  menu_item_id: string | null;
  stock: number | null;
  active: boolean;
  sort: number;
};
type RedemptionRow = {
  id: number;
  code: string;
  reward_name: string;
  points: number;
  status: Coupon["status"];
  created_at: string;
  given_at: string | null;
  customer_name: string;
};

const REWARD_COLUMNS = "id,name,description,points,menu_item_id,stock,active,sort";
const REDEMPTION_COLUMNS = "id,code,reward_name,points,status,created_at,given_at,customer_name";

const toReward = (r: RewardRow): Reward => ({
  id: r.id,
  name: r.name,
  description: r.description,
  points: r.points,
  menuItemId: r.menu_item_id,
  stock: r.stock,
  active: r.active,
  sort: r.sort,
});

export const toCoupon = (r: RedemptionRow): Coupon => ({
  id: r.id,
  code: r.code,
  rewardName: r.reward_name,
  points: r.points,
  status: r.status,
  createdAt: r.created_at,
  givenAt: r.given_at,
  customerName: r.customer_name,
});

export async function listRewards(activeOnly = false) {
  let q = db().from("rewards").select(REWARD_COLUMNS).order("points").order("sort");
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data as RewardRow[]).map(toReward);
}

export async function listRedemptions() {
  const { data, error } = await db()
    .from("reward_redemptions")
    .select(REDEMPTION_COLUMNS)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data as RedemptionRow[]).map(toCoupon);
}

// เลขสมาชิกคงที่ต่อคน (ไม่เปิดเผย LINE user id)
export function memberNo(userId: string) {
  const n = BigInt(`0x${createHash("sha256").update(`cm:${userId}`).digest("hex").slice(0, 12)}`) % 100000000n;
  const s = n.toString().padStart(8, "0");
  return `CM ${s.slice(0, 4)} ${s.slice(4)}`;
}

type LedgerRow = {
  delta: number;
  kind: string;
  note: string;
  created_at: string;
  orders: { daily_no: number; status: string; expires_at: string | null; pickup_date: string } | null;
};

// แต้มที่ใช้กับออเดอร์ที่ยกเลิก/หมดเวลาจ่าย ถือว่าคืนแล้ว (ตรงกับ points_balance ในฐานข้อมูล)
const refunded = (r: LedgerRow) =>
  r.kind === "redeem" &&
  !!r.orders &&
  (r.orders.status === "cancelled" || (r.orders.status === "awaiting_payment" && !!r.orders.expires_at && new Date(r.orders.expires_at) < new Date()));

const LABEL: Record<string, string> = { earn: "ได้แต้มจากออเดอร์", redeem: "ใช้แต้มเป็นส่วนลด", adjust: "ร้านปรับแต้ม", reward: "แลกของขวัญ" };

export async function memberSummary(userId: string) {
  const [ledger, coupons, firstOrder, rewards, menu] = await Promise.all([
    db()
      .from("points_ledger")
      .select("delta,kind,note,created_at,orders(daily_no,status,expires_at,pickup_date)")
      .eq("line_user_id", userId)
      .order("created_at", { ascending: false }),
    db().from("reward_redemptions").select(REDEMPTION_COLUMNS).eq("line_user_id", userId).neq("status", "cancelled").order("created_at", { ascending: false }).limit(20),
    db().from("orders").select("created_at").eq("line_user_id", userId).order("created_at").limit(1),
    listRewards(true),
    getMenu(),
  ]);
  if (ledger.error) throw ledger.error;
  if (coupons.error) throw coupons.error;
  if (firstOrder.error) throw firstOrder.error;

  const rows = (ledger.data as unknown as LedgerRow[]).filter((r) => !refunded(r));
  const earned = rows.filter((r) => r.kind === "earn").reduce((n, r) => n + r.delta, 0);
  const used = -rows.filter((r) => r.delta < 0).reduce((n, r) => n + r.delta, 0);
  const balance = Math.max(0, rows.reduce((n, r) => n + r.delta, 0));

  const history: HistoryRow[] = rows.slice(0, 30).map((r) => ({
    at: r.created_at,
    delta: r.delta,
    kind: r.kind,
    label: r.kind === "reward" ? `แลก ${r.note}` : r.orders ? `${LABEL[r.kind] ?? r.kind} #${r.orders.daily_no}` : (LABEL[r.kind] ?? r.kind),
  }));

  // รูปการ์ตูนของของขวัญ: ส่งเฉพาะเมนูที่ใช้
  const ids = new Set(rewards.map((r) => r.menuItemId).filter(Boolean));
  const art: Record<string, MenuItem> = Object.fromEntries(menu.filter((m) => ids.has(m.id)).map((m) => [m.id, m]));

  return {
    memberNo: memberNo(userId),
    since: firstOrder.data[0]?.created_at ?? rows[rows.length - 1]?.created_at ?? null,
    balance,
    earned,
    used,
    history,
    coupons: (coupons.data as RedemptionRow[]).map(toCoupon).map(({ customerName: _, ...c }) => c),
    rewards: rewards.filter((r) => r.stock === null || r.stock > 0),
    art,
  };
}

// ข้อมูลหน้าจัดการของขวัญ (หลังร้าน)
export async function rewardsPayload() {
  const [rewards, redemptions] = await Promise.all([listRewards(), listRedemptions()]);
  return { rewards, redemptions };
}
