// พิสูจน์ SQL ของการตัดแต้มหมดอายุกับ Postgres จริง (PGlite ในเครื่อง ไม่ต่อฐานข้อมูลร้าน)
import { test, eq, ok } from "./_harness.mjs";
import { freshDb } from "./pg.mjs";
import { expireUserPoints, usersWithDueLots, ledgerViewFor } from "../lib/points-ledger.ts";

const DAY = 86400000;
const NOW = Date.parse("2026-09-16T05:00:00Z");
const at = (d) => new Date(NOW + d * DAY).toISOString();

async function seed(db, { points, rows, line = "U1", name = "สมชาย" }) {
  const [u] = await db.query(`INSERT INTO users (line_user_id, first_name, points, total_earned) VALUES ($1,$2,$3,$3) RETURNING id`, [line, name, points]);
  for (const r of rows) {
    await db.query(
      `INSERT INTO transactions (user_id, points_earned, type, expires_at, cleared, expired) VALUES ($1,$2,$3,$4,$5,$6)`,
      [u.id, r.pts, r.type, r.exp === undefined ? null : at(r.exp), r.cleared ?? false, r.expired ?? false],
    );
  }
  return u.id;
}
const balance = async (db, id) => Number((await db.query(`SELECT points FROM users WHERE id=$1`, [id]))[0].points);
const expireRows = async (db, id) => (await db.query(`SELECT points_earned FROM transactions WHERE user_id=$1 AND type='expire'`, [id])).map(r => r.points_earned);
const unmarked = async (db, id) => Number((await db.query(`SELECT COUNT(*)::int c FROM transactions WHERE user_id=$1 AND type='earn' AND expired=FALSE AND expires_at <= $2`, [id, at(0)]))[0].c);

test("[Postgres] เคสหักซ้ำ: แลกของไปแล้ว ก้อนเก่าครบปีต้องไม่ถูกหักอีก", async () => {
  const { pg, db } = await freshDb();
  const id = await seed(db, { points: 1950, rows: [
    { type: "earn", pts: 50, exp: -1 }, { type: "earn", pts: 1950, exp: 300 }, { type: "redeem", pts: 50 },
  ] });
  const r = await expireUserPoints(db, id, NOW);
  eq(r.applied, true);
  eq(r.expired, 0);
  eq(await balance(db, id), 1950, "แต้มคงเหลือต้องไม่ลด");
  eq((await expireRows(db, id)).length, 0, "ไม่ต้องมีรายการหมดอายุ");
  eq(await unmarked(db, id), 0, "ก้อนที่ครบกำหนดต้องถูกมาร์กว่าประมวลผลแล้ว จะได้ไม่วนมาอีก");
  await pg.close();
});

test("[Postgres] ไม่ได้ใช้แต้ม: ตัดเต็มก้อน บันทึกรายการ และหักยอดถูกต้อง", async () => {
  const { pg, db } = await freshDb();
  const id = await seed(db, { points: 420, rows: [{ type: "earn", pts: 120, exp: -2 }, { type: "earn", pts: 300, exp: 200 }] });
  const r = await expireUserPoints(db, id, NOW);
  eq(r.expired, 120);
  eq(r.balanceAfter, 300);
  eq(await balance(db, id), 300);
  eq((await expireRows(db, id)).join(","), "120");
  await pg.close();
});

test("[Postgres] รันซ้ำทันที (เช่น Vercel ยิง cron ซ้ำ) ต้องไม่หักเพิ่ม", async () => {
  const { pg, db } = await freshDb();
  const id = await seed(db, { points: 420, rows: [{ type: "earn", pts: 120, exp: -2 }, { type: "earn", pts: 300, exp: 200 }] });
  await expireUserPoints(db, id, NOW);
  // ทำเหมือนก้อนยังไม่ถูกมาร์ก (สถานการณ์เลวร้ายสุด) แล้วรันอีกรอบ
  await db.query(`UPDATE transactions SET expired = FALSE WHERE user_id = $1`, [id]);
  const again = await expireUserPoints(db, id, NOW);
  eq(again.expired, 0, "สูตรต้องรู้ว่าตัดไปแล้ว");
  eq(await balance(db, id), 300);
  eq((await expireRows(db, id)).length, 1);
  await pg.close();
});

test("[Postgres] ลูกค้าแลกของแทรกระหว่างคำนวณกับบันทึก → ไม่เขียนอะไรเลย รอบหน้าคิดใหม่ถูก", async () => {
  const { pg, db } = await freshDb();
  const id = await seed(db, { points: 420, rows: [{ type: "earn", pts: 120, exp: -2 }, { type: "earn", pts: 300, exp: 200 }] });
  // ห่อ db ให้มีการแลกของ 100 แต้มเกิดขึ้น "หลังอ่าน ก่อนเขียน"
  const racy = {
    query: db.query,
    tx: async (stmts) => {
      await db.query(`INSERT INTO transactions (user_id, points_earned, type) VALUES ($1, 100, 'redeem')`, [id]);
      await db.query(`UPDATE users SET points = points - 100 WHERE id = $1`, [id]);
      return db.tx(stmts);
    },
  };
  const r = await expireUserPoints(racy, id, NOW);
  eq(r.applied, false, "บัญชีเปลี่ยนระหว่างทาง ต้องไม่เขียน");
  eq(r.expired, 0);
  eq(await balance(db, id), 320, "หักแค่ที่ลูกค้าแลกไป");
  eq(await unmarked(db, id), 1, "ยังไม่มาร์ก เพื่อให้รอบหน้าหยิบมาคิดใหม่");
  // รอบถัดไป: แลกไป 100 กินก้อนเก่า 120 → เหลือต้องตัด 20
  const next = await expireUserPoints(db, id, NOW);
  eq(next.applied, true);
  eq(next.expired, 20);
  eq(await balance(db, id), 300);
  await pg.close();
});

test("[Postgres] ถอนบิลแล้ว (adjust) ก้อนของบิลนั้นต้องไม่ถูกหักซ้ำตอนครบปี", async () => {
  const { pg, db } = await freshDb();
  const id = await seed(db, { points: 80, rows: [{ type: "earn", pts: 200, exp: -1 }, { type: "earn", pts: 80, exp: 100 }, { type: "adjust", pts: 200 }] });
  const r = await expireUserPoints(db, id, NOW);
  eq(r.expired, 0);
  eq(await balance(db, id), 80);
  await pg.close();
});

test("[Postgres] แถวที่แอดมินเคลียร์ไม่นับ และไม่ถูกหยิบมาประมวลผล", async () => {
  const { pg, db } = await freshDb();
  const id = await seed(db, { points: 40, rows: [
    { type: "earn", pts: 999, exp: -5, cleared: true }, { type: "redeem", pts: 500, cleared: true }, { type: "earn", pts: 40, exp: -1 },
  ] });
  const r = await expireUserPoints(db, id, NOW);
  eq(r.expired, 40);
  eq(await balance(db, id), 0);
  const cleared = await db.query(`SELECT expired FROM transactions WHERE user_id=$1 AND cleared=TRUE AND type='earn'`, [id]);
  eq(cleared[0].expired, false, "ห้ามแตะแถวที่เคลียร์แล้ว");
  await pg.close();
});

test("[Postgres] แต้มคงเหลือน้อยกว่าที่คำนวณได้ → ไม่หักจนติดลบ", async () => {
  const { pg, db } = await freshDb();
  const id = await seed(db, { points: 30, rows: [{ type: "earn", pts: 100, exp: -1 }] });
  const r = await expireUserPoints(db, id, NOW);
  eq(r.expired, 30);
  eq(await balance(db, id), 0);
  await pg.close();
});

test("[Postgres] รายชื่อที่ต้องประมวลผล: เฉพาะคนที่มีก้อนครบกำหนดและยังไม่มาร์ก และมีเพดาน", async () => {
  const { pg, db } = await freshDb();
  const a = await seed(db, { points: 10, line: "A", rows: [{ type: "earn", pts: 10, exp: -1 }] });
  const b = await seed(db, { points: 10, line: "B", rows: [{ type: "earn", pts: 10, exp: 5 }] });
  const c = await seed(db, { points: 10, line: "C", rows: [{ type: "earn", pts: 10, exp: -1, expired: true }] });
  const d = await seed(db, { points: 10, line: "D", rows: [{ type: "earn", pts: 10, exp: -3 }] });
  const all = await usersWithDueLots(db, NOW);
  eq(all.join(","), [a, d].join(","), "b ยังไม่ถึงกำหนด c มาร์กแล้ว");
  eq((await usersWithDueLots(db, NOW, 1)).length, 1, "ต้องเคารพเพดานต่อรอบ");
  ok(![b, c].some(x => all.includes(x)));
  await pg.close();
});

test("[Postgres] ภาพรวมบนบัตรใช้สูตรเดียวกัน: ก้อนที่ถูกใช้ไปแล้วไม่ขึ้นเตือน", async () => {
  const { pg, db } = await freshDb();
  const id = await seed(db, { points: 1950, rows: [{ type: "earn", pts: 50, exp: 21 }, { type: "earn", pts: 1950, exp: 300 }, { type: "redeem", pts: 50 }] });
  const v = await ledgerViewFor(db, id, 1950, 31, NOW);
  eq(v.soon, 0);
  eq(v.soonEarliest, null);
  await pg.close();
});
