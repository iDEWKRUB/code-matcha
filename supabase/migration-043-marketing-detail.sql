-- หน้าการตลาด: รายละเอียดคอนเทนต์เพิ่ม (เนื้อเรื่อง หลักจิตวิทยา ไอเดียภาพ CTA แฮชแท็ก แคปชันแยกช่องทาง)
alter table marketing_posts add column if not exists body text not null default '';      -- เนื้อเรื่อง/คำอธิบาย
alter table marketing_posts add column if not exists psychology text not null default ''; -- หลักจิตวิทยาที่ใช้ (ว่าง = ไม่ระบุ)
alter table marketing_posts add column if not exists visual text not null default '';    -- ไอเดียภาพ/ช็อตที่ต้องถ่าย
alter table marketing_posts add column if not exists cta text not null default '';       -- ชวนให้ทำอะไร
alter table marketing_posts add column if not exists hashtags text not null default '';  -- แฮชแท็กเฉพาะโพสต์นี้
alter table marketing_posts add column if not exists captions jsonb not null default '{}'::jsonb; -- {"x":"...","ig":"..."} แคปชันแยกช่องทาง (ว่าง = ใช้แคปชันหลัก)

-- แฮชแท็กประจำแบรนด์ เติมท้ายทุกโพสต์ตอนคัดลอก
alter table marketing_settings add column if not exists brand_tags text not null default '#CODEMATCHA';
