-- ข้อความบนแก้ว: ลูกค้าเขียนตอนสั่ง (ไม่เกิน 120 ตัวอักษร) · ร้านพิมพ์สติ๊กเกอร์ QR เฉพาะออเดอร์นั้น
-- cup_token = รหัสสุ่มใน QR (เดาไม่ได้) สแกนแล้วเปิด /gift?t=... เห็นข้อความของแก้วนี้แก้วเดียว
alter table orders
  add column if not exists cup_msg text,
  add column if not exists cup_to text,
  add column if not exists cup_from text,
  add column if not exists cup_token text;
create unique index if not exists orders_cup_token_key on orders (cup_token) where cup_token is not null;
