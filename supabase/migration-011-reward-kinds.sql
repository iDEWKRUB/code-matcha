-- ของขวัญ 2 หมวด: รันครั้งเดียวใน Supabase > SQL Editor (หลัง migration-010)
--   menu  = แลกเครื่องดื่ม/อาหารของร้าน (ใช้รูปการ์ตูนของเมนู)
--   merch = ของพรีเมียม เช่น แก้ว ตุ๊กตา พวงกุญแจ ชุดชงมัทฉะ (ใช้รูปถ่ายที่อัปโหลด หรือรูปการ์ตูนตามแบบ)

alter table rewards add column if not exists category text not null default 'menu';
alter table rewards drop constraint if exists rewards_category_check;
alter table rewards add constraint rewards_category_check check (category in ('menu', 'merch'));
alter table rewards add column if not exists look text; -- รูปการ์ตูนของพรีเมียม: tumbler, keychain, chasen, plush, tote
alter table rewards add column if not exists image_url text; -- รูปถ่ายจริง (ถ้ามี จะแสดงแทนการ์ตูน)

-- ของพรีเมียมตัวอย่าง (แก้/ลบ/ใส่รูปจริงได้ในหน้าบาริสต้า)
insert into rewards (name, description, points, category, look, sort)
select * from (values
  ('พวงกุญแจแก้วมัทฉะ', 'พวงกุญแจอะคริลิกลายน้องมัทฉะ', 60, 'merch', 'keychain', 10),
  ('แก้วเก็บความเย็น CODE-MACHA', 'สเตนเลส 20 oz เก็บเย็นได้นาน', 250, 'merch', 'tumbler', 11),
  ('ตุ๊กตาน้องมัทฉะ', 'ตุ๊กตานุ่มนิ่ม สูงประมาณ 20 ซม.', 400, 'merch', 'plush', 12),
  ('ชุดชงมัทฉะ', 'ฉะเซ็น (แปรงตี) + ถ้วยชง + ช้อนตัก', 800, 'merch', 'chasen', 13)
) v(name, description, points, category, look, sort)
where not exists (select 1 from rewards where category = 'merch');
