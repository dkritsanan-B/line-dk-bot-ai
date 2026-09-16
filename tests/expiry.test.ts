// เทสต์กติกา "แต้มใกล้หมดอายุ" — ไม่ต่อฐานข้อมูลจริงแม้แต่แถวเดียว (ปลอม sql tag ด้วย tests/helpers.ts)
//
// รัน:  npx tsx tests/expiry.test.ts        (หรือ node --import tsx tests/expiry.test.ts)
//
// ครอบคลุม 3 ชั้น
//   1) ตรรกะบริสุทธิ์ summarizeExpiring() — กรณีปกติ + กรณีขอบทุกแบบ
//   2) คิวรีจริงที่ยิงลงฐานข้อมูล — ตรวจข้อความ SQL + พารามิเตอร์ + การกดเพดานด้วยแต้มคงเหลือ
//   3) กันถอยหลัง — ห้ามมีที่ไหนคำนวณแต้มใกล้หมดอายุเองอีก และโหมดรีวิวต้องใช้กติกาเดียวกัน

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  EXPIRY_NOTICE_DAYS,
  summarizeExpiring,
  capExpiring,
  getExpiringSummary,
  listExpiryNotices,
  markExpiryNotified,
  type ExpiryLot,
} from "../lib/points";
import { REVIEW_SCENARIOS } from "../lib/review-mode";
import { makeSql, type Rows } from "./helpers";

const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 16, 3, 0, 0); // เวลาคงที่ ไม่ให้เทสต์แกว่งตามนาฬิกาเครื่อง
const at = (days: number) => new Date(NOW + days * DAY).toISOString();
const lot = (points: number, days: number, over: Partial<ExpiryLot> = {}): ExpiryLot => ({
  points_earned: points, expires_at: at(days), type: "earn", expired: false, cleared: false, ...over,
});

/** sql tag ปลอม — ใช้ตัวเดียวกับเทสต์ไฟล์อื่น (tests/helpers.ts) ไม่ต่อฐานข้อมูลจริง · ค่าที่ผูกเข้ามาแทนด้วย ? */
const fakeSql = (rows: Rows = []) => makeSql(() => rows);

// ── 1) ตรรกะบริสุทธิ์ ────────────────────────────────────────────────────────

test("เคสบั๊กจริง: มี 2,000 แต้ม แต่ก้อนที่จะหมดใน 21 วันมีแค่ 50 → ต้องได้ 50 ไม่ใช่ 2,000", () => {
  const r = summarizeExpiring([lot(50, 21), lot(1950, 300)], 2000, NOW);
  assert.equal(r.expiring_points, 50);
  assert.equal(r.earliest_expiry, at(21));
});

test("ไม่มีก้อนไหนหมดในช่วงเตือน → ไม่ต้องขึ้นกล่องเตือนเลย", () => {
  const r = summarizeExpiring([lot(120, 356), lot(1950, 363)], 2070, NOW);
  assert.deepEqual(r, { earliest_expiry: null, expiring_points: 0 });
});

test("หลายก้อนในช่วงเตือน → บวกกัน และวันที่ต้องเป็นก้อนที่หมดก่อน", () => {
  const r = summarizeExpiring([lot(30, 25), lot(70, 5), lot(10, 31)], 5000, NOW);
  assert.equal(r.expiring_points, 110);
  assert.equal(r.earliest_expiry, at(5));
});

test("ขอบช่วง: ครบ 31 วันพอดีต้องนับ · เกิน 31 วันแม้เสี้ยววินาทีต้องไม่นับ", () => {
  assert.equal(summarizeExpiring([lot(10, EXPIRY_NOTICE_DAYS)], 999, NOW).expiring_points, 10);
  const justOver: ExpiryLot = { points_earned: 10, expires_at: new Date(NOW + EXPIRY_NOTICE_DAYS * DAY + 1).toISOString() };
  assert.equal(summarizeExpiring([justOver], 999, NOW).expiring_points, 0);
});

test("ก้อนที่เลยวันหมดอายุแล้วแต่ cron ยังไม่ได้ตัด (expired=FALSE) ต้องไม่ถูกนับ — ไม่งั้นบัตรขึ้น 'อีก -3 วัน'", () => {
  const r = summarizeExpiring([lot(500, -3), lot(50, 21)], 2000, NOW);
  assert.equal(r.expiring_points, 50);
  assert.equal(r.earliest_expiry, at(21));
});

test("ก้อนที่หมดอายุพอดีวินาทีนี้ ไม่นับ (ถือว่าหมดแล้ว)", () => {
  assert.equal(summarizeExpiring([{ points_earned: 10, expires_at: new Date(NOW).toISOString() }], 999, NOW).expiring_points, 0);
});

test("ข้ามก้อนที่ถูกตัดแล้ว / ถูกแอดมินเคลียร์ / ไม่มีวันหมดอายุ / ไม่ใช่ประเภท earn", () => {
  const lots: ExpiryLot[] = [
    lot(100, 10, { expired: true }),
    lot(100, 10, { cleared: true }),
    { points_earned: 100, expires_at: null },
    { points_earned: 300, expires_at: at(10), type: "redeem" },
    { points_earned: 160, expires_at: at(10), type: "expire" },
    lot(7, 10),
  ];
  const r = summarizeExpiring(lots, 5000, NOW);
  assert.equal(r.expiring_points, 7);
});

test("วันหมดอายุเป็นค่าขยะ → ข้ามทิ้ง ไม่พังทั้งบัตร", () => {
  const r = summarizeExpiring([{ points_earned: 99, expires_at: "ไม่ใช่วันที่" }, lot(5, 3)], 500, NOW);
  assert.equal(r.expiring_points, 5);
});

test("เพดาน: ก้อนรวม 500 แต่ลูกค้าเหลือจริง 300 (แลกของไปแล้ว) → บอกได้มากสุด 300", () => {
  const r = summarizeExpiring([lot(500, 10)], 300, NOW);
  assert.equal(r.expiring_points, 300);
  assert.equal(r.earliest_expiry, at(10));
});

test("แต้มคงเหลือ 0 → ไม่มีอะไรจะหมด ไม่ต้องเตือน", () => {
  assert.deepEqual(summarizeExpiring([lot(500, 10)], 0, NOW), { earliest_expiry: null, expiring_points: 0 });
});

test("ไม่มีรายการเลย / ส่ง undefined มา → ไม่ล้ม", () => {
  assert.deepEqual(summarizeExpiring([], 100, NOW), { earliest_expiry: null, expiring_points: 0 });
  assert.deepEqual(summarizeExpiring(undefined as unknown as ExpiryLot[], 100, NOW), { earliest_expiry: null, expiring_points: 0 });
});

test("capExpiring: ค่าติดลบ/NaN ไม่หลุดออกไปเป็นตัวเลขประหลาดบนบัตร", () => {
  assert.deepEqual(capExpiring(-5, at(3), 100), { earliest_expiry: null, expiring_points: 0 });
  assert.deepEqual(capExpiring(NaN, at(3), 100), { earliest_expiry: null, expiring_points: 0 });
  assert.equal(capExpiring(40, new Date(NOW + 3 * DAY), 100).earliest_expiry, at(3));
});

// ── 2) คิวรีจริง ─────────────────────────────────────────────────────────────

test("getExpiringSummary: คิวรีต้องกรองช่วงเตือน + สถานะครบทุกเงื่อนไข", async () => {
  const tag = fakeSql([{ earliest_expiry: at(21), raw_points: 50 }]);
  const r = await getExpiringSummary(42, 2000, tag);

  assert.deepEqual(r, { earliest_expiry: at(21), expiring_points: 50 });
  assert.equal(tag.calls.length, 1);
  const q = tag.calls[0].query;
  assert.match(q, /expires_at > NOW\(\)/);                                      // ยังไม่ถึงวันหมด
  assert.match(q, /expires_at <= NOW\(\) \+ \( \? ::int \* INTERVAL '1 day'\)/);  // อยู่ในช่วงเตือน
  assert.match(q, /type = 'earn'/);
  assert.match(q, /expired = FALSE/);
  assert.match(q, /cleared = FALSE/);
  assert.match(q, /MIN\(expires_at\) AS earliest_expiry/);
  assert.deepEqual(tag.calls[0].values, [42, EXPIRY_NOTICE_DAYS]);
});

test("getExpiringSummary: กดเพดานด้วยแต้มคงเหลือเสมอ (ก้อนเก่าไม่ถูกตัดตอนแลกของ)", async () => {
  const tag = fakeSql([{ earliest_expiry: at(9), raw_points: 800 }]);
  assert.equal((await getExpiringSummary(1, 250, tag)).expiring_points, 250);
});

test("getExpiringSummary: ไม่มีก้อนในช่วง (SUM=0) → ไม่ขึ้นกล่องเตือน", async () => {
  const tag = fakeSql([{ earliest_expiry: null, raw_points: 0 }]);
  assert.deepEqual(await getExpiringSummary(1, 2000, tag), { earliest_expiry: null, expiring_points: 0 });
});

test("getExpiringSummary: ฐานข้อมูลคืนแถวว่าง → ไม่ล้ม", async () => {
  const tag = fakeSql([]);
  assert.deepEqual(await getExpiringSummary(1, 2000, tag), { earliest_expiry: null, expiring_points: 0 });
});

test("getExpiringSummary: raw_points มาเป็นสตริง (driver บางตัวคืน numeric เป็น string) ก็ยังถูก", async () => {
  const tag = fakeSql([{ earliest_expiry: at(4), raw_points: "75" }]);
  assert.equal((await getExpiringSummary(1, 2000, tag)).expiring_points, 75);
});

test("listExpiryNotices: ใช้ช่วงเดียวกับบัตรสมาชิก + ข้ามคนที่แต้มเหลือ 0", async () => {
  const tag = fakeSql([
    { user_id: 1, line_user_id: "U1", first_name: "สมชาย", points: 2000, earliest_expiry: at(21), raw_points: 50 },
    { user_id: 2, line_user_id: "U2", first_name: "มานพ", points: 0, earliest_expiry: at(10), raw_points: 400 },
    { user_id: 3, line_user_id: "U3", first_name: "ประเสริฐ", points: 120, earliest_expiry: at(2), raw_points: 900 },
  ]);
  const rows = await listExpiryNotices(tag);

  const q = tag.calls[0].query;
  assert.match(q, /t\.expires_at > NOW\(\)/);
  assert.match(q, /t\.expires_at <= NOW\(\) \+ \( \? ::int \* INTERVAL '1 day'\)/);
  assert.match(q, /t\.cleared = FALSE/);
  assert.match(q, /t\.notified_1m = FALSE/);
  assert.deepEqual(tag.calls[0].values, [EXPIRY_NOTICE_DAYS]);

  assert.equal(rows.length, 2);                        // คนที่แต้มเหลือ 0 ไม่ถูกทัก
  assert.deepEqual(rows[0], { user_id: 1, line_user_id: "U1", first_name: "สมชาย", earliest_expiry: at(21), expiring_points: 50 });
  assert.equal(rows[1].expiring_points, 120);          // กดเพดานด้วยแต้มคงเหลือ
});

test("markExpiryNotified: มาร์กด้วยช่วงเดียวกับตอนเลือก และไม่แตะก้อนที่ถูกเคลียร์", async () => {
  const tag = fakeSql([]);
  await markExpiryNotified(7, tag);
  const q = tag.calls[0].query;
  assert.match(q, /SET notified_1m = TRUE/);
  assert.match(q, /cleared = FALSE/);
  assert.match(q, /expires_at <= NOW\(\) \+ \( \? ::int \* INTERVAL '1 day'\)/);
  assert.deepEqual(tag.calls[0].values, [7, EXPIRY_NOTICE_DAYS]);
});

// ── 3) กันถอยหลัง ───────────────────────────────────────────────────────────

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

test("ห้ามมีที่ไหนเขียนคิวรีนับแต้มใกล้หมดอายุเองอีก (ต้นเหตุเดิมคือสองที่นับคนละแบบ)", () => {
  for (const f of ["app/api/member/route.ts", "app/api/cron/notify-expiry/route.ts"]) {
    const src = read(f);
    assert.ok(!/SUM\(\s*t?\.?points_earned/.test(src), f + " ยังมีคิวรีรวมแต้มของตัวเองอยู่");
    assert.match(src, /from "@\/lib\/points"/);
  }
});

test("โหมดรีวิวต้องคิดแต้มใกล้หมดอายุด้วยกติกาเดียวกับลูกค้าจริง", () => {
  for (const [key, sc] of Object.entries(REVIEW_SCENARIOS)) {
    const expected = summarizeExpiring(sc.transactions, sc.member?.points ?? 0);
    assert.deepEqual(sc.expiry, expected, "สถานการณ์ " + key + " ตัวเลขไม่ตรงกับกติกา");
    if (sc.expiry.earliest_expiry) {
      const daysLeft = (new Date(sc.expiry.earliest_expiry).getTime() - Date.now()) / DAY;
      assert.ok(daysLeft > 0 && daysLeft <= EXPIRY_NOTICE_DAYS, "สถานการณ์ " + key + " วันหมดอายุหลุดช่วงเตือน");
      assert.ok(sc.expiry.expiring_points <= (sc.member?.points ?? 0), "สถานการณ์ " + key + " แต้มใกล้หมดมากกว่าแต้มที่มี");
    }
  }
});

test("โหมดรีวิว: สถานการณ์ที่ต้องเห็นกล่องเตือน และที่ต้องไม่เห็น", () => {
  assert.equal(REVIEW_SCENARIOS.gold2300.expiry.expiring_points, 400);       // ก้อน 400 หมดใน 21 วัน
  assert.equal(REVIEW_SCENARIOS.expiringSmall.expiry.expiring_points, 50);   // มี 2,000 แต่ใกล้หมดจริงแค่ 50
  assert.equal(REVIEW_SCENARIOS.expiringSmall.member?.points, 2000);
  assert.equal(REVIEW_SCENARIOS.bronze120.expiry.expiring_points, 0);        // แต้มเพิ่งได้ ยังไม่ใกล้หมด
  assert.equal(REVIEW_SCENARIOS.diamond.expiry.expiring_points, 0);
  assert.equal(REVIEW_SCENARIOS.new.expiry.expiring_points, 0);
});
