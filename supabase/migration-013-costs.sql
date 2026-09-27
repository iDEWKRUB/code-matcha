-- ต้นทุน & กำไร: รันครั้งเดียวใน Supabase > SQL Editor (หลัง migration-012)

-- คลังวัตถุดิบ/ต้นทุนที่ใช้บ่อย (ผงมัทฉะ แก้ว ฝา น้ำแข็ง ค่าแรง ค่าน้ำไฟ ฯลฯ)
-- ใส่ราคาเป็นแพ็ก (pack_price / pack_size) ระบบคิดราคาต่อหน่วยให้ หรือใส่ unit_cost ตรง ๆ ก็ได้
create table if not exists cost_items (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null default 'ingredient' check (category in ('ingredient', 'packaging', 'labor', 'utility', 'other')),
  unit text not null default '',
  unit_cost numeric(12, 4) not null default 0 check (unit_cost >= 0),
  pack_price numeric(12, 2) check (pack_price is null or pack_price >= 0),
  pack_size numeric(12, 3) check (pack_size is null or pack_size > 0),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table cost_items enable row level security;

-- สูตรต้นทุนของแต่ละเมนู: ผูกกับคลัง (ราคาเปลี่ยนตามคลังอัตโนมัติ) หรือใส่เองเฉพาะเมนูนี้
-- name/unit/unit_cost เก็บสำเนาไว้เสมอ เผื่อรายการในคลังถูกลบ
create table if not exists menu_cost_lines (
  id bigint generated always as identity primary key,
  menu_item_id text not null references menu_items (id) on delete cascade,
  cost_item_id bigint references cost_items (id) on delete set null,
  name text not null,
  category text not null default 'other' check (category in ('ingredient', 'packaging', 'labor', 'utility', 'other')),
  unit text not null default '',
  unit_cost numeric(12, 4) not null default 0 check (unit_cost >= 0),
  qty numeric(12, 3) not null default 1 check (qty >= 0),
  sort int not null default 0
);
create index if not exists menu_cost_lines_menu on menu_cost_lines (menu_item_id);
alter table menu_cost_lines enable row level security;

-- แพลตฟอร์มเดลิเวอรี่ (ค่า GP)
create table if not exists gp_platforms (
  id bigint generated always as identity primary key,
  name text not null,
  gp_percent numeric(5, 2) not null check (gp_percent >= 0 and gp_percent < 90),
  sort int not null default 0
);
alter table gp_platforms enable row level security;

-- บวก VAT 7% บนค่า GP (แพลตฟอร์มส่วนใหญ่คิดแบบนี้)
alter table shop_settings add column if not exists gp_vat boolean not null default true;
