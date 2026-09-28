-- มาม่าบาร์ (บริการตัวเอง): ของทุกชิ้นติดสติ๊กเกอร์ QR ลูกค้าถ่ายรูปถาดแล้วจ่ายเอง
create table if not exists bar_items (
  id text primary key,
  name text not null,
  kind text not null default 'noodle' check (kind in ('noodle', 'topping', 'other')),
  price int not null check (price >= 0),
  available boolean not null default true,
  sort int not null default 0,
  image_url text,
  created_at timestamptz not null default now()
);
alter table bar_items enable row level security;

-- ออเดอร์มาจากไหน: menu = หน้าสั่งปกติ, bar = มาม่าบาร์
alter table orders add column if not exists source text not null default 'menu';
alter table orders drop constraint if exists orders_source_check;
alter table orders add constraint orders_source_check check (source in ('menu', 'bar'));

-- เลขอ้างอิงธุรกรรมจากสลิป (ตรวจอัตโนมัติ) กันใช้สลิปเดิมซ้ำ
alter table orders add column if not exists slip_ref text;
create unique index if not exists orders_slip_ref_key on orders (slip_ref) where slip_ref is not null;

-- ของตัวอย่าง (ราคาชั่วคราว แก้ได้ที่หน้า /admin/bar)
insert into bar_items (id, name, kind, price, sort) values
  ('mama-tomyum', 'มาม่ารสต้มยำกุ้ง', 'noodle', 20, 1),
  ('mama-moosub', 'มาม่ารสหมูสับ', 'noodle', 20, 2),
  ('top-shrimp', 'ท็อปปิ้ง กุ้ง', 'topping', 25, 10),
  ('top-clam', 'ท็อปปิ้ง หอย', 'topping', 25, 11),
  ('top-crab', 'ท็อปปิ้ง ปู', 'topping', 20, 12),
  ('top-egg', 'ท็อปปิ้ง ไข่', 'topping', 10, 13)
on conflict (id) do nothing;
