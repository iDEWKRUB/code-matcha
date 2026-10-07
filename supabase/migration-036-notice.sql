-- ประกาศสำคัญจากร้าน (เช่น วันนี้ร้านหยุด) แสดงเด่นบนหน้าสั่งและมาม่าบาร์ · notice_until = หายเองหลังเวลานี้ (ว่าง = จนกว่าจะปิดเอง)
alter table shop_settings add column if not exists notice text not null default '' check (char_length(notice) <= 300);
alter table shop_settings add column if not exists notice_active boolean not null default false;
alter table shop_settings add column if not exists notice_until timestamptz;
