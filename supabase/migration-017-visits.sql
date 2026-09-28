-- สถิติผู้เข้าชมหน้าเว็บลูกค้า: รันครั้งเดียวใน Supabase > SQL Editor (หลัง migration-016)
-- เก็บ 1 แถวต่อ 1 คน ต่อ 1 วัน ต่อ 1 การกระทำ (นับจำนวนครั้งใน hits) — ไม่เก็บชื่อ/LINE ID ตรง ๆ (visitor = รหัสที่เข้ารหัสทางเดียวแล้ว)
--   visit     = เปิดหน้าเว็บ (page: order / member)
--   view_item = กดดูเมนู
--   add_cart  = ใส่ตะกร้า
--   order     = สั่งสำเร็จ

create table if not exists site_events (
  day date not null,
  visitor text not null,
  event text not null check (event in ('visit', 'view_item', 'add_cart', 'order')),
  page text not null default '',
  hits int not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (day, visitor, event)
);
create index if not exists site_events_day on site_events (day);
alter table site_events enable row level security;

create or replace function track_event(p_day date, p_visitor text, p_event text, p_page text)
returns void
language sql
set search_path = public
as $$
  insert into site_events (day, visitor, event, page)
  values (p_day, p_visitor, p_event, p_page)
  on conflict (day, visitor, event) do update set hits = site_events.hits + 1, last_at = now();
$$;

revoke all on function track_event(date, text, text, text) from public, anon, authenticated;
grant execute on function track_event(date, text, text, text) to service_role;
