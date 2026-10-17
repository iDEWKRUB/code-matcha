-- จัดส่งตามรัศมี (ร้านส่งเอง ส่งฟรี) + สั่งล่วงหน้าสำหรับพรุ่งนี้ (มีรอบเช้าก่อนร้านเปิดได้)

-- วิธีรับใหม่: delivery = ร้านนำไปส่ง
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'orders'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%service%'
  loop
    execute format('alter table orders drop constraint %I', c);
  end loop;
end $$;
alter table orders add constraint orders_service_check check (service in ('pickup', 'dine_in', 'takeaway', 'delivery'));

-- ที่อยู่จัดส่งของออเดอร์: {lat, lng, km, address, phone}
alter table orders add column if not exists delivery jsonb;

-- ตั้งค่าร้าน
alter table shop_settings add column if not exists delivery_enabled boolean not null default false;
alter table shop_settings add column if not exists delivery_km numeric not null default 5;      -- รัศมีส่ง (กม.)
alter table shop_settings add column if not exists delivery_min int not null default 150;       -- ยอดขั้นต่ำสั่งส่ง (บาท)
alter table shop_settings add column if not exists shop_lat double precision;                    -- พิกัดร้าน
alter table shop_settings add column if not exists shop_lng double precision;
alter table shop_settings add column if not exists preorder_enabled boolean not null default false;
alter table shop_settings add column if not exists preorder_from text not null default '06:00';  -- รอบแรกของวันพรุ่งนี้ (ก่อนร้านเปิดได้)
alter table shop_settings add column if not exists preorder_cutoff text not null default '20:00'; -- รับสั่งของพรุ่งนี้ถึงกี่โมงวันนี้
