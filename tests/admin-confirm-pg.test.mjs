// ยืนยัน/ยกเลิกคำขอแลกของรางวัล (ฝั่งพนักงาน) กับ Postgres จริงในเครื่อง — ไม่แตะฐานข้อมูลร้าน
import { test, eq, ok } from "./_harness.mjs";
import { freshDb } from "./pg.mjs";
import { confirmRedemption, cancelRedemption } from "../app/api/admin/redemptions/logic.ts";

async function setup({ points = 1000, stock = 5, cost = 300, requests = 1 } = {}) {
  const { pg, db } = await freshDb();
  const [u] = await db.query(`INSERT INTO users (line_user_id, first_name, points) VALUES ('U1','สมชาย',$1) RETURNING id`, [points]);
  const [rw] = await db.query(`INSERT INTO rewards (name, points_required, stock) VALUES ('ถุงมือช่าง', $1, $2) RETURNING id`, [cost, stock]);
  const reqIds = [];
  for (let i = 0; i < requests; i++) {
    const [r] = await db.query(`INSERT INTO redemption_requests (user_id, reward_id, points_required) VALUES ($1,$2,$3) RETURNING id`, [u.id, rw.id, cost]);
    reqIds.push(r.id);
  }
  const state = async () => {
    const [x] = await db.query(`SELECT
      (SELECT points FROM users WHERE id=$1) AS points,
      (SELECT stock FROM rewards WHERE id=$2) AS stock,
      (SELECT COUNT(*)::int FROM transactions WHERE user_id=$1 AND type='redeem') AS history,
      (SELECT string_agg(status, ',' ORDER BY id) FROM redemption_requests) AS statuses`, [u.id, rw.id]);
    return { points: Number(x.points), stock: x.stock === null ? null : Number(x.stock), history: x.history, statuses: x.statuses };
  };
  return { pg, db, userId: u.id, rewardId: rw.id, reqIds, state };
}

test("[pg] ยืนยันปกติ: ปิดคำขอ ตัดของ หักแต้ม ลงประวัติ ครบในครั้งเดียว", async () => {
  const s = await setup();
  const r = await confirmRedemption(s.db, s.reqIds[0]);
  eq(r.ok, true);
  eq(r.pointsLeft, 700);
  eq(r.stockLeft, 4);
  eq(r.row.line_user_id, "U1", "ต้องได้ LINE id ไว้ส่งแจ้งลูกค้า");
  eq(JSON.stringify(await s.state()), JSON.stringify({ points: 700, stock: 4, history: 1, statuses: "confirmed" }));
  await s.pg.close();
});

test("[pg] กดยืนยันซ้ำ: ครั้งที่สองต้องไม่หักอะไรเพิ่ม", async () => {
  const s = await setup();
  await confirmRedemption(s.db, s.reqIds[0]);
  const again = await confirmRedemption(s.db, s.reqIds[0]);
  eq(again.ok, false);
  eq(again.status, 404);
  eq(JSON.stringify(await s.state()), JSON.stringify({ points: 700, stock: 4, history: 1, statuses: "confirmed" }));
  await s.pg.close();
});

test("[pg] ของหมด: ไม่เขียนอะไรเลย คำขอยังรออยู่ และบอกพนักงานว่าของหมด", async () => {
  const s = await setup({ stock: 0 });
  const r = await confirmRedemption(s.db, s.reqIds[0]);
  eq(r.ok, false);
  eq(r.status, 409);
  ok(r.error.includes("เหลือ 0 ชิ้น"), r.error);
  eq(JSON.stringify(await s.state()), JSON.stringify({ points: 1000, stock: 0, history: 0, statuses: "pending" }));
  await s.pg.close();
});

test("[pg] แต้มไม่พอ: ไม่ตัดของ ไม่หักแต้ม ไม่ลงประวัติ (ของเดิมตัดของไปก่อนแล้วค่อยถอยคืน)", async () => {
  const s = await setup({ points: 100 });
  const r = await confirmRedemption(s.db, s.reqIds[0]);
  eq(r.ok, false);
  eq(r.status, 400);
  ok(r.error.includes("แต้มลูกค้าไม่พอ"), r.error);
  eq(JSON.stringify(await s.state()), JSON.stringify({ points: 100, stock: 5, history: 0, statuses: "pending" }));
  await s.pg.close();
});

test("[pg] ของไม่จำกัดจำนวน (stock ว่าง): หักแต้มได้ และไม่แตะจำนวนของ", async () => {
  const s = await setup({ stock: null });
  const r = await confirmRedemption(s.db, s.reqIds[0]);
  eq(r.ok, true);
  eq(r.stockLeft, null);
  eq(JSON.stringify(await s.state()), JSON.stringify({ points: 700, stock: null, history: 1, statuses: "confirmed" }));
  await s.pg.close();
});

test("[pg] ของรางวัลตั้งแต้มผิด (0 หรือติดลบ): ห้ามยืนยัน ไม่งั้นลูกค้าได้แต้มเพิ่มแทนที่จะลด", async () => {
  const s = await setup({ cost: -50 });
  const r = await confirmRedemption(s.db, s.reqIds[0]);
  eq(r.ok, false);
  ok(r.error.includes("ผิด"), r.error);
  eq((await s.state()).points, 1000);
  await s.pg.close();
});

test("[pg] สองคำขอ แต้มพอแค่ใบเดียว: ใบแรกผ่าน ใบสองถูกปฏิเสธ แต้มไม่ติดลบ", async () => {
  const s = await setup({ points: 500, cost: 300, requests: 2 });
  const a = await confirmRedemption(s.db, s.reqIds[0]);
  const b = await confirmRedemption(s.db, s.reqIds[1]);
  eq(a.ok, true);
  eq(b.ok, false);
  eq(JSON.stringify(await s.state()), JSON.stringify({ points: 200, stock: 4, history: 1, statuses: "confirmed,pending" }));
  await s.pg.close();
});

test("[pg] ของเหลือชิ้นเดียว สองคำขอ: จ่ายได้ชิ้นเดียว ไม่ติดลบ", async () => {
  const s = await setup({ points: 5000, stock: 1, requests: 2 });
  eq((await confirmRedemption(s.db, s.reqIds[0])).ok, true);
  const b = await confirmRedemption(s.db, s.reqIds[1]);
  eq(b.ok, false);
  eq(b.status, 409);
  eq((await s.state()).stock, 0);
  await s.pg.close();
});

test("[pg] ฐานข้อมูลล่มระหว่างทาง: ต้องไม่ค้างครึ่ง ๆ (ของหายแต่แต้มไม่ถูกหัก)", async () => {
  const s = await setup();
  // ทำให้การลงประวัติพังกลางคำสั่ง (เหมือนเน็ตหลุด/ข้อจำกัดในตาราง) — ของเดิมจะค้างเป็นยืนยันแล้ว ตัดของแล้ว
  await s.pg.exec(`ALTER TABLE transactions ADD CONSTRAINT boom CHECK (type <> 'redeem')`);
  let threw = false;
  try { await confirmRedemption(s.db, s.reqIds[0]); } catch { threw = true; }
  ok(threw, "ต้องล้มให้เห็น ไม่ใช่เงียบ");
  eq(JSON.stringify(await s.state()), JSON.stringify({ points: 1000, stock: 5, history: 0, statuses: "pending" }), "ทุกอย่างต้องเหมือนก่อนกด");
  await s.pg.close();
});

test("[pg] ยกเลิก: ปิดคำขอ ไม่แตะแต้มและของ และกดซ้ำไม่ได้", async () => {
  const s = await setup();
  const r = await cancelRedemption(s.db, s.reqIds[0]);
  eq(r.ok, true);
  eq(r.row.reward_name, "ถุงมือช่าง");
  eq(JSON.stringify(await s.state()), JSON.stringify({ points: 1000, stock: 5, history: 0, statuses: "cancelled" }));
  eq((await cancelRedemption(s.db, s.reqIds[0])).ok, false);
  eq((await confirmRedemption(s.db, s.reqIds[0])).ok, false, "ยกเลิกแล้วต้องยืนยันไม่ได้");
  await s.pg.close();
});
