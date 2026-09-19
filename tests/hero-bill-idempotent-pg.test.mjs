// สะพาน Hero→แต้ม ต้องกันบิลซ้ำที่ระดับ DB — บอทร้านยิงบิลเดิมซ้ำ (หลัง timeout/ฟังก์ชันถูกฆ่า) ต้องไม่ได้แต้ม 2 รอบ
// พิสูจน์กับ Postgres จริง (PGlite): คำสั่ง "จองแถวบิล" ที่ route ใช้ คืนแถวได้ครั้งเดียวเท่านั้น แม้ยิงพร้อมกัน
import { test, eq } from "./_harness.mjs";
import { freshDb } from "./pg.mjs";
import { addPoints } from "../lib/points.ts";

const CLAIM = `INSERT INTO hero_point_bills (bill_no, user_id, customer_code, amount, points, bill_date)
  VALUES ($1, $2, $3, $4, 0, $5) ON CONFLICT (bill_no) DO NOTHING RETURNING bill_no`;

async function setup() {
  const { pg, db } = await freshDb();
  await pg.exec(`CREATE TABLE hero_point_bills (bill_no TEXT PRIMARY KEY, user_id INT NOT NULL, customer_code TEXT NOT NULL,
    amount NUMERIC NOT NULL, points INT NOT NULL, bill_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bonus_points INT NOT NULL DEFAULT 0, bonus_tier TEXT, bonus_detail JSONB)`);
  const [u] = await db.query(`INSERT INTO users (phone, customer_id) VALUES ('0812345678', 'CUS-1') RETURNING id`);
  // จำลองสิ่งที่ route ทำต่อบิล: จองแถว → ถ้าได้แถวค่อยให้แต้ม
  const processBill = async (billNo, amount) => {
    const claimed = await db.query(CLAIM, [billNo, u.id, "CUS-1", amount, "2026-09-19"]);
    if (!claimed.length) return "dup";
    const r = await addPoints("0812345678", amount, `บิล ${billNo}`, db);
    await db.query(`UPDATE hero_point_bills SET points = $2 WHERE bill_no = $1`, [billNo, r.pointsEarned]);
    return "ok";
  };
  const points = async () => (await db.query(`SELECT points FROM users WHERE id = $1`, [u.id]))[0].points;
  return { pg, db, processBill, points };
}

test("[pg] บอทส่งบิลเดิมซ้ำ 3 รอบ → แต้มเข้าครั้งเดียว ที่เหลือเป็น dup", async () => {
  const m = await setup();
  eq(await m.processBill("IV-1", 5000), "ok");
  eq(await m.processBill("IV-1", 5000), "dup");
  eq(await m.processBill("IV-1", 5000), "dup");
  eq(await m.points(), 50);
  await m.pg.close();
});

test("[pg] บิลเดิมยิงพร้อมกัน 5 ครั้ง (race) → ok 1 ครั้ง dup 4 ครั้ง แต้ม 50 พอดี", async () => {
  const m = await setup();
  const out = await Promise.all(Array.from({ length: 5 }, () => m.processBill("IV-2", 5000)));
  eq(out.filter(x => x === "ok").length, 1);
  eq(out.filter(x => x === "dup").length, 4);
  eq(await m.points(), 50);
  await m.pg.close();
});

test("[pg] จองแถวแล้วให้แต้มล้ม → ปล่อยแถวคืน แล้วรอบหน้าให้แต้มได้ (ไม่ค้างเป็น dup ตลอดกาล)", async () => {
  const m = await setup();
  const claimed = await m.db.query(CLAIM, ["IV-3", 1, "CUS-1", 5000, "2026-09-19"]);
  eq(claimed.length, 1);
  // ให้แต้มล้ม (จำลอง) → route ลบแถวที่ยังไม่ได้แต้มทิ้ง
  await m.db.query(`DELETE FROM hero_point_bills WHERE bill_no = $1`, ["IV-3"]);
  eq(await m.processBill("IV-3", 5000), "ok");
  eq(await m.points(), 50);
  await m.pg.close();
});
