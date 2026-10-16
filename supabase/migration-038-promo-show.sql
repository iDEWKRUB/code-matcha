-- โค้ดส่วนลดที่ร้านเลือกให้ "แสดงในหน้าชำระเงิน" ลูกค้ากดใช้ได้เลยไม่ต้องพิมพ์ (โค้ดลับ เช่น แจกใบปลิว ปล่อยเป็น false)
alter table promo_codes add column if not exists show_customers boolean not null default false;
