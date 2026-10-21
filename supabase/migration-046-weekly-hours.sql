-- เวลาเปิด–ปิดร้านรายสัปดาห์ (วันหยุดประจำ + เวลาต่างกันแต่ละวัน) และวันหยุดพิเศษ
-- weekly_hours = รายการ 7 ช่อง ลำดับ อาทิตย์ จันทร์ … เสาร์: [{"closed":false,"open":"09:00","close":"20:00"}, ...]
-- ว่าง (null) = ทุกวันเปิดตาม open_time/close_time เดิม · สวิตช์เปิด/ปิดรับออเดอร์ (accepting) ยังใช้ปิดทันทีได้เหมือนเดิม
alter table shop_settings add column if not exists weekly_hours jsonb;
alter table shop_settings add column if not exists closed_dates jsonb not null default '[]'::jsonb; -- [{"date":"2026-12-31","note":"ปีใหม่"}]
