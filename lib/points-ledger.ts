// บัญชีแต้ม — แหล่งความจริงแหล่งเดียวของเรื่องแต้มหมดอายุ (16 ก.ย. 69)
//
// ปัญหาเดิม: ตาราง transactions เก็บแต้มที่ได้เป็นก้อน ๆ (type='earn' มีวันหมดอายุ) แต่ตอนแลกของ/ถอนบิล
// ระบบหักแค่ users.points ไม่ได้ตัดก้อนไหนเลย พอก้อนเก่าครบปี cron ก็หัก "ทั้งก้อน" อีกรอบ
//   ตัวอย่างจริง: ได้ 50 (หมดวันที่ 21) + 1,950 (หมดวันที่ 300) → แลกของ 50 → คงเหลือ 1,950
//   วันที่ 21 cron หักอีก 50 → เหลือ 1,900 ทั้งที่ 50 แต้มนั้นลูกค้าใช้ไปแล้ว = ลูกค้าเสียแต้มฟรี ๆ
//
// หลักที่ใช้ ("ใช้ก้อนที่จะหมดก่อน ไปก่อน"):
//   ยึด "แต้มคงเหลือจริง" (users.points) เป็นความจริง แล้วถือว่าแต้มคงเหลือนั้นอยู่ในก้อนที่หมดอายุช้าที่สุดก่อน
//   ก้อนเก่าที่ถูกใช้ไปแล้วจึงเหลือ 0 เอง โดยไม่ต้องรู้ว่าใช้ไปด้วยวิธีไหน
//
// ทำไมไม่คิดจากประวัติการใช้ (รวม redeem/expire/adjust แล้วลบออก):
//   ข้อมูลจริงมีประวัติไม่ครบ (บัตรขึ้น 2,300 แต่แถว earn รวมได้แค่พันกว่า — ข้อมูลเก่า/ปรับมือ)
//   ถ้าคิดจากประวัติจะตัดผิด · ยึดยอดคงเหลือแทน ผลเท่ากันทุกกรณีที่ประวัติครบ
//   และเมื่อประวัติไม่ครบจะเข้าข้างลูกค้าเสมอ (ตัดน้อยที่สุดที่สมเหตุผล)
//
// รันซ้ำไม่หักเพิ่ม: ตัดแล้วแต้มคงเหลือลดลงเท่าที่ตัด คิดใหม่ยอดคงเหลือจะไปอยู่ในก้อนที่ยังไม่หมดทั้งหมด → ได้ 0
//
// ก้อนที่ไม่นับ: แอดมินเคลียร์แล้ว (cleared) · ประมวลผลไปแล้ว (expired) · แต้ม ≤ 0 · ไม่ใช่ earn
// ก้อนที่ไม่มีวันหมดอายุ หรือวันที่อ่านไม่ออก = ถือว่าไม่หมดอายุ (ใช้เป็นลำดับสุดท้าย = เข้าข้างลูกค้า)

import type { Db } from "./db";

export const EARN_TYPES = ["earn"] as const;

export interface LedgerRow {
  type?: string;
  points_earned: number | string;
  expires_at: string | Date | null;
  cleared?: boolean | null;
  expired?: boolean | null;
}

export interface LedgerView {
  /** แต้มคงเหลือที่ใช้คิด (users.points ที่ไม่ติดลบ) */
  balance: number;
  /** ผลรวมแต้มของก้อนที่ยังเปิดอยู่ — ใช้ตรวจว่าบัญชีเปลี่ยนระหว่างคำนวณกับบันทึกหรือไม่ */
  openEarned: number;
  /** ต้องตัดตอนนี้ (ส่วนที่ยังเหลือของก้อนที่ครบกำหนดแล้ว) */
  dueNow: number;
  /** ใกล้หมดอายุภายในช่วงที่เตือน ไม่รวมก้อนที่ครบกำหนดไปแล้ว */
  soon: number;
  /** วันหมดอายุของก้อนแรกที่ยังเหลือแต้มจริงในช่วงเตือน · ไม่มี = null */
  soonEarliest: string | null;
}

const DAY_MS = 86400000;
const toInt = (v: unknown) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : 0; };
const toMs = (v: string | Date | null | undefined): number => {
  if (v === null || v === undefined || v === "") return Infinity;
  const ms = new Date(v as string).getTime();
  return Number.isFinite(ms) ? ms : Infinity;
};

/**
 * ภาพรวมของสมาชิกหนึ่งคน
 * @param rows     แถว transactions ของสมาชิกคนนี้ (ส่งมาทั้งหมดได้ ฟังก์ชันเลือกเฉพาะ earn ที่เปิดอยู่เอง)
 * @param balance  users.points ปัจจุบัน
 */
export function viewLedger(rows: LedgerRow[], balance: number, now: number, windowDays: number): LedgerView {
  const until = now + windowDays * DAY_MS;
  const bal = Math.max(0, toInt(balance));

  const lots: { ms: number; pts: number; rem: number }[] = [];
  for (const r of rows ?? []) {
    if (!(EARN_TYPES as readonly string[]).includes(r.type ?? "earn")) continue;
    if (r.cleared === true || r.expired === true) continue;
    const pts = toInt(r.points_earned);
    if (pts <= 0) continue;
    lots.push({ ms: toMs(r.expires_at), pts, rem: 0 });
  }

  // เติมยอดคงเหลือลงก้อนที่หมดอายุช้าสุดก่อน (ไม่มีวันหมดอายุ = Infinity อยู่หน้าสุด)
  lots.sort((a, b) => b.ms - a.ms);
  let left = bal, openEarned = 0;
  for (const l of lots) {
    openEarned += l.pts;
    l.rem = Math.min(l.pts, left);
    left -= l.rem;
  }

  let dueNow = 0, soon = 0, soonEarliestMs = Infinity;
  for (const l of lots) {
    if (l.rem <= 0) continue;
    if (l.ms <= now) dueNow += l.rem;
    else if (l.ms <= until) {
      soon += l.rem;
      if (l.ms < soonEarliestMs) soonEarliestMs = l.ms;
    }
  }

  return {
    balance: bal,
    openEarned,
    dueNow,
    soon,
    soonEarliest: Number.isFinite(soonEarliestMs) ? new Date(soonEarliestMs).toISOString() : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  ส่วนที่คุยกับฐานข้อมูล — รับ Db เข้ามา (ของจริง = lib/db.ts, ตอนเทสต์ = Postgres ในเครื่อง tests/pg.mjs)
// ─────────────────────────────────────────────────────────────────────────────

/** กันลูปวิ่งไม่จบ — สมาชิกหนึ่งคนไม่ควรมีก้อนแต้มเปิดอยู่เกินนี้ */
const LEDGER_ROW_CAP = 20000;
/** cron หนึ่งรอบประมวลผลสมาชิกไม่เกินนี้ (ที่เหลือรอรอบถัดไป — รันซ้ำได้ ไม่หักเกิน) */
export const EXPIRE_USERS_PER_RUN = 500;
/** namespace ของ advisory lock เรื่องตัดแต้ม (คู่กับ user id) */
const LOCK_NS = 4242;

/** ก้อนแต้มที่ยังเปิดอยู่ของสมาชิกหนึ่งคน */
export async function readLedger(db: Db, userId: number): Promise<LedgerRow[]> {
  const rows = await db.query(
    `SELECT type, points_earned, expires_at, cleared, expired
       FROM transactions
      WHERE user_id = $1 AND cleared = FALSE AND expired = FALSE AND type = 'earn'
      ORDER BY id
      LIMIT ${LEDGER_ROW_CAP}`,
    [userId],
  );
  return rows as unknown as LedgerRow[];
}

/** ภาพรวมของสมาชิกหนึ่งคน ณ เวลาหนึ่ง (อ่านอย่างเดียว) */
export async function ledgerViewFor(db: Db, userId: number, balance: number, windowDays: number, now: number = Date.now()): Promise<LedgerView> {
  return viewLedger(await readLedger(db, userId), balance, now, windowDays);
}

/** สมาชิกที่มีก้อนครบกำหนดแต่ยังไม่ถูกประมวลผล */
export async function usersWithDueLots(db: Db, now: number = Date.now(), limit: number = EXPIRE_USERS_PER_RUN): Promise<number[]> {
  const rows = await db.query(
    `SELECT DISTINCT user_id
       FROM transactions
      WHERE type = 'earn' AND expired = FALSE AND cleared = FALSE
        AND expires_at IS NOT NULL AND expires_at <= $1::timestamptz
      ORDER BY user_id
      LIMIT $2`,
    [new Date(now).toISOString(), limit],
  );
  return rows.map(r => Number(r.user_id));
}

export interface ExpireResult {
  userId: number;
  expired: number;
  /** false = บัญชีเปลี่ยนระหว่างคำนวณ (แลกของ/ได้แต้มใหม่/รอบอื่นตัดไปก่อน) — ไม่ได้เขียนอะไร รอบหน้าคิดใหม่เอง */
  applied: boolean;
  balanceAfter: number | null;
  lineUserId: string | null;
  firstName: string | null;
}

// เขียนทุกอย่างในคำสั่งเดียว หลังได้ล็อกของสมาชิกคนนี้แล้ว
//   guard = แต้มคงเหลือ + ผลรวมก้อนที่เปิดอยู่ ยังเท่ากับตอนคำนวณ → ถ้าไม่เท่า ไม่เขียนอะไรเลย
//   $1 user · $2 เวลาที่ใช้คำนวณ · $3 แต้มคงเหลือตอนคำนวณ · $4 ผลรวมก้อนเปิดตอนคำนวณ · $5 จำนวนที่จะตัด
const EXPIRE_SQL = `
  WITH cur AS (
    SELECT
      (SELECT points FROM users WHERE id = $1) AS bal,
      COALESCE((SELECT SUM(points_earned) FROM transactions
                 WHERE user_id = $1 AND type = 'earn' AND cleared = FALSE AND expired = FALSE
                   AND points_earned > 0), 0)::int AS open_earned
  ),
  guard AS (SELECT 1 AS ok FROM cur WHERE bal = $3 AND open_earned = $4),
  ins AS (
    INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note)
    SELECT $1, 0, $5::int, 'expire', 'แต้มหมดอายุ 1 ปี'
      FROM guard WHERE $5::int > 0
    RETURNING points_earned
  ),
  mark AS (
    UPDATE transactions SET expired = TRUE
     WHERE user_id = $1 AND type = 'earn' AND expired = FALSE AND cleared = FALSE
       AND expires_at IS NOT NULL AND expires_at <= $2::timestamptz
       AND EXISTS (SELECT 1 FROM guard)
    RETURNING id
  )
  UPDATE users
     SET points = GREATEST(points - COALESCE((SELECT SUM(points_earned) FROM ins), 0), 0)
   WHERE id = $1
  RETURNING points AS balance_after,
            (SELECT COUNT(*) FROM guard)::int AS applied,
            COALESCE((SELECT SUM(points_earned) FROM ins), 0)::int AS expired`;

/**
 * ตัดแต้มหมดอายุของสมาชิกหนึ่งคนแบบปลอดภัย
 * 1) อ่านแต้มคงเหลือ + ก้อนที่เปิดอยู่ แล้วคำนวณด้วย "ตอนนี้" ค่าเดียว (ส่งเวลาเดียวกันเข้า SQL ด้วย ไม่พึ่ง NOW())
 * 2) เขียนใน transaction เดียว: ล็อกสมาชิกคนนี้ → ตรวจว่าบัญชียังเหมือนตอนคำนวณ → ค่อยบันทึก/หัก/มาร์ก
 *    ถ้ามีรอบอื่นตัดไปก่อน หรือลูกค้าแลกของ/ได้แต้มระหว่างนั้น → ไม่เขียนอะไรเลย (รอบหน้าคิดใหม่ถูกเอง)
 */
export async function expireUserPoints(db: Db, userId: number, now: number = Date.now()): Promise<ExpireResult> {
  const users = await db.query(`SELECT points, line_user_id, first_name FROM users WHERE id = $1`, [userId]);
  const u = users[0];
  if (!u) return { userId, expired: 0, applied: false, balanceAfter: null, lineUserId: null, firstName: null };

  const v = viewLedger(await readLedger(db, userId), Number(u.points ?? 0), now, 0);

  const [, write] = await db.tx([
    { text: `SELECT pg_advisory_xact_lock($1::int, $2::int)`, params: [LOCK_NS, userId] },
    { text: EXPIRE_SQL, params: [userId, new Date(now).toISOString(), Number(u.points ?? 0), v.openEarned, v.dueNow] },
  ]);

  const w = write?.[0] ?? {};
  return {
    userId,
    expired: Number(w.expired ?? 0),
    applied: Number(w.applied ?? 0) > 0,
    balanceAfter: w.balance_after === undefined ? null : Number(w.balance_after),
    lineUserId: (u.line_user_id as string | null) ?? null,
    firstName: (u.first_name as string | null) ?? null,
  };
}
