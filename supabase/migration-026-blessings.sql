-- คำอวยพรบนหน้า /gift (สติ๊กเกอร์ติดแก้ว) ที่ร้านแก้เองได้ · null = ใช้ชุดตั้งต้นในหน้าเว็บ
alter table shop_settings add column if not exists blessings jsonb;
