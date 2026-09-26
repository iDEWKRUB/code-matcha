import "server-only";
import type { PromoRule } from "./promo";
import { normalizeCode } from "./promo";
import { db } from "./supabase";
import { nowInShop } from "./time";

const COLUMNS =
  "code,kind,value,maxDiscount:max_discount,minSpend:min_spend,newCustomersOnly:new_customers_only,perUserLimit:per_user_limit,maxUses:max_uses,expiresOn:expires_on,active,note";

// นับเฉพาะออเดอร์ที่ยังมีผล (ไม่ถูกยกเลิก และไม่ใช่รอจ่ายที่หมดเวลาแล้ว)
async function countUses(code: string, userId?: string) {
  let q = db().from("orders").select("status,expires_at").eq("promo_code", code).neq("status", "cancelled");
  if (userId) q = q.eq("line_user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  const now = Date.now();
  return data.filter((o) => !(o.status === "awaiting_payment" && o.expires_at && new Date(o.expires_at).getTime() < now)).length;
}

export async function listPromos(): Promise<PromoRule[]> {
  const { data, error } = await db().from("promo_codes").select(COLUMNS).order("created_at", { ascending: false });
  if (error) throw error;
  const rules = data as unknown as PromoRule[];
  await Promise.all(rules.map(async (r) => (r.used = await countUses(r.code))));
  return rules;
}

// ตรวจว่าลูกค้าคนนี้ใช้โค้ดได้ไหม คืน rule หรือข้อความ error
export async function checkPromo(input: string, userId: string, subtotal: number): Promise<{ rule: PromoRule } | { error: string }> {
  const code = normalizeCode(input);
  if (!code) return { error: "กรุณาใส่โค้ด" };
  const { data, error } = await db().from("promo_codes").select(COLUMNS).eq("code", code).maybeSingle();
  if (error) throw error;
  const rule = data as unknown as PromoRule | null;
  if (!rule || !rule.active) return { error: "ไม่พบโค้ดนี้ หรือโค้ดถูกปิดแล้ว" };
  if (rule.expiresOn && rule.expiresOn < nowInShop().date) return { error: "โค้ดนี้หมดอายุแล้ว" };
  if (subtotal < rule.minSpend) return { error: `โค้ดนี้ใช้ได้เมื่อซื้อครบ ฿${rule.minSpend}` };
  if (rule.maxUses !== null && (await countUses(code)) >= rule.maxUses) return { error: "สิทธิ์โค้ดนี้เต็มแล้ว" };
  if ((await countUses(code, userId)) >= rule.perUserLimit) return { error: "คุณใช้โค้ดนี้ครบสิทธิ์แล้ว" };
  if (rule.newCustomersOnly) {
    const { count, error: e2 } = await db()
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("line_user_id", userId)
      .in("status", ["pending", "preparing", "ready", "completed"]);
    if (e2) throw e2;
    if ((count ?? 0) > 0) return { error: "โค้ดนี้สำหรับลูกค้าใหม่ที่ยังไม่เคยสั่งเท่านั้น" };
  }
  return { rule };
}
