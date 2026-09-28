-- ซ่อนเมนูจากหน้าลูกค้า: รันครั้งเดียวใน Supabase > SQL Editor (หลัง migration-017)
-- available = false → ลูกค้ายังเห็นเมนูพร้อมป้าย "หมดวันนี้"
-- hidden = true     → ลูกค้าไม่เห็นเมนูนี้เลย (ยังอยู่ในหลังร้าน เปิดกลับได้ทุกเมื่อ)

alter table menu_items add column if not exists hidden boolean not null default false;
