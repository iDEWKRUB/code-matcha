-- วิธีรับ: สั่งล่วงหน้า / ทานที่ร้าน / รับกลับบ้าน (รันครั้งเดียวใน SQL Editor หลัง migration-006)

alter table orders add column if not exists service text not null default 'pickup'
  check (service in ('pickup', 'dine_in', 'takeaway'));
alter table orders add column if not exists table_no text not null default '';
