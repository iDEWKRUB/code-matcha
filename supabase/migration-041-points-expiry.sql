-- แต้มหมดอายุ: ใช้กับแต้มใหม่ที่ได้ตั้งแต่ 1 พ.ย. 2569 (2026-11-01) เท่านั้น อายุ 6 เดือนนับจากวันที่ได้
-- แต้มที่มีอยู่และที่ได้ก่อนวันดังกล่าว ไม่หมดอายุ (expires_at เป็น null)
-- ใช้แต้มก่อนหมดอายุก่อนเสมอ (ใช้แต้มที่ใกล้หมดก่อน แล้วค่อยใช้แต้มที่ไม่หมดอายุ)
-- ค่าวันเริ่ม/จำนวนเดือนต้องตรงกับ POINTS_EXPIRY ใน lib/config.ts

alter table points_ledger add column if not exists expires_at timestamptz;
alter table points_ledger add column if not exists source_id bigint references points_ledger (id) on delete cascade;
alter table points_ledger drop constraint if exists points_ledger_kind_check;
alter table points_ledger add constraint points_ledger_kind_check check (kind in ('earn', 'redeem', 'adjust', 'reward', 'referral', 'expire'));
alter table points_ledger drop constraint if exists points_ledger_source_kind;
alter table points_ledger add constraint points_ledger_source_kind unique (source_id, kind);

-- ใส่วันหมดอายุให้แต้มที่ได้จากออเดอร์/ชวนเพื่อน ตั้งแต่วันเริ่มเป็นต้นไป
create or replace function points_set_expiry() returns trigger
language plpgsql
as $$
begin
  if new.delta > 0 and new.kind in ('earn', 'referral') and new.expires_at is null
     and now() >= timestamptz '2026-11-01 00:00:00+07' then
    new.expires_at := new.created_at + interval '6 months';
  end if;
  return new;
end;
$$;
drop trigger if exists points_expiry_bi on points_ledger;
create trigger points_expiry_bi before insert on points_ledger for each row execute function points_set_expiry();

-- จำลองการใช้แต้มตามลำดับเวลา: แต้มชุดไหนเหลือ/หมดอายุไปเท่าไร
create or replace function points_batches(p_user text)
returns table (batch_id bigint, exp timestamptz, remaining int, lost int)
language plpgsql stable
set search_path = public
as $$
declare
  r record;
  i int;
  n int := 0;
  spend int;
  take int;
  ids bigint[] := '{}';
  exps timestamptz[] := '{}';
  rem int[] := '{}';
  lst int[] := '{}';
begin
  for r in
    select l.id, l.delta, l.expires_at, l.created_at
    from points_ledger l
    left join orders o on o.id = l.order_id
    where l.line_user_id = p_user
      and l.kind <> 'expire'
      and not (l.kind = 'redeem' and (o.status = 'cancelled' or (o.status = 'awaiting_payment' and o.expires_at < now())))
    order by l.created_at, l.id
  loop
    for i in 1..n loop
      if rem[i] > 0 and exps[i] <= r.created_at then
        lst[i] := lst[i] + rem[i];
        rem[i] := 0;
      end if;
    end loop;
    if r.delta > 0 then
      if r.expires_at is not null then
        n := n + 1;
        ids[n] := r.id;
        exps[n] := r.expires_at;
        rem[n] := r.delta;
        lst[n] := 0;
      end if;
    else
      spend := -r.delta;
      for i in 1..n loop
        exit when spend <= 0;
        if rem[i] > 0 then
          take := least(rem[i], spend);
          rem[i] := rem[i] - take;
          spend := spend - take;
        end if;
      end loop;
    end if;
  end loop;
  for i in 1..n loop
    if rem[i] > 0 and exps[i] <= now() then
      lst[i] := lst[i] + rem[i];
      rem[i] := 0;
    end if;
    batch_id := ids[i];
    exp := exps[i];
    remaining := rem[i];
    lost := lst[i];
    return next;
  end loop;
end;
$$;

-- บันทึกแต้มที่หมดอายุแล้วลงบัญชี (ครั้งเดียวต่อชุด)
create or replace function points_settle(p_user text) returns void
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('points:' || p_user));
  insert into points_ledger (line_user_id, delta, kind, note, source_id, created_at)
  select p_user, -b.lost, 'expire', 'แต้มหมดอายุ', b.batch_id, b.exp
  from points_batches(p_user) b
  where b.lost > 0
  on conflict (source_id, kind) do nothing;
end;
$$;

-- ยอดคงเหลือ: ตัดแต้มหมดอายุให้ก่อนเสมอ (place_order และแลกของขวัญเรียกฟังก์ชันนี้อยู่แล้ว)
create or replace function points_balance(p_user text) returns int
language plpgsql
set search_path = public
as $$
declare
  v int;
begin
  perform points_settle(p_user);
  select coalesce(sum(l.delta), 0)::int into v
  from points_ledger l
  left join orders o on o.id = l.order_id
  where l.line_user_id = p_user
    and not (l.kind = 'redeem' and (o.status = 'cancelled' or (o.status = 'awaiting_payment' and o.expires_at < now())));
  return v;
end;
$$;

-- แต้มที่กำลังจะหมดอายุ (ยังไม่หมด)
create or replace function points_expiring(p_user text) returns table (exp timestamptz, points int)
language sql stable
set search_path = public
as $$
  select b.exp, b.remaining from points_batches(p_user) b where b.remaining > 0 and b.exp > now() order by b.exp;
$$;

revoke all on function points_batches(text), points_settle(text), points_balance(text), points_expiring(text), points_set_expiry() from public, anon, authenticated;
grant execute on function points_batches(text), points_settle(text), points_balance(text), points_expiring(text) to service_role;
