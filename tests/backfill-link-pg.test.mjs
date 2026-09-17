import { test, eq, ok } from "./_harness.mjs";
import { freshDb } from "./pg.mjs";

const linkSql = `UPDATE users SET customer_id = $2,
  backfill_from = CASE WHEN COALESCE(TRIM(customer_id), '') = '' AND $2::text IS NOT NULL
    THEN GREATEST((created_at AT TIME ZONE 'Asia/Bangkok')::date, (NOW() AT TIME ZONE 'Asia/Bangkok')::date - 30)
    ELSE backfill_from END,
  backfill_done_at = CASE WHEN COALESCE(TRIM(customer_id), '') = '' AND $2::text IS NOT NULL THEN NULL ELSE backfill_done_at END
  WHERE id = $1 RETURNING customer_id, backfill_from, backfill_done_at`;

test("[pg] ผูกรหัสครั้งแรกตั้ง backfill จากวันสมัคร แต่ไม่เกิน 30 วัน", async () => {
  const { pg, db } = await freshDb();
  const [recent] = await db.query(`INSERT INTO users(phone, created_at) VALUES ('0811111111', NOW() - INTERVAL '5 days') RETURNING id`);
  const [old] = await db.query(`INSERT INTO users(phone, created_at) VALUES ('0822222222', NOW() - INTERVAL '60 days') RETURNING id`);
  const [a] = await db.query(linkSql, [recent.id, "CUS-A"]);
  const [b] = await db.query(linkSql, [old.id, "CUS-B"]);
  const [days] = await db.query(`SELECT CURRENT_DATE - $1::date AS recent_age, CURRENT_DATE - $2::date AS old_age`, [a.backfill_from, b.backfill_from]);
  ok(Number(days.recent_age) >= 4 && Number(days.recent_age) <= 6, "วันสมัครล่าสุดต้องเป็นจุดเริ่ม");
  eq(Number(days.old_age), 30, "สมาชิกเก่าต้องย้อนหลังสูงสุด 30 วัน");
  await pg.close();
});

test("[pg] เปลี่ยนรหัสภายหลังไม่เปิด backfill ซ้ำและไม่ล้างเวลาปิดงาน", async () => {
  const { pg, db } = await freshDb();
  const [u] = await db.query(`INSERT INTO users(phone, customer_id, backfill_from, backfill_done_at)
    VALUES ('0833333333','CUS-OLD', CURRENT_DATE - 7, NOW()) RETURNING id, backfill_from, backfill_done_at`);
  const [changed] = await db.query(linkSql, [u.id, "CUS-NEW"]);
  eq(String(changed.backfill_from), String(u.backfill_from));
  eq(new Date(changed.backfill_done_at).toISOString(), new Date(u.backfill_done_at).toISOString());
  await pg.close();
});
