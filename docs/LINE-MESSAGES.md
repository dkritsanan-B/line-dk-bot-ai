# บัญชีข้อความ LINE

สำรวจจาก endpoint `/v2/bot/message/*` ทั้งหมดในโปรเจกต์ ณ วันที่ 17 กันยายน 2569 ตารางนี้แยกข้อความลูกค้าออกจากข้อความกลุ่มพนักงาน และระบุตัวสร้างที่ใช้งานอยู่

## ข้อความสมาชิกแบบอัตโนมัติ

| ข้อความ | ส่งเมื่อ | ไฟล์ที่ส่ง | ตัวสร้าง / tone | ข้อมูลเสริมที่ส่งได้ |
|---|---|---|---|---|
| ได้แต้มจากบิล | มีตัวสร้างไว้สำหรับข้อมูลบิล แต่ระบบปัจจุบันไม่ push ทุกบิลเพื่อรักษาโควตา | `lib/line-ui.ts` | `pointsEarnedFlex` · info | ระดับ, แต้มสะสม และระดับถัดไป เพื่อแสดงแถบความคืบหน้า |
| เลื่อนระดับ | บิลจาก Hero เพิ่มแต้มจนข้ามระดับ และมี LINE user ID | `app/api/hero/points/route.ts` | `tierUpFlex` · celebrate | ไม่มี การ์ดแสดงสิทธิ์ตามชื่อระดับจากกติกาสมาชิก |
| ของขวัญวันเกิด | cron ให้แต้มวันเกิดแก่ Bronze ขึ้นไปสำเร็จ และมี LINE user ID; Welcome ไม่ได้แต้มวันเกิด | `app/api/cron/birthday/route.ts` | `birthdayGiftFlex` · celebrate | ไม่มี |
| แต้มใกล้หมดอายุ | cron พบก้อนแต้มในช่วงเตือนที่ยังไม่เคยแจ้ง | `app/api/cron/notify-expiry/route.ts` | `pointsExpiringFlex` · warn | แต้มคงเหลือทั้งหมด |
| แต้มหมดอายุแล้ว | cron ตัดแต้มที่ครบ 1 ปีสำเร็จ และมี LINE user ID | `app/api/cron/expire-points/route.ts` | `pointsExpiredFlex` · neutral | ไม่มี |
| จองของรางวัล | ระบบบันทึกคำขอและจองแต้ม/สต็อกสำเร็จ | `app/api/liff/redeem/route.ts` | `redemptionRequestedFlex` · info | ไม่มี |
| รับของรางวัล | พนักงานยืนยันคำขอสำเร็จ | `app/api/admin/redemptions/route.ts` | `redemptionConfirmedFlex` · info | ไม่มี |
| ยกเลิกคำขอ | พนักงานยกเลิกคำขอสำเร็จ | `app/api/admin/redemptions/route.ts` | `redemptionCancelledFlex` · neutral | เหตุผลการยกเลิก |
| ใกล้ลดระดับ | cron พบสมาชิกที่ใกล้ครบ 1 ปีนับจากการซื้อล่าสุดและยังไม่เคยแจ้ง | `app/api/cron/notify-expiry/route.ts` | `tierExpiryWarningFlex` · warn | ชื่อระดับ, วันครบกำหนด และวันที่ซื้อล่าสุด |

ตัวสร้างกลาง `memberNoticeFlex` รองรับ tone `celebrate`, `info`, `warn`, `neutral`, metric หลัก, กล่องข้อมูลสูงสุด 3 แถว, note และปุ่มสูงสุด 2 ปุ่ม ข้อมูลที่เพิ่มใหม่เป็น optional ทั้งหมด จุดเรียกเดิมจึงใช้พารามิเตอร์ชุดเดิมได้ หากไม่มีข้อมูลเสริม การ์ดจะตัดส่วนนั้นออกหรือใช้คำอธิบายทั่วไปโดยไม่สร้างวันที่ขึ้นเอง

สีร่วมคือ success `#12805C`, warn `#B45309`, warn background `#FFF4E0`, panel `#F4F6FA` และข้อความรอง `#5A6679` ปุ่มหลักใช้สีน้ำเงินแบรนด์และ `height: md` ส่วนปุ่มรองใช้ `secondary` การ์ดแจ้งเตือนไม่มี hero แต่ตัวสร้างกลางรองรับ URL รูปแบบ optional สำหรับอนาคต

`pointsFlex` ใช้ `TIER_TEXT` เลือกตัวอักษรสีน้ำเงินบนหัว Gold/Silver และสีขาวบนระดับสีเข้ม (หัว Silver ใช้เงินอ่อน `#B0BEC5` เพื่อให้คอนทราสต์ผ่าน แถบความคืบหน้ายังใช้ `TIER_COLOR`) แถบระดับใช้แต้มสะสมตลอดอายุ (`totalEarned`) เทียบกับเกณฑ์ระดับถัดไป ส่วนตัวเลขใหญ่บนบัตรยังเป็นแต้มคงเหลือที่ใช้แลกได้

สิทธิ์บนการ์ดเลื่อนระดับอ้างอิงค่าจาก `lib/tierRules.ts`; แต้มวันเกิดอ้างอิงตารางใน `app/api/cron/birthday/route.ts` คือ Bronze 100, Silver 200, Gold 500, Platinum 800 และ Diamond 1,000 แต้ม ตัวเลขเหล่านี้คัดลอกไว้ใน `MEMBER_BENEFITS` ของ `lib/line-ui.ts` (import ไฟล์ต้นทางตรงไม่ได้เพราะต่อฐานข้อมูล) และ `scripts/validate-line-messages.mjs` อ่านไฟล์ต้นทางมาเทียบทุกครั้ง ถ้าแก้กติกาแล้วลืมแก้การ์ด ตัวตรวจจะล้ม ข้อความต้อนรับจึงระบุว่าเป็น “แต้มของขวัญวันเกิด” และส่วนลดสูงสุด 4% ตามระดับ

`app/api/cron/test/route.ts` เป็นเครื่องมือ super admin ที่จำลอง “แต้มใกล้หมดอายุ” และ “แต้มหมดอายุแล้ว” จึงเรียกตัวสร้าง Flex ชุดเดียวกับ cron จริง ไม่มีข้อความอีกสำเนาหนึ่ง

## ข้อความตอบกลับเมื่อลูกค้าคุยกับบอท

| ข้อความ | ส่งเมื่อ | ไฟล์ | ชนิดปัจจุบัน |
|---|---|---|---|
| ต้อนรับ / แนะนำสมาชิก | เพิ่มเพื่อน หรือพิมพ์ “สมาชิก/วิธีสะสมแต้ม/สะสมแต้ม” | `app/api/line-webhook/route.ts` → `welcomeFlex` | Flex |
| เปิดหน้าสมัคร/บัตร | พิมพ์ “สมัครสมาชิก” | `app/api/line-webhook/route.ts` | Buttons template |
| เช็คแต้มสมาชิก | พิมพ์คำเกี่ยวกับแต้มและพบสมาชิก | `app/api/line-webhook/route.ts` → `pointsFlex` | Flex |
| ชวนสมัครก่อนเช็คแต้ม | พิมพ์คำเกี่ยวกับแต้มแต่ยังไม่เป็นสมาชิก | `app/api/line-webhook/route.ts` | Buttons template |
| ติดต่อฝ่ายขาย | พิมพ์คำเกี่ยวกับติดต่อ โทร เบอร์ หรือฝ่ายขาย | `app/api/line-webhook/route.ts` → `contactFlex` | Flex carousel |
| แผนที่ร้าน | พิมพ์คำเกี่ยวกับแผนที่หรือที่อยู่ | `app/api/line-webhook/route.ts` | Location + Text |
| เวลาเปิดร้าน | พิมพ์คำเกี่ยวกับเวลาเปิดปิด | `app/api/line-webhook/route.ts` | Text |
| เกมตอบคำถาม | เริ่มเกม ตอบคำถาม ตอบถูก/ผิด เล่นครบ หรือโหลดคำถามไม่ได้ | `app/api/line-webhook/route.ts` | Text |
| FAQ | ข้อความอื่นที่ส่งให้ระบบตอบ FAQ | `app/api/line-webhook/route.ts` | Text |
| Group ID | กลุ่มพนักงานพิมพ์ `@groupid` | `app/api/line-webhook/route.ts` | Text |

ข้อความตอบกลับชุดนี้แนบ quick reply ที่ข้อความสุดท้ายเพื่อเปิดบัตร เช็คแต้ม ดูของรางวัล ติดต่อฝ่ายขาย เปิดแผนที่ หรือเล่นเกม โดยการ reply เป็นไปตามเหตุการณ์จากลูกค้าเดิม

## ข้อความกลุ่มพนักงาน

| ข้อความ | ส่งเมื่อ | ไฟล์ | ชนิดปัจจุบัน | การเปลี่ยนใน P7 |
|---|---|---|---|---|
| แจ้งคำขอแลกของใหม่ | ลูกค้าส่งคำขอแลกสำเร็จและตั้ง `LINE_STAFF_GROUP_ID` | `app/api/liff/redeem/route.ts` | Text | ไม่เปลี่ยน ตามขอบเขตงาน |
| ทดสอบกลุ่มพนักงาน | super admin เรียก `?test=1` | `app/api/admin/staff-group/route.ts` | Text | ไม่เปลี่ยน |
| ดูตัวอย่างหน้าตาบอท | super admin เรียก `?preview=1` | `app/api/admin/staff-group/route.ts` | Flex/Location 4 ข้อความ | ไม่เปลี่ยน |

## การตรวจรูปแบบ

รัน `node scripts/validate-line-messages.mjs` เพื่อตรวจตัวอย่างทั้งข้อมูลเดิมและข้อมูล optional ในเครื่อง ตัวตรวจยืนยันโครง Flex, ความยาว `altText`, action ของปุ่ม, จำนวนแถว/ปุ่ม, สีที่เลิกใช้, หัวข้อ และค่าคงที่เวลาร้าน โดยไม่อ่าน `.env.local`, ไม่เรียก LINE API และไม่ส่งข้อความจริง

ตรวจ TypeScript และชุดทดสอบโครงการด้วย `npx tsc --noEmit` และ `npm test` ตามลำดับ ตัวอย่างภาพสร้างด้วย `render.mjs` ทั้งแบบปกติและ `--extra`
