-- มาม่าบาร์: เรียกเก็บเพิ่มแบบเลือกรายการ + แจ้งลูกค้า + ลูกค้าจ่ายเพิ่มเอง
-- bar_extra (ยอด) กับ bar_extra_note มีอยู่แล้วจาก migration 020
alter table orders add column if not exists bar_extra_items jsonb not null default '[]'::jsonb;
-- none = ไม่มี, due = แจ้งลูกค้าแล้ว รอจ่าย, review = แนบสลิปแล้ว รอร้านตรวจ, paid = จ่ายเพิ่มแล้ว
alter table orders add column if not exists bar_extra_status text not null default 'none';
alter table orders drop constraint if exists orders_bar_extra_status_check;
alter table orders add constraint orders_bar_extra_status_check check (bar_extra_status in ('none', 'due', 'review', 'paid'));
alter table orders add column if not exists bar_extra_sent_at timestamptz;
alter table orders add column if not exists bar_extra_slip_path text;
alter table orders add column if not exists bar_extra_slip_ref text;
alter table orders add column if not exists bar_extra_paid_at timestamptz;
create unique index if not exists orders_bar_extra_slip_ref_key on orders (bar_extra_slip_ref) where bar_extra_slip_ref is not null;

-- บิลที่บันทึกยอดไว้ก่อนมีระบบนี้: ถือว่ารอจ่าย (ร้านเลือกรายการ + ส่งแจ้งใหม่ได้)
update orders set bar_extra_status = 'due' where source = 'bar' and bar_extra > 0 and bar_extra_status = 'none';
