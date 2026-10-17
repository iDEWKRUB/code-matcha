-- โค้ดส่วนลดเฉพาะช่วงเวลา (เช่น Happy Hour 17:00-19:00) · ว่างทั้งคู่ = ใช้ได้ทั้งวัน
alter table promo_codes add column if not exists time_from text;
alter table promo_codes add column if not exists time_to text;
