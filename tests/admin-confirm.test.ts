// เทสต์ฝั่งพนักงาน: ยืนยัน/ยกเลิกคำขอแลกของรางวัล ต้องสอดคล้องกับการ "จอง" ฝั่งลูกค้า
//   รัน: npx tsx --test tests/admin-confirm.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { confirmRedemption, cancelRedemption } from "../app/api/admin/redemptions/logic";
import type { SqlTag } from "../app/api/liff/redeem/logic";
import { makeDb, makeSql, type FakeDb } from "./fake-sql";

function setup(seed: Parameters<typeof makeDb>[0]): { db: FakeDb; sql: SqlTag } {
  const db = makeDb(seed);
  return { db, sql: makeSql(db) as unknown as SqlTag };
}

const baseSeed = () => ({
  users: [{ id: 1, line_user_id: "U_chang", points: 1000 }],
  rewards: [{ id: 105, name: "บัตรเติมน้ำมัน", points_required: 800, stock: 2 }],
  requests: [{ id: 11, user_id: 1, reward_id: 105, points_required: 800, status: "pending", confirmed_at: null }],
  nextId: 12,
});

test("ยืนยันปกติ → หักแต้ม ลดของ ปิดคำขอ และบันทึกประวัติ", async () => {
  const { db, sql } = setup(baseSeed());
  const r = await confirmRedemption(sql, 11);
  assert.equal(r.ok, true);
  if (r.ok && r.action === "confirmed") {
    assert.equal(r.pointsLeft, 200);
    assert.equal(r.stockLeft, 1);
  }
  assert.equal(db.users[0].points, 200);
  assert.equal(db.rewards[0].stock, 1);
  assert.equal(db.requests[0].status, "confirmed");
  assert.equal(db.transactions.length, 1);
  assert.equal(db.transactions[0].points_earned, 800);
  assert.match(db.transactions[0].note, /#REQ-11/);
});

test("กดยืนยันซ้ำ (สองหน้าจอ) → หักแต้มครั้งเดียว", async () => {
  const { db, sql } = setup(baseSeed());
  const a = await confirmRedemption(sql, 11);
  const b = await confirmRedemption(sql, 11);
  assert.equal(a.ok, true);
  assert.equal(b.ok, false);
  if (!b.ok) assert.equal(b.status, 404);
  assert.equal(db.users[0].points, 200);
  assert.equal(db.rewards[0].stock, 1);
  assert.equal(db.transactions.length, 1);
});

test("ยืนยันตอนของหมดจริง (stock = 0) → ไม่หักแต้ม และคำขอยังค้างไว้ให้แก้", async () => {
  const seed = baseSeed();
  seed.rewards[0].stock = 0;
  const { db, sql } = setup(seed);
  const r = await confirmRedemption(sql, 11);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 409);
    assert.match(r.error, /เหลือ 0 ชิ้น/);
  }
  assert.equal(db.users[0].points, 1000);          // แต้มลูกค้าต้องไม่หาย
  assert.equal(db.rewards[0].stock, 0);            // ของต้องไม่ติดลบและไม่ถูกกลบด้วย GREATEST
  assert.equal(db.requests[0].status, "pending");  // คำขอยังอยู่ พนักงานแก้จำนวนแล้วกดใหม่ได้
  assert.equal(db.transactions.length, 0);
});

test("ยืนยันตอนแต้มลูกค้าไม่พอแล้ว (แต้มหมดอายุไปก่อน) → คืนของที่ตัดไป และคำขอกลับเป็นค้าง", async () => {
  const seed = baseSeed();
  seed.users[0].points = 100;
  const { db, sql } = setup(seed);
  const r = await confirmRedemption(sql, 11);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 400);
  assert.equal(db.users[0].points, 100);
  assert.equal(db.rewards[0].stock, 2);            // ต้องคืนสต๊อกที่ตัดไปแล้ว ไม่งั้นของหายจากระบบ
  assert.equal(db.requests[0].status, "pending");
  assert.equal(db.transactions.length, 0);
});

test("ของรางวัลไม่จำกัดจำนวน (stock = NULL) → ยืนยันได้ ไม่ไปแตะ stock", async () => {
  const seed = baseSeed();
  seed.rewards[0].stock = null as unknown as number;
  const { db, sql } = setup(seed);
  const r = await confirmRedemption(sql, 11);
  assert.equal(r.ok, true);
  if (r.ok && r.action === "confirmed") assert.equal(r.stockLeft, null);
  assert.equal(db.rewards[0].stock, null);
  assert.equal(db.users[0].points, 200);
});

test("ของเหลือ 1 ชิ้น แต่มีคำขอค้าง 2 ใบ (ข้อมูลเก่าจากบั๊กเดิม) → ยืนยันได้ใบเดียว", async () => {
  const { db, sql } = setup({
    users: [{ id: 1, line_user_id: "U_a", points: 5000 }, { id: 2, line_user_id: "U_b", points: 5000 }],
    rewards: [{ id: 105, name: "บัตรเติมน้ำมัน", points_required: 1000, stock: 1 }],
    requests: [
      { id: 11, user_id: 1, reward_id: 105, points_required: 1000, status: "pending", confirmed_at: null },
      { id: 12, user_id: 2, reward_id: 105, points_required: 1000, status: "pending", confirmed_at: null },
    ],
    nextId: 13,
  });
  const a = await confirmRedemption(sql, 11);
  const b = await confirmRedemption(sql, 12);
  assert.equal(a.ok, true);
  assert.equal(b.ok, false);
  if (!b.ok) assert.match(b.error, /เหลือ 0 ชิ้น/);
  assert.equal(db.rewards[0].stock, 0);
  assert.equal(db.users[1].points, 5000);          // คนที่สองยังไม่ถูกหักแต้ม
  assert.equal(db.requests[1].status, "pending");
});

test("ยกเลิกคำขอ → สถานะเปลี่ยน ไม่แตะแต้มและของ", async () => {
  const { db, sql } = setup(baseSeed());
  const r = await cancelRedemption(sql, 11);
  assert.equal(r.ok, true);
  assert.equal(db.requests[0].status, "cancelled");
  assert.equal(db.users[0].points, 1000);
  assert.equal(db.rewards[0].stock, 2);
});

test("ยกเลิกซ้ำ / ยกเลิกใบที่ยืนยันไปแล้ว → ไม่พบคำขอ", async () => {
  const { sql } = setup(baseSeed());
  await cancelRedemption(sql, 11);
  const again = await cancelRedemption(sql, 11);
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.status, 404);
});

test("ยืนยันใบที่ไม่มีอยู่ → 404 ไม่พัง", async () => {
  const { sql } = setup(baseSeed());
  const r = await confirmRedemption(sql, 999);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 404);
});
