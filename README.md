# QueueH

ระบบจัดการคิวโรงพยาบาลผ่านเว็บแอปพลิเคชัน ผู้ป่วยสามารถจองคิวโรงพยาบาลที่ต้องการ ติดตามสถานะคิวแบบเรียลไทม์ และพบแพทย์ผ่านวิดีโอคอลได้โดยไม่ต้องติดตั้งโปรแกรมเพิ่มเติม

โปรเจ็คนี้สร้างขึ้นเป็นส่วนหนึ่งของงานมหาวิทยาลัย โดยใช้ Vercel สำหรับ deploy และ Supabase สำหรับฐานข้อมูลและการยืนยันตัวตน

---

## ระบบทำอะไรได้บ้าง

- ผู้ป่วยสมัครสมาชิก เลือกโรงพยาบาล แล้วจองคิวได้ทันที
- ระบบออกหมายเลขคิวให้อัตโนมัติ และอัปเดตสถานะแบบเรียลไทม์เมื่อคิวข้างหน้าถูกเรียก
- เมื่อถึงคิว ผู้ป่วยสามารถเข้าห้องปรึกษาแพทย์ออนไลน์ผ่านวิดีโอคอล (ใช้ PeerJS)
- หลังพบแพทย์ แพทย์สามารถออกใบสั่งยาให้เภสัชกรดำเนินการต่อได้
- ระบบ credibility score ป้องกันการจองทิ้ง — หากยกเลิกบ่อยเกินไปคะแนนจะลดลง
- แพทย์ เภสัชกร และผู้ดูแลระบบมีหน้าแดชบอร์ดของตัวเองแยกตามสิทธิ์การเข้าถึง

## หน้าและสิทธิ์การเข้าถึง

| Route | ผู้ที่เข้าถึงได้ |
|---|---|
| `/` | ทุกคน (รายชื่อโรงพยาบาล) |
| `/my-queue` | ผู้ป่วยที่ล็อกอินแล้ว |
| `/consult` | ผู้ป่วย, แพทย์ออนไลน์, ผู้ดูแลระบบ |
| `/opd` | แพทย์ OPD, ผู้ดูแลระบบ |
| `/delivery` | เภสัชกร, ผู้ดูแลระบบ |
| `/admin` | ผู้ดูแลระบบเท่านั้น |
| `/profile` | ผู้ใช้งานที่ล็อกอินแล้วทุกคน |

---

## เทคโนโลยีที่ใช้

- **React 19** ร่วมกับ React Router v7
- **Vite** เป็น build tool
- **Supabase** สำหรับฐานข้อมูล, authentication, และ real-time subscription
- **PeerJS** สำหรับวิดีโอคอล peer-to-peer
- **Lucide React** สำหรับไอคอน
- **xlsx** สำหรับ export ข้อมูลเป็นไฟล์ spreadsheet
- Deploy บน **Vercel**

---

## วิธีติดตั้งและรันโปรเจ็ค

### สิ่งที่ต้องมีก่อน

- Node.js เวอร์ชัน 18 ขึ้นไป
- โปรเจ็ค Supabase ที่รัน SQL migration แล้ว (ดูขั้นตอนด้านล่าง)

### ติดตั้ง

```bash
git clone https://github.com/MCRChannels/QueueH.git
cd QueueH
npm install
```

### ตั้งค่า Environment Variables

สร้างไฟล์ `.env` ที่ root ของโปรเจ็ค แล้วใส่ค่าดังนี้:

```
VITE_SUPABASE_URL=url_ของ_supabase_project
VITE_SUPABASE_ANON_KEY=anon_key_ของ_supabase
```

ค่าทั้งสองหาได้จากหน้า Supabase dashboard ที่ **Settings > API**

### ตั้งค่าฐานข้อมูล

ก่อนรันโปรแกรมครั้งแรก ต้องรัน SQL migration ที่มีอยู่ในโปรเจ็คก่อน:

1. เปิด Supabase dashboard แล้วไปที่ **SQL Editor**
2. คัดลอกเนื้อหาในไฟล์ `supabase_migration.sql` ทั้งหมดแล้ว execute

ไฟล์นี้จะสร้างตารางที่จำเป็น (`profiles`, `hospitals`, `queues`, `consultations`, `prescriptions`) รวมถึง row-level security policies และ column ที่ขาดหายไป

### รันในเครื่อง

```bash
npm run dev
```

เปิดเบราว์เซอร์แล้วไปที่ `http://localhost:5173`

### Build สำหรับ production

```bash
npm run build
```

---

## การ Deploy

โปรเจ็คนี้ตั้งค่าสำหรับ Vercel ไว้แล้ว ไฟล์ `vercel.json` ทำหน้าที่ redirect ทุก route กลับมาที่ `index.html` เพื่อให้ client-side routing ทำงานถูกต้องเมื่อผู้ใช้กด refresh หรือเข้า URL โดยตรง

หากต้องการ deploy instance ของตัวเอง ให้เชื่อมต่อ repository กับ Vercel แล้วเพิ่ม environment variable สองตัวข้างต้นในหน้า project settings ของ Vercel

---

## โครงสร้างโปรเจ็ค

```
src/
  pages/          # หน้าหลักแต่ละ route (Home, Login, Register, Consult, DoctorOPD, Delivery, AdminDashboard, MyQueue, Profile)
  components/     # Component ที่ใช้ร่วมกัน (Navbar, Footer, NotificationManager, ProtectedRoute)
  context/        # Language context สำหรับรองรับภาษาไทย/อังกฤษ
  lib/            # Supabase client และไฟล์ translation
  data/           # ข้อมูล static
```

---

## หมายเหตุ

- ไฟล์ `.env` ห้าม commit ขึ้น version control เด็ดขาด ถูก ignore ไว้ใน `.gitignore` แล้ว
- การอัปเดตคิวแบบเรียลไทม์ใช้ฟีเจอร์ Realtime ของ Supabase ผ่าน channel subscription
- ฟีเจอร์วิดีโอคอลต้องการให้ผู้ใช้ทั้งสองฝั่งอนุญาตสิทธิ์กล้องและไมโครโฟนในเบราว์เซอร์ก่อน
