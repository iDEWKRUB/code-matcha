-- มาม่าบาร์: ต้นทุนต่อชิ้น (ใช้คิดกำไรในรายงาน) · ว่าง = ยังไม่ใส่ต้นทุน
alter table bar_items add column if not exists cost numeric(10, 2) check (cost is null or cost >= 0);
