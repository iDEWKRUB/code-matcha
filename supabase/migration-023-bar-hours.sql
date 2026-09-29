-- มาม่าบาร์: สวิตช์เปิด/ปิดให้ลูกค้าเห็น + เวลาเปิดแยกจากมัทฉะ (หรือ 24 ชม.)
alter table shop_settings add column if not exists bar_enabled boolean not null default false;
alter table shop_settings add column if not exists bar_open_time text not null default '14:00';
alter table shop_settings add column if not exists bar_close_time text not null default '23:59';
alter table shop_settings add column if not exists bar_all_day boolean not null default false;
