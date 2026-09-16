// เทสต์กติกา "แต้มใกล้หมดอายุ" — ไม่ต่อฐานข้อมูลร้านแม้แต่แถวเดียว
//
// รัน:  npx tsx tests/expiry.test.ts        (หรือ node --import tsx tests/expiry.test.ts)
//
// ครอบคลุม 3 ชั้น
//   1) ตรรกะบริสุทธิ์ summarizeExpiring() — กรณีปกติ + กรณีขอบทุกแบบ
//   2) คิวรีจริงกับ Postgres ในเครื่อง (PGlite) — พิสูจน์ผลลัพธ์ ไม่ใช่แค่หน้าตาของ SQL
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
import { freshDb } from "./pg.mjs";
import type { Db } from "../lib/db";

const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 16, 3, 0, 0); // เวลาคงที่ ไม่ให้เทสต์แกว่งตามนาฬิกาเครื่อง
const at = (days: number) => new Date(NOW + days * DAY).toISOString();
const lot = (points: number, days: number, over: Partial<ExpiryLot> = {}): ExpiryLot => ({
  points_earned: points, expires_at: at(days), type: "earn", expired: false, cleared: false, ...over,
});


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

// ── 2) กับ Postgres จริง (PGlite ในเครื่อง ไม่ใช่ฐานข้อมูลร้าน) ─────────────────
// เดิมส่วนนี้ตรวจแค่ "ข้อความ SQL หน้าตาถูก" ด้วย sql ปลอม ซึ่งจับบั๊กหักซ้ำไม่ได้ · ตอนนี้รันคิวรีจริงแล้วดูผล

async function seedUser(db: Db, points: number, rows: { type: string; pts: number; exp?: number; notified?: boolean; cleared?: boolean }[], line: string | null = "U1") {
  const [u] = await db.query(`INSERT INTO users (line_user_id, first_name, points) VALUES ($1, 'สมชาย', $2) RETURNING id`, [line, points]);
  for (const r of rows) {
    await db.query(
      `INSERT INTO transactions (user_id, points_earned, type, expires_at, notified_1m, cleared) VALUES ($1,$2,$3,$4,$5,$6)`,
      [u.id, r.pts, r.type, r.exp === undefined ? null : at(r.exp), r.notified ?? false, r.cleared ?? false],
    );
  }
  return Number(u.id);
}

test("[pg] getExpiringSummary: นับเฉพาะก้อนในช่วงเตือน", async () => {
  const { pg, db } = await freshDb();
  const id = await seedUser(db, 2000, [{ type: "earn", pts: 50, exp: 21 }, { type: "earn", pts: 1950, exp: 300 }]);
  assert.deepEqual(await getExpiringSummary(id, 2000, db, NOW), { earliest_expiry: at(21), expiring_points: 50 });
  await pg.close();
});

test("[pg] getExpiringSummary: แลกของไปแล้ว ก้อนเก่าที่ถูกใช้ต้องไม่ขึ้นเตือน (FIFO)", async () => {
  const { pg, db } = await freshDb();
  const id = await seedUser(db, 1950, [{ type: "earn", pts: 50, exp: 21 }, { type: "earn", pts: 1950, exp: 300 }, { type: "redeem", pts: 50 }]);
  assert.deepEqual(await getExpiringSummary(id, 1950, db, NOW), { earliest_expiry: null, expiring_points: 0 });
  await pg.close();
});

test("[pg] getExpiringSummary: กดเพดานด้วยแต้มคงเหลือ", async () => {
  const { pg, db } = await freshDb();
  const id = await seedUser(db, 250, [{ type: "earn", pts: 800, exp: 9 }]);
  assert.equal((await getExpiringSummary(id, 250, db, NOW)).expiring_points, 250);
  await pg.close();
});

test("[pg] getExpiringSummary: ไม่มีธุรกรรม → ไม่ขึ้นกล่องเตือน", async () => {
  const { pg, db } = await freshDb();
  const id = await seedUser(db, 0, []);
  assert.deepEqual(await getExpiringSummary(id, 0, db, NOW), { earliest_expiry: null, expiring_points: 0 });
  await pg.close();
});

test("[pg] listExpiryNotices: ทักเฉพาะคนที่มีแต้มจะหมดจริง ข้ามคนที่ใช้ไปแล้ว/แต้ม 0/เตือนแล้ว/ไม่มี LINE", async () => {
  const { pg, db } = await freshDb();
  const real = await seedUser(db, 2000, [{ type: "earn", pts: 50, exp: 21 }, { type: "earn", pts: 1950, exp: 300 }], "U_real");
  await seedUser(db, 1950, [{ type: "earn", pts: 50, exp: 21 }, { type: "earn", pts: 1950, exp: 300 }, { type: "redeem", pts: 50 }], "U_used");
  await seedUser(db, 0, [{ type: "earn", pts: 400, exp: 10 }], "U_zero");
  await seedUser(db, 500, [{ type: "earn", pts: 100, exp: 5, notified: true }], "U_done");
  await seedUser(db, 500, [{ type: "earn", pts: 100, exp: 5 }], null);
  const capped = await seedUser(db, 120, [{ type: "earn", pts: 900, exp: 2 }], "U_cap");

  const rows = await listExpiryNotices(db, NOW);
  assert.deepEqual(rows.map(r => r.line_user_id), ["U_real", "U_cap"]);
  assert.deepEqual(rows[0], { user_id: real, line_user_id: "U_real", first_name: "สมชาย", earliest_expiry: at(21), expiring_points: 50 });
  assert.equal(rows.find(r => r.user_id === capped)!.expiring_points, 120, "กดเพดานด้วยแต้มคงเหลือ");
  await pg.close();
});

test("[pg] markExpiryNotified: มาร์กเฉพาะก้อนในช่วงเดียวกับตอนเลือก (ทั้งขอบล่างและขอบบน)", async () => {
  const { pg, db } = await freshDb();
  const id = await seedUser(db, 999, [
    { type: "earn", pts: 1, exp: -2 },          // เลยวันหมดอายุแล้ว (ยังไม่ถูกตัด) — ไม่ใช่ก้อนที่เตือน
    { type: "earn", pts: 2, exp: 10 },          // ในช่วง
    { type: "earn", pts: 3, exp: 40 },          // นอกช่วง
    { type: "earn", pts: 4, exp: 10, cleared: true },
  ]);
  await markExpiryNotified(id, db, NOW);
  const got = await db.query(`SELECT points_earned, notified_1m FROM transactions WHERE user_id = $1 ORDER BY points_earned`, [id]);
  assert.deepEqual(got.map(r => [r.points_earned, r.notified_1m]), [[1, false], [2, true], [3, false], [4, false]]);
  await pg.close();
});

// ── 3) กันถอยหลัง ───────────────────────────────────────────────────────────

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

test("ห้ามมีที่ไหนเขียนคิวรีนับแต้มใกล้หมดอายุเองอีก (ต้นเหตุเดิมคือสองที่นับคนละแบบ)", () => {
  for (const f of ["app/api/member/route.ts", "app/api/cron/notify-expiry/route.ts", "app/api/cron/expire-points/route.ts"]) {
    const src = read(f);
    assert.ok(!/SUM\(\s*t?\.?points_earned/.test(src), f + " ยังมีคิวรีรวมแต้มของตัวเองอยู่");
    assert.match(src, /from "@\/lib\/points(-ledger)?"/);
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
