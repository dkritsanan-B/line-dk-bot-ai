# 🔀 HANDOFF — ทำโปรเจคนี้ต่อบนเครื่องอื่น

> ไฟล์นี้สรุปสถานะโปรเจค + วิธีตั้งเครื่องใหม่ + prompt สำหรับสั่ง AI ให้ทำต่อ
> อัปเดตล่าสุด: หลังจบเฟส 3 (Production AI)

---

## 📦 โปรเจคนี้คืออะไร

**LINE OA chatbot ของร้านดีเค นาโพธิ์ (DK Steel)** — Next.js 15 + TypeScript deploy บน Vercel
ในโปรเจคมี 2 ส่วนหลัก:
1. **แชทบอท/LIFF เดิม** — ตอบลูกค้าใน LINE, ระบบสะสมแต้ม, แจ้งเตือนแต้มหมดอายุ
2. **🏢 Agency OS** (`agency-os/`) — ทีมการตลาด AI 6 แผนก ทำโฆษณาให้ร้าน โดยดึงข้อมูลสินค้า/รูปสดจาก Supabase + Backblaze B2

---

## ✅ ทำเสร็จแล้ว (เฟส 1–3)

| เฟส | สิ่งที่ทำ | ไฟล์หลัก |
|-----|----------|----------|
| 1–2 | โครง Agency OS 6 แผนก + Brand Brief | `agency-os/` |
| — | **Live catalog**: Supabase (สินค้า) + B2 (รูป, bucket private + signed URL) | `lib/supabase.ts`, `lib/b2.ts` |
| — | API: `GET /api/catalog`, `POST /api/upload` | `app/api/catalog/`, `app/api/upload/` |
| — | หน้าแอดมินจัดการรูปสินค้า | `app/admin/catalog/page.tsx` |
| 3 | **Production AI**: สร้างรูปด้วย Gemini (`gemini-2.5-flash-image`) | `lib/gemini.ts`, `app/api/generate-image/` |
| — | รันแคมเปญ #01 จริงผ่าน 6 แผนก | `agency-os/work/campaign-01-jaothin-lek/` |

**สถานะข้อมูล:** สินค้า 16 ตัว · มีรูปแล้ว 9 ตัว (บางตัวเป็นรูป AI) · ราคายังไม่ลง · โปรโมชัน 0

---

## 🔴 ยังไม่ทำ (ทำต่อจากตรงนี้)

1. **เฟส 4 · Meta MCP** — เชื่อม Custom Connector ยิงโฆษณา Facebook จริง (ชิ้นใหญ่สุดที่เหลือ)
2. **เติมข้อมูลก่อนยิงแอด:**
   - `contact_info` ใน Supabase: LINE ID `@629jbwyj`, เบอร์โทร, เวลาทำการ (ตอนนี้ยังว่าง)
   - สร้าง/อัปรูปสินค้าที่เหลืออีก 7 ตัว (กดปุ่ม 🎨 AI ได้)
   - ลงราคาสินค้าโฟกัส (ถ้าจะโชว์ราคา)
3. **เฟส 6 · Analyze** — วิเคราะห์ผลแอด + ทำรายงาน (รอข้อมูลจริงจากเฟส 4)

---

## 💻 วิธีตั้งเครื่องใหม่

```bash
# 1. clone repo
git clone https://github.com/dkritsanan-B/line-dk-bot-ai.git
cd line-dk-bot-ai

# 2. ติดตั้ง dependencies
npm install

# 3. สร้างไฟล์ .env.local (ดูรายการคีย์ด้านล่าง)
#    ⭐ วิธีง่ายสุด: ก๊อป .env.local จากเครื่องเดิมมาวางเลย
#    (ไฟล์นี้ถูก gitignore ไม่ได้อยู่บน GitHub — ต้องเอามาเอง)

# 4. รัน
npm run dev
# เปิด http://localhost:3000  (หรือ 3001 ถ้าพอร์ตชน)
```

### 🔑 รายการ env ที่ต้องมีใน `.env.local`
```
# LINE
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
NEXT_PUBLIC_LIFF_ID=

# ฐานข้อมูลแต้ม (Neon)
DATABASE_URL=

# Google Sheet (FAQ แชทบอท)
SHEET_CSV_URL=

# Gemini — ⚠️ ต้องเป็น Tier 1 (เปิด billing) ถ้าจะสร้างรูป AI
GEMINI_API_KEY=

# Agency OS: Supabase (แคตตาล็อกสินค้า)
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

# Agency OS: Backblaze B2 (เก็บรูป)
B2_KEY_ID=
B2_APP_KEY=
B2_BUCKET=
B2_ENDPOINT=
B2_REGION=

# แอดมิน + cron
ADMIN_PASSWORD=
CRON_SECRET=
```

---

## 📍 หน้า/endpoint สำคัญ
- `/admin/catalog` — จัดการรูปสินค้า (อัปเอง / ปุ่ม 🎨 AI) · ใส่ ADMIN_PASSWORD
- `GET /api/catalog` — ข้อมูลสินค้า/โปร/ติดต่อ (JSON) ให้ Agency OS ดึงไปใช้
- `POST /api/generate-image` — สร้างรูปด้วย AI (header `x-admin-password`)
- `agency-os/README.md` — คู่มือระบบ 6 แผนก
- `agency-os/db/schema.sql` — โครงตาราง Supabase (ถ้าตั้ง DB ใหม่ ก๊อปไป run ใน Supabase SQL Editor)
