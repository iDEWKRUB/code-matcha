-- รีวิวบิลหน้าร้าน: QR บนใบเสร็จ / ปุ่มหลังรับแต้ม → รีวิวได้ 1 ครั้งต่อบิล (ไม่ต้องล็อกอิน LINE)
alter table pos_bills add column if not exists review_token text unique;

-- รีวิวผูกกับออเดอร์ LINE (order_id) หรือบิลหน้าร้าน (pos_bill_id) อย่างใดอย่างหนึ่ง
alter table reviews alter column order_id drop not null;
alter table reviews add column if not exists pos_bill_id bigint unique references pos_bills (id) on delete cascade;
alter table reviews drop constraint if exists reviews_target_check;
alter table reviews add constraint reviews_target_check check (order_id is not null or pos_bill_id is not null);
