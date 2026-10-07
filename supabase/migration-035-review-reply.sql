-- ร้านตอบกลับรีวิว (แสดงใต้รีวิวในหน้าลูกค้า) · ว่าง = ยังไม่ตอบ
alter table reviews add column if not exists reply text not null default '' check (char_length(reply) <= 300);
alter table reviews add column if not exists replied_at timestamptz;
