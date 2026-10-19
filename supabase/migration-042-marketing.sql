-- หน้าการตลาด (หลังร้าน): ตารางคอนเทนต์รายวัน สถานะการลงแต่ละช่องทาง คลังไอเดีย กติกา
create table if not exists marketing_channels (
  id text primary key,
  name text not null,
  short text not null default '',
  color text not null default '#2F4A2A',
  enabled boolean not null default true,
  sort int not null default 0
);
insert into marketing_channels (id, name, short, color, enabled, sort) values
  ('fb', 'Facebook', 'FB', '#1877F2', true, 1),
  ('ig', 'Instagram', 'IG', '#C13584', true, 2),
  ('x', 'X', 'X', '#14171A', true, 3),
  ('tiktok', 'TikTok', 'TT', '#0B8F8F', true, 4),
  ('line', 'LINE VOOM', 'LN', '#06A94A', true, 5),
  ('yt', 'YouTube Shorts', 'YT', '#D4271B', false, 6)
on conflict (id) do nothing;

create table if not exists marketing_posts (
  id bigint generated always as identity primary key,
  post_date date not null,
  slot int not null check (slot between 1 and 10),
  title text not null default '',
  pillar text not null default 'menu' check (pillar in ('menu', 'promo', 'behind', 'know', 'cust')),
  format text not null default '',
  caption text not null default '',
  status jsonb not null default '{}'::jsonb,   -- {"fb":"done","ig":"sched"}  todo | sched | done
  done_at jsonb not null default '{}'::jsonb,  -- {"fb":"12:40"}
  updated_at timestamptz not null default now(),
  unique (post_date, slot)
);

create table if not exists marketing_ideas (
  id bigint generated always as identity primary key,
  title text not null,
  pillar text not null default 'menu' check (pillar in ('menu', 'promo', 'behind', 'know', 'cust')),
  format text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists marketing_settings (
  id int primary key default 1 check (id = 1),
  per_day int not null default 2 check (per_day between 1 and 10)
);
insert into marketing_settings (id) values (1) on conflict (id) do nothing;

alter table marketing_channels enable row level security;
alter table marketing_posts enable row level security;
alter table marketing_ideas enable row level security;
alter table marketing_settings enable row level security;
