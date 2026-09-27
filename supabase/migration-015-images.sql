-- รูปวัตถุดิบและรูปผงมัทฉะ: รันครั้งเดียวใน Supabase > SQL Editor (หลัง migration-014)
-- รูปเก็บใน bucket "promo" (สาธารณะ) เหมือนรูปของขวัญ

alter table cost_items add column if not exists image_url text;
-- ผงมัทฉะใช้รูปของตัวเอง ถ้าไม่มีจะใช้รูปของวัตถุดิบที่ผูกไว้
alter table matcha_powders add column if not exists image_url text;
