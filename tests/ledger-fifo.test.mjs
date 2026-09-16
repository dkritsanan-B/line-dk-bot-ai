// บัญชีแต้มแบบเข้าก่อนออกก่อน — กันลูกค้าเสียแต้มซ้ำสอง (lib/points-ledger.ts)
import { test, eq, ok } from "./_harness.mjs";
import { viewLedger } from "../lib/points-ledger.ts";

const DAY = 86400000;
const NOW = Date.parse("2026-09-16T05:00:00Z");
const at = (d) => new Date(NOW + d * DAY).toISOString();
const earn = (pts, expDays, extra = {}) => ({ type: "earn", points_earned: pts, expires_at: at(expDays), ...extra });
const use = (type, pts, extra = {}) => ({ type, points_earned: pts, expires_at: null, ...extra });
const view = (rows, bal, win = 31) => viewLedger(rows, bal, NOW, win);

test("เคสที่ด่านค้านเจอ: แลกของไปแล้ว ก้อนเก่าครบปีต้องไม่ถูกหักซ้ำ", () => {
  // ได้ 50 (ครบกำหนดแล้ว) + 1,950 (อีก 300 วัน) · แลกของไป 50 · คงเหลือ 1,950
  const v = view([earn(50, -1), earn(1950, 300), use("redeem", 50)], 1950);
  eq(v.dueNow, 0, "50 แต้มนั้นถูกใช้ไปแล้ว ต้องไม่หักอีก");
});

test("เคสเดียวกันแต่ยังไม่ครบกำหนด: ต้องไม่ขึ้นเตือนว่า 50 แต้มจะหมด", () => {
  const v = view([earn(50, 21), earn(1950, 300), use("redeem", 50)], 1950);
  eq(v.soon, 0, "ก้อน 50 ถูกใช้ไปแล้ว ไม่มีอะไรจะหมดใน 31 วัน");
  eq(v.soonEarliest, null);
});

test("ไม่ได้ใช้แต้มเลย: ก้อนที่ครบกำหนดถูกตัดเต็มก้อน", () => {
  const v = view([earn(120, -2), earn(300, 200)], 420);
  eq(v.dueNow, 120);
  eq(v.soon, 0);
});

test("ใช้ไปบางส่วน: ตัดเฉพาะส่วนที่เหลือของก้อนเก่า", () => {
  // ได้ 100 (ครบแล้ว) + 100 (อีก 10 วัน) · แลก 30 → ก้อนแรกเหลือ 70
  const v = view([earn(100, -1), earn(100, 10), use("redeem", 30)], 170);
  eq(v.dueNow, 70);
  eq(v.soon, 100, "ก้อนที่สองยังไม่ถูกแตะ");
  eq(v.soonEarliest, at(10));
});

test("ใช้ไปเกินก้อนเก่า: ส่วนเกินไปกินก้อนถัดไป และเตือนแค่ที่เหลือจริง", () => {
  // 100 (ครบแล้ว) + 100 (อีก 10 วัน) + 500 (อีก 200 วัน) · แลก 150 → ก้อนแรกหมด ก้อนสองเหลือ 50
  const v = view([earn(100, -1), earn(100, 10), earn(500, 200), use("redeem", 150)], 550);
  eq(v.dueNow, 0);
  eq(v.soon, 50);
  eq(v.soonEarliest, at(10));
});

test("รันซ้ำไม่หักเพิ่ม: หลังตัดแล้วบันทึก expire รอบถัดไปต้องได้ 0", () => {
  const rows = [earn(120, -2), earn(300, 200)];
  const first = view(rows, 420);
  eq(first.dueNow, 120);
  const second = view([...rows, use("expire", first.dueNow)], 420 - first.dueNow);
  eq(second.dueNow, 0, "รันซ้ำต้องไม่หักอีก");
});

test("ถอนบิล (adjust) นับเป็นการใช้แต้ม ก้อนของบิลที่ถอนไปแล้วต้องไม่ถูกหักซ้ำตอนครบปี", () => {
  // บิล 200 แต้มถูกถอนแล้ว (users.points ลดไปแล้ว 200) แต่แถว earn ของบิลนั้นยังอยู่ในตาราง
  const v = view([earn(200, -1), earn(80, 100), use("adjust", 200)], 80);
  eq(v.dueNow, 0, "ถอนไปแล้ว ไม่ต้องหักอีก");
});

test("แถวที่แอดมินเคลียร์แล้ว ไม่นับทั้งฝั่งได้และฝั่งใช้", () => {
  const v = view([
    earn(999, -5, { cleared: true }), use("redeem", 500, { cleared: true }),
    earn(40, -1),
  ], 40);
  eq(v.dueNow, 40, "นับแค่ก้อนหลังเคลียร์");
});

test("ประวัติไม่ครบ (แต้มหายไปโดยไม่มีบันทึก): ถือว่าแต้มที่เหลืออยู่ในก้อนใหม่สุด → ไม่ตัดก้อนเก่า", () => {
  // ได้ 500 (ครบแล้ว) + 500 (อีก 5 วัน) แต่คงเหลือจริงแค่ 300 และไม่มีแถวบอกว่าหายไปไหน (ข้อมูลเก่า/ปรับมือ)
  const v = view([earn(500, -1), earn(500, 5)], 300);
  eq(v.dueNow, 0, "เข้าข้างลูกค้า: ไม่ตัดตอนนี้");
  eq(v.soon, 300, "แต่เตือนว่า 300 จะหมดใน 5 วัน");
  eq(v.soonEarliest, at(5));
});

test("สถานการณ์จริงแบบโหมดรีวิว Gold: บัตร 2,300 แต่ประวัติ earn รวมแค่ 1,001 → ก้อนที่จะหมดยังเตือนครบ", () => {
  const v = view([earn(185, 362), use("redeem", 300), earn(320, 341), earn(96, 325), use("expire", 160), earn(400, 21)], 2300);
  eq(v.soon, 400);
  eq(v.dueNow, 0);
});

test("ก้อนที่ประมวลผลไปแล้ว (expired=TRUE) ไม่นับซ้ำ", () => {
  const v = view([earn(120, -30, { expired: true }), earn(50, -1)], 50);
  eq(v.dueNow, 50);
});

test("ก้อนไม่มีวันหมดอายุ ไม่ถูกตัด และไม่ทำให้ตัวเลขเพี้ยน", () => {
  const v = view([{ type: "earn", points_earned: 1000, expires_at: null }, earn(50, -1)], 1050);
  eq(v.dueNow, 50);
});

test("ก้อนนอกช่วงเตือนไม่ถูกนับเป็นใกล้หมด", () => {
  const v = view([earn(100, 45)], 100);
  eq(v.soon, 0);
  eq(v.soonEarliest, null);
});

test("ข้อมูลเพี้ยนไม่ทำให้พัง (ค่าติดลบ ข้อความ วันที่เสีย ชนิดแปลก)", () => {
  const v = view([
    { type: "earn", points_earned: "abc", expires_at: at(-1) },
    { type: "earn", points_earned: -50, expires_at: at(-1) },
    { type: "earn", points_earned: 30, expires_at: "ไม่ใช่วันที่" },
    { type: "bonus_unknown", points_earned: 999, expires_at: at(-1) },
    earn("25", -1),
  ], 100);
  eq(v.dueNow, 25);
  ok(Number.isFinite(v.soon));
});

test("แต้มคงเหลือ 0 → ไม่มีอะไรให้ตัดหรือเตือน", () => {
  const v = view([earn(100, -1), earn(100, 5)], 0);
  eq(v.dueNow, 0);
  eq(v.soon, 0);
});
