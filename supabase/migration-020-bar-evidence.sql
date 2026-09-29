-- มาม่าบาร์: หลักฐานของแต่ละบิล (รูปถาด ผลสแกน เวลาที่ยอมรับเงื่อนไข) + บันทึกเรียกเก็บเพิ่ม
alter table orders add column if not exists tray_path text;
alter table orders add column if not exists bar_scan jsonb;
alter table orders add column if not exists terms_at timestamptz;
alter table orders add column if not exists terms_version int;
alter table orders add column if not exists bar_extra int not null default 0;
alter table orders add column if not exists bar_extra_note text not null default '';

-- ที่เก็บรูปถาด (ส่วนตัว เปิดดูผ่านลิงก์ชั่วคราวจากเซิร์ฟเวอร์เท่านั้น)
insert into storage.buckets (id, name, public) values ('trays', 'trays', false)
on conflict (id) do nothing;
