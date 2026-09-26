-- ประวัติการส่งข้อความ LINE (รันครั้งเดียวใน SQL Editor หลัง migration-008)

create table if not exists message_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('customer', 'staff', 'broadcast')),
  to_id text not null default '',      -- LINE userId / groupId / 'all'
  to_name text not null default '',
  title text not null default '',
  order_no int,
  ok boolean not null,
  error text not null default '',
  request_id text                      -- ใช้ดึงสถิติบรอดแคสต์จาก LINE
);
create index if not exists message_log_created on message_log (created_at desc);
alter table message_log enable row level security;
