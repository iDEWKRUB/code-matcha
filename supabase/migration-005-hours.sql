-- เวลาเปิด-ปิดร้าน ตั้งได้จากหน้าตั้งค่า (รันครั้งเดียวใน SQL Editor หลัง migration-004)

alter table shop_settings add column if not exists open_time text not null default '10:30';
alter table shop_settings add column if not exists close_time text not null default '17:00';
alter table shop_settings add column if not exists slot_minutes int not null default 15;
alter table shop_settings add column if not exists slot_capacity int not null default 8;
alter table shop_settings add column if not exists accepting boolean not null default true;
