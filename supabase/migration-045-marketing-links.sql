-- หน้าการตลาด: แนบลิงก์โพสต์จริงของแต่ละช่องทาง (วางแล้วสถานะเป็น "ลงแล้ว" เอง) + ลิงก์เพจ/โปรไฟล์ร้านของแต่ละช่อง
alter table marketing_posts add column if not exists links jsonb not null default '{}'::jsonb; -- {"fb":"https://...","ig":"https://..."}
alter table marketing_channels add column if not exists url text not null default '';           -- ลิงก์เพจ/โปรไฟล์ของร้าน
