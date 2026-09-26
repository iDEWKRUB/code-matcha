-- เมนูอาหาร + ท็อปปิ้ง (รันครั้งเดียวใน SQL Editor หลัง migration-005)

alter table menu_items add column if not exists kind text not null default 'drink';
alter table menu_items drop constraint if exists menu_items_kind_check;
alter table menu_items add constraint menu_items_kind_check check (kind in ('drink', 'food'));
alter table menu_items add column if not exists toppings jsonb not null default '[]'::jsonb;

insert into menu_items (id, name, jp, description, price, temps, milk, available, sort, kind, look, toppings) values
  ('french-fries', 'เฟรนช์ฟรายส์', 'フライドポテト', 'มันฝรั่งทอดกรอบนอกนุ่มใน โรยเกลือ', 59, '{hot}', false, true, 100, 'food', 'fries', '[]'),
  ('omelette-rice', 'ข้าวไข่เจียว', 'オムライス', 'ไข่เจียวฟูกรอบบนข้าวสวยร้อน ๆ เลือกท็อปปิ้งได้ตามใจ', 50, '{hot}', false, true, 101, 'food', 'omelette-rice',
   '[{"id":"crab","label":"ปูอัด","price":15},
     {"id":"beef","label":"ลูกชิ้นเนื้อหั่น","price":15},
     {"id":"shrimp","label":"กุ้งตัวเล็ก 3 ตัว","price":25},
     {"id":"tomato","label":"มะเขือเทศ","price":5},
     {"id":"chaom","label":"ชะอม","price":10},
     {"id":"chili","label":"พริก","price":0},
     {"id":"chicken","label":"ไก่สับ","price":15},
     {"id":"herbs","label":"ต้นหอมผักชี","price":0}]')
on conflict (id) do nothing;
