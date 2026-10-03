-- มาม่าบาร์: รหัสสินค้า 3 หลัก (001–999) ไว้คีย์/ค้นหาเร็ว และพิมพ์บนสติ๊กเกอร์ QR
alter table bar_items add column if not exists code int check (code between 1 and 999);
create unique index if not exists bar_items_code_key on bar_items (code) where code is not null;

-- ของที่ยังไม่มีรหัส: ไล่เลขต่อจากเลขสูงสุด ตามลำดับที่แสดง (sort แล้วชื่อ)
with base as (select coalesce(max(code), 0) as m from bar_items),
x as (select id, row_number() over (order by sort, name) as n from bar_items where code is null)
update bar_items b set code = x.n + base.m
from x, base
where b.id = x.id and x.n + base.m <= 999;
