-- รีวิวแบบไม่ระบุชื่อ: 1 ออเดอร์ = 1 รีวิว (แก้ได้) · ไม่เก็บชื่อหรือ LINE ID ของผู้รีวิว
-- is_public = ลูกค้ายอมให้แสดงต่อคนอื่น · hidden = ร้านซ่อนจากหน้าลูกค้า (ยังเห็นในหลังร้าน)
create table if not exists reviews (
  id bigint generated always as identity primary key,
  order_id bigint not null unique references orders (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 300),
  items text not null default '', -- ชื่อเมนูในออเดอร์ (ไว้ให้ร้านรู้ว่ารีวิวแก้วไหน)
  is_public boolean not null default true,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reviews_created_idx on reviews (created_at desc);
alter table reviews enable row level security;
