# บัญชีข้อความ LINE

สำรวจจาก endpoint `/v2/bot/message/*` ทั้งหมดในโปรเจกต์ ณ วันที่ 16 กันยายน 2569 ตารางนี้แยกข้อความลูกค้าออกจากข้อความกลุ่มพนักงาน และระบุชนิดหลังงาน P7

## ข้อความสมาชิกแบบอัตโนมัติ

| ข้อความ | ส่งเมื่อ | ไฟล์ที่ส่ง | ก่อน P7 | หลัง P7 / ตัวสร้าง |
|---|---|---|---|---|
| ได้แต้มจากบิล | มีตัวสร้างไว้สำหรับข้อมูลบิล แต่ระบบปัจจุบันไม่ push ทุกบิลเพื่อรักษาโควตา จึงไม่มีจุดส่งและไม่เพิ่มเงื่อนไขใหม่ | `lib/line-ui.ts` | ไม่มีตัวสร้างกลาง | Flex · `pointsEarnedFlex` |
| เลื่อนระดับ | บิลจาก Hero เพิ่มแต้มจนข้ามระดับ และมี LINE user ID | `app/api/hero/points/route.ts` | Text | Flex · `tierUpFlex` |
| ของขวัญวันเกิด | cron วันเกิดให้แต้มสมาชิกระดับที่มีสิทธิ์สำเร็จ และมี LINE user ID | `app/api/cron/birthday/route.ts` | Text | Flex · `birthdayGiftFlex` |
| แต้มใกล้หมดอายุ | cron พบก้อนแต้มในช่วงเตือนที่ยังไม่เคยแจ้ง | `app/api/cron/notify-expiry/route.ts` | Text | Flex · `pointsExpiringFlex` |
| แต้มหมดอายุแล้ว | cron ตัดแต้มที่ครบกำหนดจริงสำเร็จ และมี LINE user ID | `app/api/cron/expire-points/route.ts` | Text | Flex · `pointsExpiredFlex` |
| ส่งคำขอแลกของสำเร็จ | ระบบบันทึกคำขอและจองแต้ม/สต็อกสำเร็จ | `app/api/liff/redeem/route.ts` | Text | Flex · `redemptionRequestedFlex` |
| พนักงานยืนยันแลกของแล้ว | พนักงานยืนยันคำขอสำเร็จ | `app/api/admin/redemptions/route.ts` | Text | Flex · `redemptionConfirmedFlex` |
| ยกเลิกคำขอ | พนักงานยกเลิกคำขอสำเร็จ | `app/api/admin/redemptions/route.ts` | Text | Flex · `redemptionCancelledFlex` |
| ใกล้ลดระดับ | cron พบสมาชิกที่ไม่ซื้อ 11 เดือนและยังไม่เคยแจ้ง | `app/api/cron/notify-expiry/route.ts` | Text | Flex · `tierExpiryWarningFlex` |

Flex ทั้ง 9 แบบสร้างใน `lib/line-ui.ts` ใช้หัวการ์ดสีน้ำเงินเข้ม `#0B2A5B` ตัวเน้นสีเหลือง `#F5C518` มี `altText` ภาษาไทย และมีปุ่มไปบัตรสมาชิก (`SHOP.liffUrl`) หรือของรางวัล (`SHOP.rewardsUrl`) ตามงานที่เกี่ยวข้อง

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

`scripts/validate-line-messages.mjs` สร้างข้อมูลจำลองของ Flex สมาชิกทั้ง 9 แบบ แล้วส่งทีละแบบไปยัง `POST /v2/bot/message/validate/push` ด้วย token จาก `.env.local` endpoint นี้ตรวจ schema เท่านั้นและไม่ส่งข้อความถึงผู้ใช้ จึงไม่มี `to` ใน request body ตามรูปแบบของ validation API
