-- ชำระเงินก่อนเข้าคิว: รันครั้งเดียวใน Supabase > SQL Editor

alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('awaiting_payment', 'payment_review', 'pending', 'preparing', 'ready', 'completed', 'cancelled'));
alter table orders alter column status set default 'awaiting_payment';
alter table orders add column if not exists expires_at timestamptz;
alter table orders add column if not exists slip_path text;
alter table orders add column if not exists paid_at timestamptz;

-- ที่เก็บรูปสลิป (ส่วนตัว เข้าถึงได้เฉพาะเซิร์ฟเวอร์)
insert into storage.buckets (id, name, public) values ('slips', 'slips', false) on conflict (id) do nothing;

drop function if exists place_order(date, text, int, text, text, jsonb, int, int, text);

-- ออเดอร์ใหม่เริ่มที่ awaiting_payment และจองที่ไว้ p_hold_minutes นาที
-- ออเดอร์ที่รอชำระแต่หมดเวลาแล้วไม่นับเป็นที่ใช้
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
  p_hold_minutes int default 10
) returns table (order_id bigint, order_no int, order_expires timestamptz)
language plpgsql
set search_path = public
as $$
declare
  used int;
  n int;
  new_id bigint;
  exp timestamptz := now() + make_interval(mins => p_hold_minutes);
begin
  perform pg_advisory_xact_lock(hashtext('orders:' || p_date::text));

  select coalesce(sum(o.cups), 0) into used
  from orders o
  where o.pickup_date = p_date and o.pickup_time = p_time and o.status <> 'cancelled'
    and not (o.status = 'awaiting_payment' and o.expires_at < now());

  if used + p_cups > p_capacity then
    raise exception 'SLOT_FULL';
  end if;

  select coalesce(max(o.daily_no), 0) + 1 into n from orders o where o.pickup_date = p_date;

  insert into orders (daily_no, pickup_date, pickup_time, line_user_id, customer_name, items, total, cups, note, status, expires_at)
  values (n, p_date, p_time, p_user, p_name, p_items, p_total, p_cups, p_note, 'awaiting_payment', exp)
  returning id into new_id;

  return query select new_id, n, exp;
end;
$$;

revoke all on function place_order(date, text, int, text, text, jsonb, int, int, text, int) from public, anon, authenticated;
grant execute on function place_order(date, text, int, text, text, jsonb, int, int, text, int) to service_role;
