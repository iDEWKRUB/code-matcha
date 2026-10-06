-- รูปเครื่องดื่มจริง (ไม่บังคับ): การ์ดเมนูมีปุ่มพลิกจากการ์ตูนเป็นรูปจริง · ว่าง = ไม่มีปุ่มพลิก
alter table menu_items add column if not exists photo_url text;
