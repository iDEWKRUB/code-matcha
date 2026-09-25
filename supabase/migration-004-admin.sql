-- หน้าตั้งค่าร้าน: ราคาโปร เมนูแนะนำ หน้าตาแก้ว ป้ายประกาศ (รันครั้งเดียวใน SQL Editor หลัง migration-003)

alter table menu_items add column if not exists promo_price int check (promo_price is null or promo_price >= 0);
alter table menu_items add column if not exists recommended boolean not null default false;
alter table menu_items add column if not exists look text;

create table if not exists shop_settings (
  id int primary key default 1 check (id = 1),
  banner text not null default '',
  banner_active boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into shop_settings (id) values (1) on conflict (id) do nothing;
alter table shop_settings enable row level security;
