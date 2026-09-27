-- บัตรสมาชิก + แลกของขวัญด้วยแต้ม: รันครั้งเดียวใน Supabase > SQL Editor (หลัง migration-009)

-- ของขวัญที่ให้แลก (ร้านจัดการเองในหน้าบาริสต้า > ตั้งค่าร้าน > สมาชิก & ของขวัญ)
create table if not exists rewards (
  id bigint generated always as identity primary key,
  name text not null,
  description text not null default '',
  points int not null check (points > 0),
  menu_item_id text references menu_items (id) on delete set null, -- ใช้รูปการ์ตูนของเมนูนี้ (ว่าง = รูปกล่องของขวัญ)
  stock int check (stock is null or stock >= 0), -- ว่าง = ไม่จำกัด
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table rewards enable row level security;

-- คูปองที่ลูกค้าแลกแล้ว: waiting = รอรับที่ร้าน, given = ร้านให้แล้ว, cancelled = ยกเลิก (คืนแต้ม)
create table if not exists reward_redemptions (
  id bigint generated always as identity primary key,
  code text not null unique,
  line_user_id text not null,
  customer_name text not null default '',
  reward_id bigint references rewards (id) on delete set null,
  reward_name text not null,
  points int not null,
  status text not null default 'waiting' check (status in ('waiting', 'given', 'cancelled')),
  created_at timestamptz not null default now(),
  given_at timestamptz
);
create index if not exists reward_redemptions_user on reward_redemptions (line_user_id);
alter table reward_redemptions enable row level security;

-- แต้มที่ใช้แลกของขวัญบันทึกใน points_ledger ด้วย kind = 'reward' (ยกเลิกคูปอง = ลบแถวนี้ แต้มคืนเอง)
alter table points_ledger add column if not exists redemption_id bigint references reward_redemptions (id) on delete cascade;
alter table points_ledger drop constraint if exists points_ledger_kind_check;
alter table points_ledger add constraint points_ledger_kind_check check (kind in ('earn', 'redeem', 'adjust', 'reward'));

-- แลกของขวัญแบบปลอดภัย: ล็อกต่อคน กันกดซ้ำจนแต้มติดลบ และกันของหมดสต็อก
create or replace function redeem_reward(p_user text, p_name text, p_reward bigint)
returns reward_redemptions
language plpgsql
set search_path = public
as $$
declare
  r rewards;
  red reward_redemptions;
  c text;
begin
  perform pg_advisory_xact_lock(hashtext('points:' || p_user));
  select * into r from rewards where id = p_reward for update;
  if not found or not r.active then
    raise exception 'reward_unavailable';
  end if;
  if r.stock is not null and r.stock <= 0 then
    raise exception 'out_of_stock';
  end if;
  if points_balance(p_user) < r.points then
    raise exception 'not_enough_points';
  end if;
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from reward_redemptions where code = c);
  end loop;
  insert into reward_redemptions (code, line_user_id, customer_name, reward_id, reward_name, points)
  values (c, p_user, p_name, r.id, r.name, r.points)
  returning * into red;
  insert into points_ledger (line_user_id, delta, kind, note, redemption_id)
  values (p_user, -r.points, 'reward', r.name, red.id);
  if r.stock is not null then
    update rewards set stock = stock - 1 where id = r.id;
  end if;
  return red;
end;
$$;

revoke all on function redeem_reward(text, text, bigint) from public, anon, authenticated;
grant execute on function redeem_reward(text, text, bigint) to service_role;

-- ของขวัญตัวอย่าง (แก้/ลบได้ในหน้าบาริสต้า)
insert into rewards (name, description, points, menu_item_id, sort)
select * from (values
  ('มัทฉะลาเต้ฟรี 1 แก้ว', 'แก้วปกติ เลือกเย็นหรือร้อนได้', 100, 'matcha-latte', 1),
  ('ข้าวไข่เจียวฟรี 1 จาน', 'ไข่ 1 ฟอง ไม่รวมท็อปปิ้ง', 25, 'omelette-rice', 2),
  ('ท็อปซอฟต์ครีมฟรี', 'เพิ่มบนเครื่องดื่มเย็นแก้วไหนก็ได้', 12, null, 3)
) v(name, description, points, menu_item_id, sort)
where not exists (select 1 from rewards)
  and (v.menu_item_id is null or exists (select 1 from menu_items m where m.id = v.menu_item_id));
