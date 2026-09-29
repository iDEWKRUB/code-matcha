-- มาม่าบาร์: สต๊อก (ขายแล้วตัดอัตโนมัติ + รับของเข้า + นับจริงเทียบส่วนต่าง)
alter table bar_items add column if not exists stock int not null default 0;

-- ทุกการเปลี่ยนแปลงสต๊อก: in = รับเข้า, sale = ขาย (ต่อบิล), count = ปรับตามที่นับจริง
create table if not exists bar_stock_moves (
  id bigserial primary key,
  item_id text not null references bar_items (id) on delete cascade,
  delta int not null,
  kind text not null check (kind in ('in', 'sale', 'count')),
  order_id bigint references orders (id) on delete set null,
  count_id bigint,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists bar_stock_moves_created_idx on bar_stock_moves (created_at desc);
create index if not exists bar_stock_moves_order_idx on bar_stock_moves (order_id, kind);
alter table bar_stock_moves enable row level security;

-- ผลนับแต่ละครั้ง lines = [{id, name, price, expected, counted, diff, waste}]
create table if not exists bar_counts (
  id bigserial primary key,
  count_date date not null,
  lines jsonb not null default '[]'::jsonb,
  missing int not null default 0,
  missing_value int not null default 0,
  created_at timestamptz not null default now()
);
alter table bar_counts enable row level security;

-- ตัดสต๊อกของบิล (เรียกซ้ำได้: คืนของเดิมของบิลนี้ก่อน แล้วตัดใหม่) p_lines = [{id, qty}]
create or replace function bar_stock_set_order(p_order bigint, p_kind text, p_lines jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare r record;
begin
  for r in select item_id, sum(delta) as d from bar_stock_moves where order_id = p_order and kind = p_kind group by item_id loop
    update bar_items set stock = stock - r.d where id = r.item_id;
  end loop;
  delete from bar_stock_moves where order_id = p_order and kind = p_kind;
  insert into bar_stock_moves (item_id, delta, kind, order_id)
  select l->>'id', -((l->>'qty')::int), p_kind, p_order
  from jsonb_array_elements(p_lines) l
  where (l->>'qty')::int > 0 and exists (select 1 from bar_items b where b.id = l->>'id');
  update bar_items b set stock = b.stock + m.d
  from (select item_id, sum(delta) as d from bar_stock_moves where order_id = p_order and kind = p_kind group by item_id) m
  where b.id = m.item_id;
end;
$$;

-- เพิ่ม/ปรับสต๊อกหลายรายการในครั้งเดียว p_lines = [{id, delta}]
create or replace function bar_stock_add(p_kind text, p_lines jsonb, p_note text, p_count bigint)
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into bar_stock_moves (item_id, delta, kind, count_id, note)
  select l->>'id', (l->>'delta')::int, p_kind, p_count, coalesce(p_note, '')
  from jsonb_array_elements(p_lines) l
  where (l->>'delta')::int <> 0 and exists (select 1 from bar_items b where b.id = l->>'id');
  update bar_items b set stock = b.stock + (l->>'delta')::int
  from jsonb_array_elements(p_lines) l
  where b.id = l->>'id' and (l->>'delta')::int <> 0;
end;
$$;

revoke all on function bar_stock_set_order(bigint, text, jsonb) from public, anon, authenticated;
grant execute on function bar_stock_set_order(bigint, text, jsonb) to service_role;
revoke all on function bar_stock_add(text, jsonb, text, bigint) from public, anon, authenticated;
grant execute on function bar_stock_add(text, jsonb, text, bigint) to service_role;
