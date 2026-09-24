# CODE-MACHA ระบบสั่งมัทฉะผ่าน LINE

ลูกค้าเปิดหน้าสั่งใน LINE (LIFF) เลือกเครื่องดื่มและเวลามารับ แล้วชำระเงินที่ร้าน
บาริสต้าดูออเดอร์ที่ `/admin` ระบบแจ้งกลุ่มพนักงานใน LINE เมื่อมีออเดอร์ใหม่ และแจ้งลูกค้าเมื่อเครื่องดื่มพร้อม

| ส่วน | ใช้ |
|---|---|
| หน้าเว็บ + API | Next.js บน Vercel |
| ฐานข้อมูล | Supabase (Postgres) |
| ล็อกอินลูกค้า | LINE Login + LIFF |
| แจ้งเตือน | LINE Messaging API |

## ตั้งค่าครั้งแรก

### 1. Supabase (ฐานข้อมูล)
1. สมัครที่ https://supabase.com แล้วสร้าง project ใหม่ (Region: Singapore)
2. เปิด **SQL Editor** วางเนื้อหาไฟล์ `supabase/schema.sql` ทั้งไฟล์ แล้วกด Run
3. ไปที่ **Project Settings > API** จดค่า
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (ห้ามเปิดเผย)

### 2. LINE Official Account + Messaging API
1. สร้าง LINE OA ที่ https://manager.line.biz
2. ใน OA Manager: **ตั้งค่า > Messaging API > เปิดใช้งาน** แล้วเลือก/สร้าง Provider
3. ใน OA Manager: **ตั้งค่าการตอบกลับ** ปิด "ข้อความตอบกลับอัตโนมัติ" และเปิด "Webhook"
4. ใน **ตั้งค่าบัญชี** เปิด "อนุญาตให้บัญชีเข้าร่วมกลุ่มแชท"
5. ไปที่ https://developers.line.biz > Provider เดียวกัน > channel Messaging API
   - แท็บ Basic settings: `Channel secret` → `LINE_CHANNEL_SECRET`
   - แท็บ Messaging API: กด Issue `Channel access token (long-lived)` → `LINE_CHANNEL_ACCESS_TOKEN`

### 3. LINE Login + LIFF (หน้าสั่งของลูกค้า)
1. ใน LINE Developers, Provider เดียวกัน: **Create a new channel > LINE Login** (App type: Web app)
2. แท็บ Basic settings: `Channel ID` → `LINE_LOGIN_CHANNEL_ID`
   และตั้ง **Linked LINE Official Account** เป็น OA ของร้าน
3. แท็บ LIFF > Add
   - Size: **Full**
   - Endpoint URL: ใส่ URL จาก Vercel (ขั้นที่ 4) เช่น `https://code-macha.vercel.app/` ใส่ชั่วคราวก่อนแล้วกลับมาแก้ได้
   - Scopes: `openid`, `profile`
   - Add friend option: **On (Aggressive)** เพื่อให้ลูกค้าแอดเพื่อน OA และรับข้อความแจ้งเตือนได้
   - จด `LIFF ID` → `NEXT_PUBLIC_LIFF_ID`
4. กด **Publish** channel LINE Login (ถ้ายังเป็น Developing จะใช้ได้แค่ผู้ดูแล)

### 4. Deploy บน Vercel
1. สร้าง repository บน GitHub แล้ว push โค้ดนี้ขึ้นไป
2. ที่ https://vercel.com > Add New Project > import repository นี้
3. ใส่ Environment Variables ทั้งหมดตาม `.env.example`
   - `ADMIN_PASSWORD`: รหัสผ่านหน้าบาริสต้า
   - `ADMIN_SESSION_SECRET`: สตริงสุ่มยาว 32 ตัวขึ้นไป
   - `LINE_STAFF_GROUP_ID`: เว้นว่างไว้ก่อน (ขั้นที่ 6)
4. Deploy แล้วนำ URL ที่ได้ไปใส่ LIFF Endpoint URL ในขั้นที่ 3

### 5. เชื่อม Webhook
LINE Developers > channel Messaging API > แท็บ Messaging API
- Webhook URL: `https://<โดเมนของคุณ>/api/line/webhook`
- กด Verify ต้องขึ้น Success แล้วเปิด **Use webhook**

### 6. กลุ่มพนักงาน
1. เชิญบัญชี OA เข้ากลุ่ม LINE ของพนักงาน บอทจะตอบ Group ID ทันที (หรือพิมพ์ `groupid` ในกลุ่ม)
2. นำไปใส่ `LINE_STAFF_GROUP_ID` ใน Vercel แล้วกด Redeploy

### 7. ให้ลูกค้าเข้าถึงหน้าสั่ง
- ลิงก์สั่ง: `https://liff.line.me/<LIFF_ID>`
- แนะนำสร้าง **Rich menu** ใน OA Manager ปุ่ม "สั่งมัทฉะ" ลิงก์ไปที่ URL ข้างบน
- ลูกค้าที่ทักแชทหรือเพิ่งแอดเพื่อนจะได้รับลิงก์นี้อัตโนมัติ

## ใช้งานประจำวัน
- บาริสต้าเปิด `https://<โดเมน>/admin` บนแท็บเล็ต ใส่รหัสผ่าน หน้าจอดึงออเดอร์ใหม่ทุก 5 วินาทีและมีเสียงเตือน
- กด "พร้อมรับ" → ลูกค้าได้ข้อความ LINE ทันที, กด "ยกเลิก" ต้องกดยืนยันอีกครั้งและลูกค้าจะได้รับแจ้ง
- ปุ่ม "มีขาย / หมด" ด้านล่างใช้ปิดเมนูที่หมดวันนี้
- แก้ราคา ชื่อ หรือเพิ่มเมนู: Supabase > Table Editor > `menu_items`
- แก้เวลาเปิดร้าน ช่วงเวลารับ จำนวนแก้วต่อรอบ: `lib/config.ts` แล้ว push ใหม่

## รันในเครื่อง
```
copy .env.example .env.local   # ใส่ค่า Supabase และ ADMIN_* อย่างน้อย
npm install
npm run dev
```
ถ้าเว้น `NEXT_PUBLIC_LIFF_ID` ว่าง จะเข้าโหมดทดสอบ ไม่ต้องล็อกอิน LINE และข้อความ LINE จะแสดงใน console แทนการส่งจริง

## ข้อควรรู้
- ข้อความแจ้งเตือน (push) นับโควตาข้อความรายเดือนของแพ็กเกจ LINE OA ตรวจโควตาได้ใน OA Manager ส่วนข้อความตอบกลับ (reply) ไม่นับ
- ลูกค้าต้องเป็นเพื่อนกับ OA จึงจะได้ข้อความ "พร้อมรับ" (ตั้ง Add friend option เป็น Aggressive ไว้แล้วในขั้นที่ 3)
- Supabase แพ็กเกจฟรีจะหยุด project ชั่วคราวถ้าไม่มีการใช้งาน 7 วัน
