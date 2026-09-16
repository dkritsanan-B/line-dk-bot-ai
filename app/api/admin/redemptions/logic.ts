// ตรรกะ "ยืนยัน / ยกเลิก" คำขอแลกของรางวัล (ฝั่งพนักงาน) — แยกออกจาก route เพื่อทดสอบได้โดยไม่ต่อฐานข้อมูลจริง
//
// ต้องสอดคล้องกับฝั่งลูกค้า (app/api/liff/redeem/logic.ts) ที่ถือว่า
//   คำขอสถานะ pending = "จอง" แต้มและของไว้แล้ว
// ที่นี่คือจุดที่การจองกลายเป็นจริง: หักแต้ม + ตัดสต๊อก + ปิดคำขอ
//
// ของเดิมมี 2 รู:
//   1) ตัดสต๊อกด้วย GREATEST(0, stock - 1) → ของเหลือ 1 ชิ้น แต่ยืนยันได้ไม่จำกัด ตัวเลขไม่เคยติดลบให้เห็น
//      ร้านจึงรู้ว่าจ่ายของเกินตอนของหมดหน้าเคาน์เตอร์เท่านั้น
//   2) เช็คแต้มจากค่าที่อ่านมาก่อนหน้า แล้วค่อยสั่งหัก (คนละคำสั่ง) → กดยืนยันสองหน้าจอพร้อมกันหักซ้อนได้ แต้มติดลบได้
// ตอนนี้ทุกขั้นเป็นคำสั่งเดียวที่มีเงื่อนไขในตัว (UPDATE … WHERE … RETURNING) ถ้าไม่ได้แถวคืนมาแปลว่าแพ้เร็ซ แล้วถอยคืนให้ครบ

// เจตนาใช้ path แบบ relative (ไม่ใช่ alias @/) เพื่อให้ tests รันด้วย node/tsx ตรง ๆ ได้โดยไม่ต้องตั้ง resolver
import type { SqlRow, SqlTag } from "../../liff/redeem/logic";

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

async function loadPending(sql: SqlTag, id: number): Promise<RedemptionRow | null> {
  const rows = await sql`
    SELECT r.id, r.user_id, r.reward_id, r.points_required,
           u.line_user_id, u.points,
           rw.name AS reward_name, rw.stock
    FROM redemption_requests r
    JOIN users u    ON u.id  = r.user_id
    JOIN rewards rw ON rw.id = r.reward_id
    WHERE r.id = ${id} AND r.status = 'pending'
    LIMIT 1
  `;
  const r: SqlRow | undefined = rows[0];
  if (!r) return null;
  return {
    id: n(r.id),
    user_id: n(r.user_id),
    reward_id: n(r.reward_id),
    points_required: n(r.points_required),
    line_user_id: (r.line_user_id as string | null) ?? null,
    reward_name: String(r.reward_name ?? "ของรางวัล"),
    stock: r.stock === null || r.stock === undefined ? null : n(r.stock),
    points: n(r.points),
  };
}

/**
 * ยืนยันการแลก — ลำดับสำคัญ ทุกขั้นถอยคืนได้ถ้าขั้นถัดไปไม่ผ่าน
 *   1) ยึดคำขอ (pending → confirmed) ด้วยคำสั่งเดียว — แอดมินสองคนกดพร้อมกัน ผ่านได้คนเดียว
 *   2) ตัดสต๊อก เฉพาะตอนที่ยังเหลือจริง (stock > 0) — ไม่ใช่ GREATEST(0, …) ที่กลบการจ่ายเกิน
 *   3) หักแต้ม เฉพาะตอนแต้มยังพอ (points >= ที่ต้องใช้) — กันแต้มติดลบ
 * ขั้น 2 หรือ 3 ไม่ผ่าน = คืนของ/คืนสถานะให้เหมือนเดิมทุกอย่าง แล้วบอกพนักงานว่าติดอะไร
 */
export async function confirmRedemption(sql: SqlTag, id: number): Promise<AdminRedeemResult> {
  const row = await loadPending(sql, id);
  if (!row) return { ok: false, status: 404, error: "ไม่พบคำขอ หรือดำเนินการไปแล้ว" };

  const claim = await sql`
    UPDATE redemption_requests SET status = 'confirmed', confirmed_at = NOW()
    WHERE id = ${id} AND status = 'pending'
    RETURNING id
  `;
  if (claim.length === 0) return { ok: false, status: 409, error: "คำขอนี้เพิ่งถูกดำเนินการไปแล้ว (มีคนกดพร้อมกัน) กรุณารีเฟรช" };

  const revertClaim = async () => {
    await sql`UPDATE redemption_requests SET status = 'pending', confirmed_at = NULL WHERE id = ${id}`;
  };

  let stockLeft: number | null = null;
  if (row.stock !== null) {
    const dec = await sql`
      UPDATE rewards SET stock = stock - 1
      WHERE id = ${row.reward_id} AND stock > 0
      RETURNING stock
    `;
    if (dec.length === 0) {
      await revertClaim();
      return {
        ok: false, status: 409,
        error: `ยืนยันไม่ได้: ${row.reward_name} เหลือ 0 ชิ้นในระบบแล้ว — ถ้าของยังมีจริง ให้แก้จำนวนคงเหลือในหน้า "ของรางวัล" ก่อน แล้วค่อยกดยืนยันอีกครั้ง`,
      };
    }
    stockLeft = n(dec[0].stock);
  }

  const deducted = await sql`
    UPDATE users SET points = points - ${row.points_required}
    WHERE id = ${row.user_id} AND points >= ${row.points_required}
    RETURNING points
  `;
  if (deducted.length === 0) {
    if (row.stock !== null) await sql`UPDATE rewards SET stock = stock + 1 WHERE id = ${row.reward_id}`;
    await revertClaim();
    return { ok: false, status: 400, error: "แต้มลูกค้าไม่พอแล้ว (แต้มอาจหมดอายุหรือถูกใช้ไปก่อนหน้านี้) คำขอยังค้างไว้เหมือนเดิม" };
  }

  await sql`
    INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note)
    VALUES (${row.user_id}, 0, ${row.points_required}, 'redeem', ${`แลก: ${row.reward_name} (#REQ-${id})`})
  `;

  return { ok: true, action: "confirmed", row, pointsLeft: n(deducted[0].points), stockLeft };
}

/** ยกเลิกคำขอ — ปล่อยแต้มและของที่จองไว้คืนทันที (เพราะการจองคิดจากแถวที่ยัง pending) */
export async function cancelRedemption(sql: SqlTag, id: number): Promise<AdminRedeemResult> {
  const row = await loadPending(sql, id);
  if (!row) return { ok: false, status: 404, error: "ไม่พบคำขอ หรือดำเนินการไปแล้ว" };

  const done = await sql`
    UPDATE redemption_requests SET status = 'cancelled'
    WHERE id = ${id} AND status = 'pending'
    RETURNING id
  `;
  if (done.length === 0) return { ok: false, status: 409, error: "คำขอนี้เพิ่งถูกดำเนินการไปแล้ว (มีคนกดพร้อมกัน) กรุณารีเฟรช" };

  return { ok: true, action: "cancelled", row };
}
