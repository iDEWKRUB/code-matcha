-- มาม่าบาร์: หมวดหมู่ / กลุ่มสินค้า / รายละเอียด / หน่วย (ใช้กรองและค้นหาในหลังร้านและหน้าลูกค้า)
alter table bar_items add column if not exists category text not null default '';
alter table bar_items add column if not exists item_group text not null default '';
alter table bar_items add column if not exists detail text not null default '';
alter table bar_items add column if not exists unit text not null default '';

-- ของเดิมที่ยังไม่มีหมวด: ใส่ตามประเภทการ์ตูน
update bar_items set category = case kind
  when 'noodle' then 'บะหมี่กึ่งสำเร็จรูป'
  when 'topping' then 'ท็อปปิ้ง'
  else 'อื่น ๆ' end
where category = '';
