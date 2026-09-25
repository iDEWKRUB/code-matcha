-- ระบบสะสมแต้ม: รันครั้งเดียวใน Supabase > SQL Editor (หลัง migration-002)

create table if not exists points_ledger (
  id bigint generated always as identity primary key,
  line_user_id text not null,
  order_id bigint references orders (id) on delete cascade,
  delta int not null,
  kind text not null check (kind in ('earn', 'redeem', 'adjust')),
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (order_id, kind)
);
create index if not exists points_ledger_user on points_ledger (line_user_id);
alter table points_ledger enable row level security;

alter table orders add column if not exists discount int not null default 0;

-- ยอดแต้มคงเหลือ: แต้มที่ใช้กับออเดอร์ที่ถูกยกเลิก หรือรอชำระจนหมดเวลา ถือว่าคืนแล้ว
create or replace function points_balance(p_user text) returns int
language sql stable
set search_path = public
as $$
  select coalesce(sum(l.delta), 0)::int
  from points_ledger l
  left join orders o on o.id = l.order_id
  where l.line_user_id = p_user
    and not (l.kind = 'redeem' and (o.status = 'cancelled' or (o.status = 'awaiting_payment' and o.expires_at < now())));
$$;

drop function if exists place_order(date, text, int, text, text, jsonb, int, int, text, int);

-- p_total = ยอดที่ต้องจ่ายหลังหักแต้ม; ถ้าเป็น 0 ออเดอร์เข้าคิว (pending) ทันที
create or replace function place_order(
  p_date date,
  p_time text,
  p_capacity int,
  p_user text,
  p_name text,
  p_items jsonb,
  p_total int,
  p_cups int,
  p_note text,
  p_hold_minutes int default 10,
  p_points int default 0
) returns table (order_id bigint, order_no int, order_expires timestamptz, order_status text)
language plpgsql
set search_path = public
as $$
declare
  used int;
  n int;
  new_id bigint;
  st text := case when p_total = 0 then 'pending' else 'awaiting_payment' end;
  exp timestamptz := case when p_total = 0 then null else now() + make_interval(mins => p_hold_minutes) end;
begin
  perform pg_advisory_xact_lock(hashtext('orders:' || p_date::text));
  perform pg_advisory_xact_lock(hashtext('points:' || p_user));

  if p_points > 0 and points_balance(p_user) < p_points then
    raise exception 'POINTS_LOW';
  end if;

  select coalesce(sum(o.cups), 0) into used
  from orders o
  where o.pickup_date = p_date and o.pickup_time = p_time and o.status <> 'cancelled'
    and not (o.status = 'awaiting_payment' and o.expires_at < now());

  if used + p_cups > p_capacity then
    raise exception 'SLOT_FULL';
  end if;

  select coalesce(max(o.daily_no), 0) + 1 into n from orders o where o.pickup_date = p_date;

  insert into orders (daily_no, pickup_date, pickup_time, line_user_id, customer_name, items, total, discount, cups, note, status, expires_at, paid_at)
  values (n, p_date, p_time, p_user, p_name, p_items, p_total, p_points, p_cups, p_note, st, exp, case when p_total = 0 then now() end)
  returning id into new_id;

  if p_points > 0 then
    insert into points_ledger (line_user_id, order_id, delta, kind) values (p_user, new_id, -p_points, 'redeem');
  end if;

  return query select new_id, n, exp, st;
end;
$$;

revoke all on function place_order(date, text, int, text, text, jsonb, int, int, text, int, int) from public, anon, authenticated;
grant execute on function place_order(date, text, int, text, text, jsonb, int, int, text, int, int) to service_role;
revoke all on function points_balance(text) from public, anon, authenticated;
grant execute on function points_balance(text) to service_role;
