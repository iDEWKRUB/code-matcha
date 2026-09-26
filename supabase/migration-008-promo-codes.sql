-- โค้ดส่วนลด (รันครั้งเดียวใน SQL Editor หลัง migration-007)

create table if not exists promo_codes (
  code text primary key, -- เก็บเป็นตัวพิมพ์ใหญ่
  kind text not null check (kind in ('percent', 'amount')),
  value int not null check (value > 0),
  max_discount int check (max_discount is null or max_discount > 0), -- เพดานส่วนลด (ใช้กับ %)
  min_spend int not null default 0,
  new_customers_only boolean not null default false,
  per_user_limit int not null default 1 check (per_user_limit > 0),
  max_uses int check (max_uses is null or max_uses > 0), -- สิทธิ์รวมทั้งหมด (null = ไม่จำกัด)
  expires_on date, -- ใช้ได้ถึงวันนี้ (null = ไม่หมดอายุ)
  active boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table promo_codes enable row level security;

alter table orders add column if not exists promo_code text;
alter table orders add column if not exists promo_discount int not null default 0;
create index if not exists orders_promo on orders (promo_code) where promo_code is not null;

-- ที่เก็บรูปโปร (สาธารณะ เพราะ LINE ต้องโหลดรูปไปแสดงในการ์ด)
insert into storage.buckets (id, name, public) values ('promo', 'promo', true) on conflict (id) do nothing;

insert into promo_codes (code, kind, value, new_customers_only, per_user_limit, note)
values ('CMNEW10', 'percent', 10, true, 1, 'ลูกค้าใหม่ลด 10%')
on conflict (code) do nothing;
