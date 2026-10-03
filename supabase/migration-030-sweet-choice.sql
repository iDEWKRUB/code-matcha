-- ความหวานเปิด/ปิดรายเมนู: ปิด = ไม่มีให้เลือกความหวาน (ทำแบบไม่หวานเสมอ)
alter table menu_items add column if not exists sweet_choice boolean not null default true;

-- เพียวมัทฉะ: ไม่ใส่น้ำตาล
update menu_items set sweet_choice = false where id = 'usucha';
