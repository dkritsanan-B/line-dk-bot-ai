// ให้แต้ม / หักแต้ม กับ Postgres จริงในเครื่อง — ยอดกับประวัติต้องเกิดคู่กันเสมอ และแต้มไม่ติดลบ
import { test, eq, ok } from "./_harness.mjs";
import { freshDb } from "./pg.mjs";
import { addPoints, deductPoints } from "../lib/points.ts";

async function withMember(points = 0) {
  const { pg, db } = await freshDb();
  const [u] = await db.query(`INSERT INTO users (phone, points, total_earned) VALUES ('0812345678', $1, $1) RETURNING id`, [points]);
  const state = async () => {
    const [x] = await db.query(`SELECT points, total_earned,
      (SELECT COUNT(*)::int FROM transactions WHERE user_id = $1) AS rows,
      (SELECT COALESCE(SUM(points_earned),0)::int FROM transactions WHERE user_id = $1 AND type='earn') AS earned,
      (SELECT COALESCE(SUM(points_earned),0)::int FROM transactions WHERE user_id = $1 AND type='redeem') AS used
      FROM users WHERE id = $1`, [u.id]);
    return { points: x.points, total: x.total_earned, rows: x.rows, earned: x.earned, used: x.used };
  };
  return { pg, db, id: u.id, state };
}

test("[pg] ให้แต้มจากบิล: ยอด + ประวัติ + วันหมดอายุ เกิดพร้อมกัน", async () => {
  const m = await withMember(0);
  const r = await addPoints("0812345678", 12550, "บิล IV-1", m.db);
  eq(r.pointsEarned, 125);
  eq(r.totalPoints, 125);
  eq(JSON.stringify(await m.state()), JSON.stringify({ points: 125, total: 125, rows: 1, earned: 125, used: 0 }));
  const [lot] = await m.db.query(`SELECT expires_at > NOW() + INTERVAL '364 days' AS ok FROM transactions WHERE user_id = $1`, [m.id]);
  ok(lot.ok, "ต้องมีวันหมดอายุ 1 ปี");
  await m.pg.close();
});

test("[pg] ให้แต้ม: ไม่พบเบอร์ / ยอดไม่ถึง 100 บาท → ไม่เขียนอะไร", async () => {
  const m = await withMember(0);
  eq(await addPoints("0999999999", 5000, null, m.db), null);
  eq(await addPoints("0812345678", 99, null, m.db), null);
  eq(await addPoints("0812345678", NaN, null, m.db), null);
  eq((await m.state()).rows, 0);
  await m.pg.close();
});

test("[pg] ให้แต้ม: ถ้าลงประวัติไม่ได้ ยอดต้องไม่เปลี่ยน (เดิมยอดเพิ่มแต่ไม่มีประวัติ)", async () => {
  const m = await withMember(10);
  await m.pg.exec(`ALTER TABLE transactions ADD CONSTRAINT boom CHECK (type <> 'earn')`);
  let threw = false;
  try { await addPoints("0812345678", 5000, null, m.db); } catch { threw = true; }
  ok(threw);
  eq((await m.state()).points, 10);
  await m.pg.close();
});

test("[pg] หักแต้ม: ปกติ ยอดลด + มีประวัติ", async () => {
  const m = await withMember(500);
  const r = await deductPoints("0812345678", 200, "ปรับมือ", m.db);
  eq(r.totalPoints, 300);
  eq(JSON.stringify(await m.state()), JSON.stringify({ points: 300, total: 500, rows: 1, earned: 0, used: 200 }));
  await m.pg.close();
});

test("[pg] หักแต้ม: กดซ้ำจนเกินยอด → ครั้งที่เกินถูกปฏิเสธ แต้มไม่ติดลบ", async () => {
  const m = await withMember(500);
  ok(await deductPoints("0812345678", 300, null, m.db));
  eq(await deductPoints("0812345678", 300, null, m.db), null, "ครั้งที่สองต้องไม่ผ่าน");
  eq(JSON.stringify(await m.state()), JSON.stringify({ points: 200, total: 500, rows: 1, earned: 0, used: 300 }));
  await m.pg.close();
});

test("[pg] หักแต้ม: จำนวน 0 / ติดลบ / ไม่ใช่ตัวเลข → ไม่ทำอะไร (ติดลบ = แอบเพิ่มแต้ม)", async () => {
  const m = await withMember(500);
  for (const bad of [0, -100, NaN, "abc"]) eq(await deductPoints("0812345678", bad, null, m.db), null, String(bad));
  eq((await m.state()).points, 500);
  eq((await m.state()).rows, 0);
  await m.pg.close();
});
