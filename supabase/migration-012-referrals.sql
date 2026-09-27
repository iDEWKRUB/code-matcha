-- ชวนเพื่อนรับแต้ม: รันครั้งเดียวใน Supabase > SQL Editor (หลัง migration-011)
-- เพื่อนเปิดลิงก์ชวน (หรือกรอกโค้ด) ก่อนสั่งครั้งแรก → ร้านยืนยันการจ่ายออเดอร์แรกของเพื่อน → ได้แต้มทั้งคนชวนและเพื่อน

-- โค้ดชวนของสมาชิกแต่ละคน (สร้างเมื่อเปิดบัตรสมาชิกครั้งแรก)
create table if not exists referral_codes (
  line_user_id text primary key,
  code text not null unique,
  name text not null default '',
  created_at timestamptz not null default now()
);
alter table referral_codes enable row level security;

-- ใครชวนใคร: เพื่อน 1 คนถูกชวนได้ครั้งเดียว
create table if not exists referrals (
  id bigint generated always as identity primary key,
  referrer text not null,
  referee text not null unique,
  referee_name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'rewarded')),
  order_id bigint references orders (id) on delete set null,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  check (referrer <> referee)
);
create index if not exists referrals_referrer on referrals (referrer);
alter table referrals enable row level security;

alter table points_ledger add column if not exists referral_id bigint references referrals (id) on delete cascade;
alter table points_ledger drop constraint if exists points_ledger_kind_check;
alter table points_ledger add constraint points_ledger_kind_check check (kind in ('earn', 'redeem', 'adjust', 'reward', 'referral'));

-- ให้แต้มชวนเพื่อน (เรียกตอนร้านยืนยันการจ่าย) ทำครั้งเดียวต่อเพื่อน 1 คน แม้กดซ้ำ
-- คืนค่า referrer ที่ได้แต้ม (null = ไม่มีคำชวนที่รออยู่)
create or replace function reward_referral(p_referee text, p_order bigint, p_referrer_points int, p_friend_points int)
returns text
language plpgsql
set search_path = public
as $$
declare
  ref referrals;
begin
  update referrals set status = 'rewarded', order_id = p_order, rewarded_at = now()
  where referee = p_referee and status = 'pending'
  returning * into ref;
  if not found then
    return null;
  end if;
  if p_referrer_points > 0 then
    insert into points_ledger (line_user_id, delta, kind, note, referral_id)
    values (ref.referrer, p_referrer_points, 'referral', 'ชวนเพื่อน ' || ref.referee_name, ref.id);
  end if;
  if p_friend_points > 0 then
    insert into points_ledger (line_user_id, delta, kind, note, referral_id)
    values (ref.referee, p_friend_points, 'referral', 'โบนัสเพื่อนชวน', ref.id);
  end if;
  return ref.referrer;
end;
$$;

revoke all on function reward_referral(text, bigint, int, int) from public, anon, authenticated;
grant execute on function reward_referral(text, bigint, int, int) to service_role;
