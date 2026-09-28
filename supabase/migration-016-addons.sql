-- ท็อปปิ้งเปิด/ปิดรายเมนู: รันครั้งเดียวใน Supabase > SQL Editor (หลัง migration-015)

-- เมนูนี้มีท็อปปิ้งให้เลือกไหม (ช็อตมัทฉะ / ซอฟต์ครีม)
alter table menu_items add column if not exists addons boolean not null default true;

-- เพียวมัทฉะ: ขายเฉพาะเย็น และไม่มีท็อปปิ้ง
update menu_items set temps = '{iced}', addons = false where id = 'usucha';
