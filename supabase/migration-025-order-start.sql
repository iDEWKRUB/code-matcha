-- เลขออเดอร์แรกของแต่ละวัน (เช่น เริ่มที่ #6 แทน #1) ตั้งได้ในหลังร้าน > ตั้งค่าร้าน
alter table shop_settings add column if not exists order_no_start int not null default 6;

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
  first_no int;
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

  select greatest(coalesce(max(s.order_no_start), 1), 1) into first_no from shop_settings s where s.id = 1;
  select coalesce(max(o.daily_no), first_no - 1) + 1 into n from orders o where o.pickup_date = p_date;

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
