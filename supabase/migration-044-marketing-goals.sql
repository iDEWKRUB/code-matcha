-- หน้าการตลาด: เป้าหมายรายสัปดาห์/รายเดือน + รางวัลที่ตั้งให้ตัวเอง
create table if not exists marketing_goals (
  id bigint generated always as identity primary key,
  period text not null check (period in ('week', 'month')),
  metric text not null check (metric in ('posts', 'days')), -- posts = จำนวนโพสต์ที่ลงแล้ว · days = จำนวนวันที่ลงครบตามเป้าต่อวัน
  target int not null check (target between 1 and 400),
  reward text not null default '',
  strict boolean not null default false, -- true = นับโพสต์เมื่อลงครบทุกช่องที่เปิด · false = ลงอย่างน้อย 1 ช่อง
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- บันทึกว่ารับรางวัลของรอบไหนไปแล้ว (รอบละครั้ง)
create table if not exists marketing_goal_claims (
  id bigint generated always as identity primary key,
  goal_id bigint not null references marketing_goals (id) on delete cascade,
  period_key text not null, -- W:2026-10-19 (วันจันทร์ของสัปดาห์) หรือ M:2026-10
  reward text not null default '',
  value int not null default 0,
  claimed_at timestamptz not null default now(),
  unique (goal_id, period_key)
);

-- เป้าหมายเริ่มต้น (แก้ไข/ลบได้ในหน้า ตั้งค่า)
insert into marketing_goals (period, metric, target, reward, sort)
select * from (values
  ('week', 'posts', 10, 'ของขวัญเล็กๆ ให้ตัวเอง (แก้ได้)', 1),
  ('week', 'days', 7, 'ซื้อชุดชงมัทฉะ 1 ชุด', 2),
  ('month', 'posts', 40, 'รางวัลใหญ่ประจำเดือน (แก้ได้)', 3)
) as v (period, metric, target, reward, sort)
where not exists (select 1 from marketing_goals);

alter table marketing_goals enable row level security;
alter table marketing_goal_claims enable row level security;
