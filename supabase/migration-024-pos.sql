-- หน้าร้าน (POS): ลูกค้าเดินเข้าร้านไม่สั่งผ่าน LINE · พนักงานคิดเงินให้ ทั้งมัทฉะและมาม่าบาร์
-- 1 บิล (pos_bills) = 1 ใบเสร็จ มีได้หลายออเดอร์ (สั่งเพิ่มระหว่างนั่ง แล้วเช็คบิลตอนออก)
create table if not exists pos_bills (
  id bigserial primary key,
  bill_date date not null,
  label text not null default '',            -- โต๊ะ 3 / ชื่อลูกค้า
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  opened_at timestamptz not null default now(),
  paid_at timestamptz,
  subtotal int not null default 0,
  promo_code text,
  promo_discount int not null default 0,
  total int not null default 0,              -- ยอดสุทธิที่รับจริง
  pay_method text check (pay_method in ('qr', 'cash')),
  cash_received int,
  member_id text,                            -- LINE userId ของสมาชิกที่ผูกไว้ (ได้แต้มเลย)
  claim_token text unique,                   -- QR สแกนรับแต้มบนใบเสร็จ (ใช้ได้ครั้งเดียว)
  claimed_by text,
  claimed_at timestamptz,
  cashier text not null default ''
);
create index if not exists pos_bills_date on pos_bills (bill_date);
alter table pos_bills enable row level security;

-- ออเดอร์: ช่องทาง (line = ลูกค้าสั่งเอง, pos = หน้าร้าน) + บิลหน้าร้านที่สังกัด
alter table orders add column if not exists channel text not null default 'line';
alter table orders add column if not exists pos_bill_id bigint references pos_bills (id) on delete set null;
create index if not exists orders_pos_bill on orders (pos_bill_id) where pos_bill_id is not null;
