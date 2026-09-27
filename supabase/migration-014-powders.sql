-- ผงมัทฉะให้ลูกค้าเลือก (ร้านตั้งเองในหลังบ้าน): รันครั้งเดียวใน Supabase > SQL Editor (หลัง migration-013)
-- ราคาที่บวกเพิ่ม = บาทต่อกรัม × กรัมที่เมนูนั้นใช้ (ปัดเป็นหลัก 5 บาท)
-- เช่น ผง A บวก 5 บาท/กรัม: เพียวมัทฉะ 3g = +15, มัทฉะลาเต้ 4g = +20, Cold Whisk 5g = +25

create table if not exists matcha_powders (
  id bigint generated always as identity primary key,
  name text not null,
  note text not null default '',                 -- คำอธิบายสั้น ๆ ที่ลูกค้าเห็น
  extra_per_gram numeric(8, 2) not null default 0 check (extra_per_gram >= 0),
  cost_item_id bigint references cost_items (id) on delete set null, -- ผูกกับคลังวัตถุดิบ เพื่อคิดต้นทุนตามผงที่เลือก
  active boolean not null default true,
  sort int not null default 0
);
alter table matcha_powders enable row level security;

-- กรัมผงมัทฉะที่เมนูใช้ (ว่าง = เมนูนี้ไม่ให้เลือกผง)
alter table menu_items add column if not exists matcha_grams numeric(5, 1) check (matcha_grams is null or matcha_grams > 0);

-- ผงตั้งต้น (แก้ชื่อ/ราคา/เพิ่มได้ในหลังบ้าน > ต้นทุน & กำไร > ผงมัทฉะ)
insert into matcha_powders (name, note, extra_per_gram, sort)
select * from (values
  ('ผงมัทฉะทั่วไป', 'ผงประจำร้าน', 0::numeric, 0),
  ('ผงมัทฉะ A', '', 5, 1),
  ('ผงมัทฉะ C', '', 10, 2),
  ('ผงมัทฉะ B', '', 13.33, 3)
) v(name, note, extra_per_gram, sort)
where not exists (select 1 from matcha_powders);
