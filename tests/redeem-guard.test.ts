// เทสต์บั๊ก "แลกของรางวัลไม่จองแต้มและไม่เช็คของคงเหลือ"
//   รัน: npx tsx --test tests/redeem-guard.test.ts
// ไม่ต่อฐานข้อมูลจริง (เครื่องนี้ไม่มี DATABASE_URL และห้ามต่อของจริง) — ใช้ sql tag ปลอมใน tests/fake-sql.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  decideRedemption, createRedemptionRequest, readPendingSummary, resetSchemaCache,
  type SqlTag,
} from "../app/api/liff/redeem/logic";
import { makeDb, makeSql, type FakeDb } from "./fake-sql";

const user = (over: Partial<{ id: number; line_user_id: string; points: number }> = {}) =>
  ({ id: 1, line_user_id: "U_chang", points: 1000, first_name: "สมชาย", last_name: "ใจดี", phone: "0812345678", ...over });

function setup(seed: Parameters<typeof makeDb>[0]): { db: FakeDb; sql: SqlTag } {
  resetSchemaCache();
  const db = makeDb(seed);
  return { db, sql: makeSql(db) as unknown as SqlTag };
}

// ---------------------------------------------------------------- ด่านตัดสิน (ตรรกะล้วน)

test("แต้มพอ ของมี → แลกได้", () => {
  const d = decideRedemption({
    user: { id: 1, points: 1000 }, reward: { id: 9, name: "ถุงมือ", points_required: 800, stock: 5 },
    pendingPoints: 0, samePending: 0, rewardPending: 0,
  });
  assert.equal(d.ok, true);
  if (d.ok) assert.equal(d.availableAfter, 200);
});

test("แต้มพอดีเป๊ะ → แลกได้ (ไม่ปัดตก)", () => {
  const d = decideRedemption({
    user: { id: 1, points: 800 }, reward: { id: 9, name: "ถุงมือ", points_required: 800, stock: 1 },
    pendingPoints: 0, samePending: 0, rewardPending: 0,
  });
  assert.equal(d.ok, true);
});

test("แต้มที่ถูกจองในคำขอ pending ต้องถูกหักออกก่อน", () => {
  const d = decideRedemption({
    user: { id: 1, points: 1000 }, reward: { id: 9, name: "ตลับเมตร", points_required: 800, stock: 5 },
    pendingPoints: 800, samePending: 0, rewardPending: 0,
  });
  assert.equal(d.ok, false);
  if (!d.ok) {
    assert.equal(d.code, "NOT_ENOUGH_POINTS");
    assert.match(d.error, /ถูกจองไว้/);
    assert.match(d.error, /200/);   // บอกตัวเลขที่ใช้ได้จริง ไม่ใช่แค่ "แต้มไม่พอ"
  }
});

test("จองไว้แล้วเหลือพอดีเป๊ะ → ยังแลกได้", () => {
  const d = decideRedemption({
    user: { id: 1, points: 1000 }, reward: { id: 9, name: "ถุงมือ", points_required: 200, stock: 5 },
    pendingPoints: 800, samePending: 0, rewardPending: 0,
  });
  assert.equal(d.ok, true);
  if (d.ok) assert.equal(d.availableAfter, 0);
});

test("ของหมด (stock = 0) → แลกไม่ได้ ถึงแต้มจะเหลือเฟือ", () => {
  const d = decideRedemption({
    user: { id: 1, points: 99999 }, reward: { id: 9, name: "ตลับเมตร", points_required: 250, stock: 0 },
    pendingPoints: 0, samePending: 0, rewardPending: 0,
  });
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.code, "REWARD_OUT_OF_STOCK");
});

test("stock = NULL คือไม่จำกัดจำนวน → แลกได้ (เช่น ส่วนลดเงินสด)", () => {
  const d = decideRedemption({
    user: { id: 1, points: 500 }, reward: { id: 9, name: "ส่วนลด 100", points_required: 100, stock: null },
    pendingPoints: 0, samePending: 0, rewardPending: 99,
  });
  assert.equal(d.ok, true);
  if (d.ok) assert.equal(d.stockLeft, null);
});

test("ของเหลือ 1 ชิ้นแต่ถูกจองไปแล้ว 1 คำขอ → คนถัดไปแลกไม่ได้", () => {
  const d = decideRedemption({
    user: { id: 2, points: 5000 }, reward: { id: 9, name: "บัตรน้ำมัน", points_required: 1000, stock: 1 },
    pendingPoints: 0, samePending: 0, rewardPending: 1,
  });
  assert.equal(d.ok, false);
  if (!d.ok) {
    assert.equal(d.code, "REWARD_OUT_OF_STOCK");
    assert.match(d.error, /ถูกจองครบแล้ว/);
  }
});

test("ของเหลือ 2 ชิ้น จองไป 1 → ยังแลกได้อีก 1", () => {
  const d = decideRedemption({
    user: { id: 2, points: 5000 }, reward: { id: 9, name: "บัตรน้ำมัน", points_required: 1000, stock: 2 },
    pendingPoints: 0, samePending: 0, rewardPending: 1,
  });
  assert.equal(d.ok, true);
  if (d.ok) assert.equal(d.stockLeft, 0);
});

test("ขอรางวัลชิ้นเดิมซ้ำทั้งที่ใบเก่ายังค้าง → ไม่ให้ขอซ้ำ", () => {
  const d = decideRedemption({
    user: { id: 1, points: 5000 }, reward: { id: 9, name: "ถุงมือ", points_required: 300, stock: 10 },
    pendingPoints: 300, samePending: 1, rewardPending: 1,
  });
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.code, "DUPLICATE_REQUEST");
});

test("ไม่พบสมาชิก / ไม่พบของรางวัล", () => {
  const a = decideRedemption({ user: null, reward: { id: 9, name: "x", points_required: 1, stock: null }, pendingPoints: 0, samePending: 0, rewardPending: 0 });
  assert.equal(a.ok, false);
  if (!a.ok) assert.equal(a.code, "NOT_REGISTERED");
  const b = decideRedemption({ user: { id: 1, points: 10 }, reward: null, pendingPoints: 0, samePending: 0, rewardPending: 0 });
  assert.equal(b.ok, false);
  if (!b.ok) assert.equal(b.code, "REWARD_NOT_FOUND");
});

// ---------------------------------------------------------------- เส้นทางจริง (ผ่าน sql ปลอม)

test("เคสของบั๊ก: มี 1,000 แต้ม กดแลกของ 800 แต้ม 3 ชิ้นรวด → ผ่านใบเดียว", async () => {
  const { db, sql } = setup({
    users: [user({ points: 1000 })],
    rewards: [
      { id: 101, name: "ชุดประแจ", points_required: 800, stock: 10 },
      { id: 102, name: "สว่าน", points_required: 800, stock: 10 },
      { id: 103, name: "บันได", points_required: 800, stock: 10 },
    ],
  });

  const r1 = await createRedemptionRequest(sql, "U_chang", 101);
  const r2 = await createRedemptionRequest(sql, "U_chang", 102);
  const r3 = await createRedemptionRequest(sql, "U_chang", 103);

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, false);
  assert.equal(r3.ok, false);
  if (!r2.ok) assert.equal(r2.code, "NOT_ENOUGH_POINTS");
  assert.equal(db.requests.filter(r => r.status === "pending").length, 1);
  // แต้มยังไม่ถูกหักตอนขอ (หักตอนพนักงานยืนยัน) — การจองคิดจากแถว pending
  assert.equal(db.users[0].points, 1000);
});

test("ของเหลือ 1 ชิ้น สองคนกดแลก → ได้คนเดียว", async () => {
  const { db, sql } = setup({
    users: [user({ id: 1, line_user_id: "U_a", points: 5000 }), user({ id: 2, line_user_id: "U_b", points: 5000 })],
    rewards: [{ id: 105, name: "บัตรเติมน้ำมัน", points_required: 1000, stock: 1 }],
  });

  const a = await createRedemptionRequest(sql, "U_a", 105);
  const b = await createRedemptionRequest(sql, "U_b", 105);

  assert.equal(a.ok, true);
  assert.equal(b.ok, false);
  if (!b.ok) assert.equal(b.code, "REWARD_OUT_OF_STOCK");
  assert.equal(db.requests.filter(r => r.status === "pending").length, 1);
});

test("กดปุ่มรัว ๆ ของรางวัลชิ้นเดิม → ใบซ้ำไม่เกิด", async () => {
  const { db, sql } = setup({
    users: [user({ points: 5000 })],
    rewards: [{ id: 103, name: "ถุงมือ", points_required: 300, stock: 20 }],
  });
  const results = await Promise.all([
    createRedemptionRequest(sql, "U_chang", 103),
    createRedemptionRequest(sql, "U_chang", 103),
    createRedemptionRequest(sql, "U_chang", 103),
  ]);
  assert.equal(results.filter(r => r.ok).length, 1);
  assert.equal(db.requests.filter(r => r.status === "pending").length, 1);
});

test("ด่านชั้น 3: ใบที่ยิงพร้อมกันจนต่างคนต่างมองไม่เห็นกัน ต้องถอยเอง (ไม่ส่ง LINE)", async () => {
  // จำลองสถานการณ์ที่ Postgres จริงอาจเกิด: ตอน INSERT ยังไม่เห็นใบของอีกคน (snapshot คนละจังหวะ)
  // แล้วมีใบ id น้อยกว่าโผล่มาก่อนคิวรีตรวจซ้ำ → ใบนี้ "ลำดับเกินโควตา" ต้องลบตัวเองทิ้ง
  const { db, sql } = setup({
    users: [user({ points: 1000 })],
    rewards: [{ id: 101, name: "ชุดประแจ", points_required: 800, stock: 10 }],
    nextId: 5,
    hooks: {
      beforeQuery(text, _v, d) {
        if (/AS points_upto/.test(text) && !d.requests.some(r => r.id === 1)) {
          d.requests.unshift({ id: 1, user_id: 1, reward_id: 999, points_required: 800, status: "pending", confirmed_at: null });
        }
      },
    },
  });

  const r = await createRedemptionRequest(sql, "U_chang", 101);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "RACE_LOST");
  // ใบที่เพิ่งสร้างถูกลบทิ้งแล้ว เหลือแต่ใบที่มาก่อน
  assert.deepEqual(db.requests.map(x => x.id), [1]);
});

test("ด่านชั้น 3: ของชิ้นสุดท้ายถูกจองตัดหน้า → ถอยและบอกว่าของถูกจอง", async () => {
  const { db, sql } = setup({
    users: [user({ points: 9000 })],
    rewards: [{ id: 105, name: "บัตรเติมน้ำมัน", points_required: 1000, stock: 1 }],
    nextId: 5,
    hooks: {
      beforeQuery(text, _v, d) {
        if (/AS points_upto/.test(text) && !d.requests.some(r => r.id === 2)) {
          d.requests.unshift({ id: 2, user_id: 7, reward_id: 105, points_required: 1000, status: "pending", confirmed_at: null });
        }
      },
    },
  });
  const r = await createRedemptionRequest(sql, "U_chang", 105);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "REWARD_OUT_OF_STOCK");
  assert.deepEqual(db.requests.map(x => x.id), [2]);
});

test("ยกเลิกคำขอแล้ว แต้มที่จองไว้กลับมาใช้ได้ทันที", async () => {
  const { db, sql } = setup({
    users: [user({ points: 1000 })],
    rewards: [
      { id: 101, name: "ชุดประแจ", points_required: 800, stock: 10 },
      { id: 102, name: "สว่าน", points_required: 800, stock: 10 },
    ],
  });
  const a = await createRedemptionRequest(sql, "U_chang", 101);
  assert.equal(a.ok, true);
  const blocked = await createRedemptionRequest(sql, "U_chang", 102);
  assert.equal(blocked.ok, false);

  db.requests[0].status = "cancelled";   // พนักงานกดยกเลิกในหน้าแอดมิน
  const again = await createRedemptionRequest(sql, "U_chang", 102);
  assert.equal(again.ok, true);
});

test("คำขอที่ยืนยันไปแล้วไม่ถูกนับเป็นการจองซ้ำ (แต้มถูกหักไปแล้วตอนยืนยัน)", async () => {
  const { sql } = setup({
    users: [user({ points: 200 })],
    rewards: [{ id: 101, name: "ส่วนลด 100", points_required: 100, stock: null }],
    requests: [{ id: 1, user_id: 1, reward_id: 101, points_required: 100, status: "confirmed", confirmed_at: "x" }],
  });
  const r = await createRedemptionRequest(sql, "U_chang", 101);
  assert.equal(r.ok, true);
});

test("ของรางวัลที่ถูกปิด (active = FALSE) → แลกไม่ได้", async () => {
  const { sql } = setup({
    users: [user()],
    rewards: [{ id: 101, name: "เลิกแจกแล้ว", points_required: 100, stock: 5, active: false }],
  });
  const r = await createRedemptionRequest(sql, "U_chang", 101);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "REWARD_NOT_FOUND");
});

test("สรุปแต้มที่ใช้ได้ (ให้หน้าเว็บแสดง) หักคำขอที่ค้างออกแล้ว", async () => {
  const { sql } = setup({
    users: [user({ points: 1000 })],
    rewards: [{ id: 101, name: "ชุดประแจ", points_required: 800, stock: 10 }],
  });
  await createRedemptionRequest(sql, "U_chang", 101);
  const s = await readPendingSummary(sql, "U_chang");
  assert.ok(s);
  assert.equal(s.points, 1000);
  assert.equal(s.pending_points, 800);
  assert.equal(s.available_points, 200);
  assert.equal(s.pending.length, 1);
  assert.equal(s.pending[0].reward_name, "ชุดประแจ");
  assert.deepEqual(s.reserved_by_reward, { "101": 1 });   // ให้หน้าเว็บคิด "ของที่ยังแลกได้ = stock − ค่านี้"
});

test("ข้อมูลเก่าที่มีคำขอซ้ำค้างอยู่ (สร้างดัชนี unique ไม่ได้) ต้องไม่ทำให้แลกของพังทั้งร้าน", async () => {
  const { sql } = setup({
    users: [user({ points: 5000 })],
    rewards: [{ id: 101, name: "ชุดประแจ", points_required: 100, stock: 10 }, { id: 102, name: "สว่าน", points_required: 100, stock: 10 }],
    requests: [
      { id: 1, user_id: 1, reward_id: 101, points_required: 100, status: "pending", confirmed_at: null },
      { id: 2, user_id: 1, reward_id: 101, points_required: 100, status: "pending", confirmed_at: null },
    ],
    nextId: 3,
  });
  const r = await createRedemptionRequest(sql, "U_chang", 102);   // CREATE INDEX จะล้ม แต่ต้องไปต่อได้
  assert.equal(r.ok, true);
});
