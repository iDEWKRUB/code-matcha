import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;

// Supabase บางครั้งตอบ PGRST303 "JWT issued at future" เพราะนาฬิกาเซิร์ฟเวอร์ฝั่งเขาเหลื่อมกันเล็กน้อย
// คำขอถูกปฏิเสธก่อนทำงาน จึงส่งซ้ำได้อย่างปลอดภัย
async function fetchWithClockRetry(input: RequestInfo | URL, init?: RequestInit) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(input, init);
    if (res.status !== 401 || attempt >= 3) return res;
    const text = await res.clone().text();
    if (!text.includes("PGRST303")) return res;
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
}

export function db() {
  client ??= createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithClockRetry },
  });
  return client;
}
