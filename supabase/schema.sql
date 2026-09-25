-- รันไฟล์นี้ครั้งเดียวใน Supabase > SQL Editor

create table if not exists menu_items (
  id text primary key,
  name text not null,
  jp text not null default '',
  description text not null default '',
  price int not null check (price >= 0),
  temps text[] not null default '{iced,hot}',
  milk boolean not null default false,
  available boolean not null default true,
  sort int not null default 0
);

create table if not exists orders (
  id bigint generated always as identity primary key,
  daily_no int not null,
  pickup_date date not null,
  pickup_time text not null,
  line_user_id text not null,
  customer_name text not null,
  items jsonb not null,
  total int not null,
  cups int not null,
  note text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pickup_date, daily_no)
);

create index if not exists orders_date_status on orders (pickup_date, status);

-- เปิด RLS โดยไม่มี policy: เข้าถึงได้เฉพาะเซิร์ฟเวอร์ที่ใช้ service_role key
alter table menu_items enable row level security;
alter table orders enable row level security;

-- สร้างออเดอร์แบบ atomic: ล็อกต่อวัน ตรวจที่ว่างของช่องเวลา แล้วออกเลขคิวประจำวัน
create or replace function place_order(
  p_date date,
  p_time text,
  p_capacity int,
  p_user text,
  p_name text,
  p_items jsonb,
  p_total int,
  p_cups int,
  p_note text
) returns table (order_id bigint, order_no int)
language plpgsql
set search_path = public
as $$
declare
  used int;
  n int;
  new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('orders:' || p_date::text));

  select coalesce(sum(o.cups), 0) into used
  from orders o
  where o.pickup_date = p_date and o.pickup_time = p_time and o.status <> 'cancelled';

  if used + p_cups > p_capacity then
    raise exception 'SLOT_FULL';
  end if;

  select coalesce(max(o.daily_no), 0) + 1 into n from orders o where o.pickup_date = p_date;

  insert into orders (daily_no, pickup_date, pickup_time, line_user_id, customer_name, items, total, cups, note)
  values (n, p_date, p_time, p_user, p_name, p_items, p_total, p_cups, p_note)
  returning id into new_id;

  return query select new_id, n;
end;
$$;

revoke all on function place_order(date, text, int, text, text, jsonb, int, int, text) from public, anon, authenticated;
grant execute on function place_order(date, text, int, text, text, jsonb, int, int, text) to service_role;

-- เมนูเริ่มต้น (แก้ราคา/เพิ่มเมนูได้ใน Table Editor)
insert into menu_items (id, name, jp, description, price, temps, milk, available, sort) values
  ('usucha', 'มัทฉะเพียว', '薄茶', 'มัทฉะตีสดกับน้ำอุ่น ไม่ใส่นม', 110, '{iced,hot}', false, true, 1),
  ('matcha-latte', 'มัทฉะลาเต้', '抹茶ラテ', 'มัทฉะเกรดพรีเมียมกับนมที่เลือกได้', 120, '{iced,hot}', true, true, 2),
  ('ceremonial-latte', 'เซเรโมเนียลลาเต้', '濃茶ラテ', 'มัทฉะเกรดพิธีชงชา รสเข้ม อูมามิชัด', 150, '{iced,hot}', true, true, 3),
  ('hojicha-latte', 'โฮจิฉะลาเต้', 'ほうじ茶ラテ', 'ชาเขียวคั่ว หอมกลิ่นไฟ คาเฟอีนต่ำ', 110, '{iced,hot}', true, true, 4),
  ('yuzu-sparkling', 'มัทฉะยูซุโซดา', '柚子抹茶ソーダ', 'มัทฉะชั้นบนโซดายูซุ สดชื่น', 130, '{iced}', false, true, 5),
  ('cold-whisk-latte', 'Cold Whisk Latte', '冷やし点て抹茶ラテ', 'มัทฉะตีเย็นจนเป็นฟองนุ่ม ลอยบนนมเย็น', 130, '{iced}', true, true, 6),
  ('coconut-matcha', 'มัทฉะน้ำมะพร้าว', 'ココナッツ抹茶', 'น้ำมะพร้าวหอมหวานธรรมชาติ ตัดกับมัทฉะเข้ม สดชื่น', 130, '{iced}', false, true, 7),
  ('strawberry-matcha', 'สตรอว์เบอร์รี่มัทฉะ', '苺抹茶ラテ', 'ซอสสตรอว์เบอร์รี่ นมสด และมัทฉะ สามชั้น', 140, '{iced}', true, true, 8)
on conflict (id) do nothing;
