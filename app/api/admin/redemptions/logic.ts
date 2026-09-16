// ตรรกะ "ยืนยัน / ยกเลิก" คำขอแลกของรางวัล (ฝั่งพนักงาน)
//
// ต้องสอดคล้องกับฝั่งลูกค้า (app/api/liff/redeem/logic.ts) ที่ถือว่า คำขอ pending = "จอง" แต้มและของไว้แล้ว
// ที่นี่คือจุดที่การจองกลายเป็นจริง: ปิดคำขอ + ตัดสต๊อก + หักแต้ม + ลงประวัติ
//
// ประวัติการแก้:
//   เดิม: ตัดสต๊อกด้วย GREATEST(0, stock - 1) (จ่ายของเกินได้ไม่จำกัด) และเช็คแต้มจากค่าที่อ่านไว้ก่อน (หักซ้อนจนติดลบได้)
//   รอบแรก 16 ก.ย. 69: แยกเป็น 4 คำสั่งที่มีเงื่อนไข + ถอยคืนเองถ้าขั้นถัดไปไม่ผ่าน
//     → ยังพังได้: ถ้าเน็ต/ฐานข้อมูลล่มกลางทาง จะค้างเป็น "ยืนยันแล้ว ของหาย แต่แต้มไม่ถูกหัก" หรือ "หักแต้มแต่ไม่มีประวัติ"
//   ตอนนี้: ทั้ง 4 อย่างเป็น "คำสั่งเดียว" ที่ล็อกคำขอ/ของรางวัล/สมาชิกไว้ก่อน แล้วเขียนเฉพาะเมื่อทุกเงื่อนไขผ่าน
//     Postgres รับประกันว่าคำสั่งเดียวสำเร็จทั้งหมดหรือไม่เกิดอะไรเลย · มีเทสต์กับ Postgres จริงที่ tests/admin-confirm-pg.test.mjs

import type { Db } from "../../../../lib/db";

const n = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));

export interface RedemptionRow {
  id: number;
  user_id: number;
  reward_id: number;
  points_required: number;
  line_user_id: string | null;
  reward_name: string;
  stock: number | null;
  points: number;
}

export type AdminRedeemResult =
  | { ok: true; action: "confirmed"; row: RedemptionRow; pointsLeft: number; stockLeft: number | null }
  | { ok: true; action: "cancelled"; row: RedemptionRow }
  | { ok: false; status: number; error: string };

// $1 = id คำขอ
const CONFIRM_SQL = `
  WITH req AS (
    SELECT id, user_id, reward_id, points_required
      FROM redemption_requests
     WHERE id = $1 AND status = 'pending'
     FOR UPDATE
  ),
  rw AS (
    SELECT id, stock, name FROM rewards
     WHERE id = (SELECT reward_id FROM req)
     FOR UPDATE
  ),
  u AS (
    SELECT id, points, line_user_id FROM users
     WHERE id = (SELECT user_id FROM req)
     FOR UPDATE
  ),
  ok AS (
    SELECT req.id, req.user_id, req.reward_id, req.points_required, rw.name AS reward_name
      FROM req JOIN rw ON rw.id = req.reward_id JOIN u ON u.id = req.user_id
     WHERE (rw.stock IS NULL OR rw.stock > 0)
       AND req.points_required > 0
       AND u.points >= req.points_required
  ),
  claim AS (
    UPDATE redemption_requests SET status = 'confirmed', confirmed_at = NOW()
     WHERE id = (SELECT id FROM ok) AND status = 'pending'
    RETURNING id
  ),
  dec AS (
    UPDATE rewards SET stock = stock - 1
     WHERE id = (SELECT reward_id FROM ok) AND stock IS NOT NULL
       AND EXISTS (SELECT 1 FROM claim)
    RETURNING stock
  ),
  ded AS (
    UPDATE users SET points = points - (SELECT points_required FROM ok)
     WHERE id = (SELECT user_id FROM ok)
       AND EXISTS (SELECT 1 FROM claim)
    RETURNING points
  ),
  hist AS (
    INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note)
    SELECT ok.user_id, 0, ok.points_required, 'redeem', 'แลก: ' || ok.reward_name || ' (#REQ-' || ok.id || ')'
      FROM ok WHERE EXISTS (SELECT 1 FROM claim)
    RETURNING id
  )
  SELECT
    (SELECT COUNT(*) FROM req)::int              AS found,
    (SELECT COUNT(*) FROM claim)::int            AS claimed,
    (SELECT user_id FROM req)                    AS user_id,
    (SELECT reward_id FROM req)                  AS reward_id,
    (SELECT points_required FROM req)            AS points_required,
    (SELECT name FROM rw)                        AS reward_name,
    (SELECT stock FROM rw)                       AS stock_before,
    (SELECT points FROM u)                       AS points_before,
    (SELECT line_user_id FROM u)                 AS line_user_id,
    (SELECT stock FROM dec)                      AS stock_after,
    (SELECT points FROM ded)                     AS points_after,
    (SELECT COUNT(*) FROM hist)::int             AS history_rows`;

/**
 * ยืนยันการแลก — คำสั่งเดียว สำเร็จทั้งหมดหรือไม่เขียนอะไรเลย
 * ไม่ผ่านเพราะ: ไม่พบ/ดำเนินการไปแล้ว · ของหมด · แต้มไม่พอ · ข้อมูลของรางวัลผิด (ใช้แต้ม ≤ 0)
 */
export async function confirmRedemption(db: Db, id: number): Promise<AdminRedeemResult> {
  const [r] = await db.query(CONFIRM_SQL, [id]);
  if (!r || n(r.found) === 0) return { ok: false, status: 404, error: "ไม่พบคำขอ หรือดำเนินการไปแล้ว (อาจมีคนกดพร้อมกัน) กรุณารีเฟรช" };

  const row: RedemptionRow = {
    id,
    user_id: n(r.user_id),
    reward_id: n(r.reward_id),
    points_required: n(r.points_required),
    line_user_id: (r.line_user_id as string | null) ?? null,
    reward_name: String(r.reward_name ?? "ของรางวัล"),
    stock: r.stock_before === null || r.stock_before === undefined ? null : n(r.stock_before),
    points: n(r.points_before),
  };

  if (n(r.claimed) === 0) {
    if (row.points_required <= 0) {
      return { ok: false, status: 400, error: `ยืนยันไม่ได้: ของรางวัล "${row.reward_name}" ตั้งแต้มที่ใช้ไว้เป็น ${row.points_required} ซึ่งผิด กรุณาแก้ในหน้า "ของรางวัล" ก่อน` };
    }
    if (row.stock !== null && row.stock <= 0) {
      return { ok: false, status: 409, error: `ยืนยันไม่ได้: ${row.reward_name} เหลือ 0 ชิ้นในระบบแล้ว — ถ้าของยังมีจริง ให้แก้จำนวนคงเหลือในหน้า "ของรางวัล" ก่อน แล้วค่อยกดยืนยันอีกครั้ง` };
    }
    if (row.points < row.points_required) {
      return { ok: false, status: 400, error: `แต้มลูกค้าไม่พอแล้ว (มี ${row.points.toLocaleString()} ต้องใช้ ${row.points_required.toLocaleString()} — แต้มอาจหมดอายุหรือถูกใช้ไปก่อน) คำขอยังค้างไว้เหมือนเดิม` };
    }
    return { ok: false, status: 409, error: "คำขอนี้เพิ่งถูกดำเนินการไปแล้ว (มีคนกดพร้อมกัน) กรุณารีเฟรช" };
  }

  return {
    ok: true, action: "confirmed", row,
    pointsLeft: n(r.points_after),
    stockLeft: r.stock_after === null || r.stock_after === undefined ? null : n(r.stock_after),
  };
}

/** ยกเลิกคำขอ — คำสั่งเดียว ปล่อยแต้มและของที่จองไว้คืนทันที (การจองคิดจากแถวที่ยัง pending) */
export async function cancelRedemption(db: Db, id: number): Promise<AdminRedeemResult> {
  const [r] = await db.query(
    `WITH done AS (
       UPDATE redemption_requests SET status = 'cancelled'
        WHERE id = $1 AND status = 'pending'
       RETURNING id, user_id, reward_id, points_required
     )
     SELECT d.id, d.user_id, d.reward_id, d.points_required,
            u.line_user_id, u.points, rw.name AS reward_name, rw.stock
       FROM done d
       JOIN users u    ON u.id  = d.user_id
       LEFT JOIN rewards rw ON rw.id = d.reward_id`,
    [id],
  );
  if (!r) return { ok: false, status: 404, error: "ไม่พบคำขอ หรือดำเนินการไปแล้ว (อาจมีคนกดพร้อมกัน) กรุณารีเฟรช" };
  return {
    ok: true, action: "cancelled",
    row: {
      id: n(r.id), user_id: n(r.user_id), reward_id: n(r.reward_id), points_required: n(r.points_required),
      line_user_id: (r.line_user_id as string | null) ?? null,
      reward_name: String(r.reward_name ?? "ของรางวัล"),
      stock: r.stock === null || r.stock === undefined ? null : n(r.stock),
      points: n(r.points),
    },
  };
}
