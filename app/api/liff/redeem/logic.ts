// ตรรกะ "ขอแลกของรางวัล" — แยกออกจาก route เพื่อให้ (1) โหมดรีวิวใช้กติกาตัวเดียวกับของจริง
// (2) ทดสอบได้ด้วย node ตรง ๆ โดยไม่ต้องต่อฐานข้อมูลจริง (ดู tests/redeem-guard.test.ts)
//
// บั๊กเดิม: route เช็คแค่ `user.points >= reward.points_required` ของใบที่กำลังกด และไม่เคยดู stock เลย
//   → ช่างที่มี 1,000 แต้ม กดแลกของ 800 แต้ม 3 ชิ้นรวดได้หมด ทุกใบได้ LINE ว่า "มารับที่ร้านได้เลยค่ะ"
//     แล้วไปเถียงกันหน้าเคาน์เตอร์ · ของเหลือ 1 ชิ้นก็สร้างคำขอได้หลายใบ แล้วยืนยันเกินจำนวนจริง
//
// กติกาที่ถูก (ต้องตรงกับฝั่งแอดมิน app/api/admin/redemptions/logic.ts ที่หักแต้ม + ลด stock ตอนยืนยัน):
//   แต้มที่ใช้ได้ = users.points − ผลรวม points_required ของคำขอที่ยัง pending ของสมาชิกคนนั้น
//   ของที่ใช้ได้  = rewards.stock − จำนวนคำขอที่ยัง pending ของรางวัลชิ้นนั้น (stock = NULL คือไม่จำกัดจำนวน)
// ไม่ได้เปลี่ยนกติกาแต้ม/ระดับ/ส่วนลด — แค่บังคับให้ "แต้มที่จองไว้แล้ว" ถูกนับตามที่ควรเป็น

export type SqlRow = Record<string, unknown>;
export type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<SqlRow[]>;

export interface RedeemUser { id: number; points: number }
export interface RedeemReward { id: number; name: string; points_required: number; stock: number | null }

/** ตัวเลขทุกตัวที่ใช้ตัดสิน — ฝั่งจริงอ่านจากฐานข้อมูล ฝั่งโหมดรีวิวป้อนจากข้อมูลจำลอง */
export interface RedeemFacts {
  user: RedeemUser | null;
  reward: RedeemReward | null;
  /** ผลรวม points_required ของคำขอ pending ทั้งหมดของสมาชิกคนนี้ (รวมทุกของรางวัล) */
  pendingPoints: number;
  /** จำนวนคำขอ pending ของ "สมาชิกคนนี้ + ของรางวัลชิ้นนี้" — มีแล้วห้ามขอซ้ำ */
  samePending: number;
  /** จำนวนคำขอ pending ของ "ของรางวัลชิ้นนี้" ทุกคนรวมกัน = จำนวนที่ถูกจองไว้ */
  rewardPending: number;
}

export type RedeemErrorCode =
  | "NOT_REGISTERED" | "REWARD_NOT_FOUND" | "REWARD_OUT_OF_STOCK"
  | "NOT_ENOUGH_POINTS" | "DUPLICATE_REQUEST" | "RACE_LOST";

export type RedeemDecision =
  | { ok: true; available: number; availableAfter: number; stockLeft: number | null }
  | { ok: false; code: RedeemErrorCode; error: string };

const n = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));

/**
 * ด่านตัดสินเดียวของทั้งระบบ — ทั้ง route จริงและโหมดรีวิวเรียกตัวนี้ จะได้ไม่เพี้ยนคนละทาง
 * ลำดับข้อความ: ขอซ้ำ → ของหมด/ถูกจองหมด → แต้มไม่พอ (บอกด้วยว่าถูกจองไว้เท่าไหร่)
 */
export function decideRedemption(f: RedeemFacts): RedeemDecision {
  if (!f.user) return { ok: false, code: "NOT_REGISTERED", error: "ไม่พบสมาชิก" };
  if (!f.reward) return { ok: false, code: "REWARD_NOT_FOUND", error: "ไม่พบของรางวัล" };

  const required = n(f.reward.points_required);
  const points = n(f.user.points);
  const pending = Math.max(0, n(f.pendingPoints));

  if (n(f.samePending) > 0) {
    return { ok: false, code: "DUPLICATE_REQUEST", error: "คุณมีคำขอแลกรางวัลนี้รออยู่แล้ว รอพนักงานยืนยันตอนมารับของก่อนนะคะ" };
  }

  const stock = f.reward.stock === null || f.reward.stock === undefined ? null : n(f.reward.stock);
  const reserved = Math.max(0, n(f.rewardPending));
  if (stock !== null) {
    if (stock <= 0) return { ok: false, code: "REWARD_OUT_OF_STOCK", error: "ของรางวัลหมดชั่วคราว" };
    if (stock - reserved <= 0) {
      return {
        ok: false, code: "REWARD_OUT_OF_STOCK",
        error: `ของรางวัลนี้ถูกจองครบแล้วค่ะ (เหลือ ${stock} ชิ้น มีคนขอแลกรออยู่ ${reserved} คำขอ) รอรอบของเข้าถัดไปนะคะ`,
      };
    }
  }

  const available = points - pending;
  if (available < required) {
    const error = pending > 0
      ? `แต้มที่ใช้ได้ไม่พอค่ะ · มี ${points.toLocaleString()} แต้ม ถูกจองไว้กับคำขอที่รอรับของอยู่ ${pending.toLocaleString()} แต้ม เหลือใช้ได้ ${Math.max(0, available).toLocaleString()} แต้ม (ของชิ้นนี้ใช้ ${required.toLocaleString()} แต้ม)`
      : `แต้มไม่พอค่ะ · มี ${points.toLocaleString()} แต้ม ของชิ้นนี้ใช้ ${required.toLocaleString()} แต้ม (ขาดอีก ${(required - points).toLocaleString()} แต้ม)`;
    return { ok: false, code: "NOT_ENOUGH_POINTS", error };
  }

  return {
    ok: true,
    available,
    availableAfter: available - required,
    stockLeft: stock === null ? null : stock - reserved - 1,
  };
}

// ---------------------------------------------------------------- ฝั่งฐานข้อมูล

let schemaReady: Promise<void> | null = null;
/** ใช้ในเทสต์เท่านั้น — ล้างแคชว่าเคยสร้างตาราง/ดัชนีไปแล้ว */
export function resetSchemaCache() { schemaReady = null; }

async function ensureSchema(sql: SqlTag): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS redemption_requests (
          id           SERIAL PRIMARY KEY,
          user_id      INT NOT NULL,
          reward_id    INT NOT NULL,
          points_required INT NOT NULL,
          status       TEXT NOT NULL DEFAULT 'pending',
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          confirmed_at TIMESTAMPTZ
        )
      `;
      // ด่านสุดท้ายระดับฐานข้อมูล: 1 คน 1 ของรางวัล มีคำขอค้างได้ใบเดียว แม้กดรัวพร้อมกันหลายเครื่อง
      // ถ้าข้อมูลเดิมมีคำขอซ้ำค้างอยู่ (จากบั๊กเดิม) คำสั่งนี้จะล้ม — ปล่อยผ่าน ไม่งั้นทั้งร้านแลกของไม่ได้
      try {
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS redemption_requests_one_pending
          ON redemption_requests (user_id, reward_id) WHERE status = 'pending'
        `;
      } catch (e) {
        console.error("[redeem] สร้างดัชนีกันคำขอซ้ำไม่ได้ (น่าจะมีคำขอซ้ำค้างอยู่ก่อนหน้า):", e);
      }
    })();
    schemaReady.catch(() => { schemaReady = null; });
  }
  await schemaReady;
}

function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  const msg = e instanceof Error ? e.message : String(e);
  return code === "23505" || /duplicate key|redemption_requests_one_pending/i.test(msg);
}

export interface RedeemContext {
  user: SqlRow;
  reward: SqlRow;
  facts: RedeemFacts;
}

export type RedeemFailure = { ok: false; code: RedeemErrorCode; error: string };

export type CreateRedemptionResult =
  | { ok: true; requestId: number; user: SqlRow; reward: SqlRow; decision: Extract<RedeemDecision, { ok: true }> }
  | RedeemFailure;

/** อ่านตัวเลขที่ใช้ตัดสินทั้งหมด (คำขอ pending ของคนนี้ + จำนวนที่ถูกจองของรางวัลชิ้นนี้) */
export async function readRedeemFacts(
  sql: SqlTag, lineUserId: string, rewardId: number,
): Promise<RedeemContext | RedeemFailure> {
  const userRows = await sql`
    SELECT id, points, first_name, last_name, display_name, phone
    FROM users WHERE line_user_id = ${lineUserId} LIMIT 1
  `;
  const user = userRows[0];
  if (!user) return { ok: false, code: "NOT_REGISTERED", error: "ไม่พบสมาชิก" };

  const rewardRows = await sql`
    SELECT id, name, points_required, stock
    FROM rewards WHERE id = ${rewardId} AND active = TRUE LIMIT 1
  `;
  const reward = rewardRows[0];
  if (!reward) return { ok: false, code: "REWARD_NOT_FOUND", error: "ไม่พบของรางวัล" };

  const userId = n(user.id);
  const aggRows = await sql`
    SELECT
      COALESCE(SUM(points_required) FILTER (WHERE user_id = ${userId}), 0)::int      AS pending_points,
      (COUNT(*) FILTER (WHERE user_id = ${userId} AND reward_id = ${rewardId}))::int AS same_pending,
      (COUNT(*) FILTER (WHERE reward_id = ${rewardId}))::int                         AS reward_pending
    FROM redemption_requests
    WHERE status = 'pending' AND (user_id = ${userId} OR reward_id = ${rewardId})
  `;
  const agg = aggRows[0] ?? {};

  return {
    user, reward,
    facts: {
      user: { id: userId, points: n(user.points) },
      reward: {
        id: n(reward.id),
        name: String(reward.name ?? ""),
        points_required: n(reward.points_required),
        stock: reward.stock === null || reward.stock === undefined ? null : n(reward.stock),
      },
      pendingPoints: n(agg.pending_points),
      samePending: n(agg.same_pending),
      rewardPending: n(agg.reward_pending),
    },
  };
}

/**
 * สร้างคำขอแลก — ผ่านด่าน 3 ชั้น เพราะ Neon ต่อแบบ HTTP คิวรีละ 1 transaction คร่อม BEGIN…COMMIT หลายคิวรีไม่ได้
 *   ชั้น 1  decideRedemption จากตัวเลขที่เพิ่งอ่าน → ได้ข้อความบอกลูกค้าตรง ๆ ว่าติดอะไร
 *   ชั้น 2  INSERT … SELECT … WHERE <เงื่อนไขครบ> คำสั่งเดียว → อ่านกับเขียนอยู่ในคำสั่งเดียวกัน
 *           ไม่มีช่องให้ใบอื่นแทรกระหว่าง "เช็คแล้ว" กับ "เขียนแล้ว" แบบโค้ดเดิม + ดัชนี unique กันใบซ้ำ
 *   ชั้น 3  อ่านซ้ำหลังเขียน ตัดสินด้วยลำดับ id (ใบที่ id น้อยกว่าได้สิทธิ์ก่อนเสมอ)
 *           ใบที่ลำดับเกินโควตาลบตัวเองทิ้งก่อนส่ง LINE — กันกรณีสองใบยิงพร้อมกันจนต่างคนต่างมองไม่เห็นกัน
 */
export async function createRedemptionRequest(
  sql: SqlTag, lineUserId: string, rewardId: number,
): Promise<CreateRedemptionResult> {
  await ensureSchema(sql);

  const ctx = await readRedeemFacts(sql, lineUserId, rewardId);
  if ("ok" in ctx) return ctx;
  const { user, reward, facts } = ctx;

  const decision = decideRedemption(facts);
  if (!decision.ok) return decision;

  const userId = n(user.id);
  let inserted: SqlRow[];
  try {
    inserted = await sql`
      INSERT INTO redemption_requests (user_id, reward_id, points_required)
      SELECT u.id, rw.id, rw.points_required
      FROM users u
      JOIN rewards rw ON rw.id = ${rewardId} AND rw.active = TRUE
      WHERE u.id = ${userId}
        AND NOT EXISTS (
          SELECT 1 FROM redemption_requests d
          WHERE d.user_id = u.id AND d.reward_id = rw.id AND d.status = 'pending'
        )
        AND (rw.stock IS NULL OR rw.stock > (
          SELECT COUNT(*) FROM redemption_requests s
          WHERE s.reward_id = rw.id AND s.status = 'pending'
        ))
        AND u.points - COALESCE((
          SELECT SUM(p.points_required) FROM redemption_requests p
          WHERE p.user_id = u.id AND p.status = 'pending'
        ), 0) >= rw.points_required
      RETURNING id, points_required
    `;
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, code: "DUPLICATE_REQUEST", error: "คุณมีคำขอแลกรางวัลนี้รออยู่แล้ว รอพนักงานยืนยันตอนมารับของก่อนนะคะ" };
    }
    throw e;
  }

  if (inserted.length === 0) {
    return { ok: false, code: "RACE_LOST", error: "มีคำขออื่นตัดหน้าไปพอดีค่ะ ยังไม่ได้ทำรายการให้ กรุณากดใหม่อีกครั้ง" };
  }
  const requestId = n(inserted[0].id);

  // ชั้น 3 — อ่านสถานะจริงหลังเขียน ใบที่ "ลำดับเกินโควตา" ต้องถอยออกก่อนที่ลูกค้าจะได้ LINE
  const checkRows = await sql`
    SELECT
      u.points::int AS points,
      rw.stock      AS stock,
      COALESCE((SELECT SUM(a.points_required) FROM redemption_requests a
                 WHERE a.user_id = u.id AND a.status = 'pending' AND a.id <= ${requestId}), 0)::int AS points_upto,
      (SELECT COUNT(*) FROM redemption_requests b
         WHERE b.reward_id = rw.id AND b.status = 'pending' AND b.id <= ${requestId})::int          AS stock_upto
    FROM users u
    JOIN rewards rw ON rw.id = ${rewardId}
    WHERE u.id = ${userId}
  `;
  const chk = checkRows[0];
  const overPoints = !!chk && n(chk.points_upto) > n(chk.points);
  const overStock = !!chk && chk.stock !== null && chk.stock !== undefined && n(chk.stock_upto) > n(chk.stock);
  if (!chk || overPoints || overStock) {
    await sql`DELETE FROM redemption_requests WHERE id = ${requestId} AND status = 'pending'`;
    const stockOnly = overStock && !overPoints;
    return {
      ok: false,
      code: stockOnly ? "REWARD_OUT_OF_STOCK" : "RACE_LOST",
      error: stockOnly
        ? "ของรางวัลชิ้นสุดท้ายเพิ่งถูกจองไปพอดีค่ะ ยังไม่ได้ทำรายการให้"
        : "มีคำขออื่นตัดหน้าไปพอดีค่ะ ยังไม่ได้ทำรายการให้ กรุณากดใหม่อีกครั้ง",
    };
  }

  return { ok: true, requestId, user, reward, decision };
}

/** รายการคำขอที่ยังค้าง + แต้มที่ใช้ได้จริง — ให้หน้าเว็บเอาไปแสดงว่าทำไมกดแลกไม่ได้ */
export interface PendingSummary {
  points: number;
  pending_points: number;
  available_points: number;
  pending: { id: number; reward_id: number; reward_name: string | null; points_required: number; created_at: unknown }[];
  /** ของรางวัลชิ้นไหนถูกจองไว้กี่ใบ (รวมทุกสมาชิก) — ของที่ยังแลกได้จริง = stock − ค่านี้ */
  reserved_by_reward: Record<string, number>;
  /** บัญชีของผู้ใช้เองผูกรหัสลูกค้าแล้วหรือยัง (ยังไม่ผูก = ซื้อแล้วแต้มไม่เข้า) — เป็นสถานะของตัวเอง ไม่เผยข้อมูลใคร */
  earns_points: boolean;
}

export async function readPendingSummary(sql: SqlTag, lineUserId: string): Promise<PendingSummary | null> {
  await ensureSchema(sql);
  const userRows = await sql`SELECT id, points, customer_id FROM users WHERE line_user_id = ${lineUserId} LIMIT 1`;
  const user = userRows[0];
  if (!user) return null;
  const userId = n(user.id);
  const rows = await sql`
    SELECT r.id, r.reward_id, r.points_required, r.created_at, rw.name AS reward_name
    FROM redemption_requests r
    LEFT JOIN rewards rw ON rw.id = r.reward_id
    WHERE r.user_id = ${userId} AND r.status = 'pending'
    ORDER BY r.id ASC
  `;
  const pending = rows.map(r => ({
    id: n(r.id),
    reward_id: n(r.reward_id),
    reward_name: (r.reward_name as string | null) ?? null,
    points_required: n(r.points_required),
    created_at: r.created_at,
  }));
  const reservedRows = await sql`
    SELECT reward_id, (COUNT(*))::int AS reserved
    FROM redemption_requests WHERE status = 'pending'
    GROUP BY reward_id
  `;
  const reserved: Record<string, number> = {};
  for (const r of reservedRows) reserved[String(n(r.reward_id))] = n(r.reserved);

  const pendingPoints = pending.reduce((s, p) => s + p.points_required, 0);
  const points = n(user.points);
  return {
    points, pending_points: pendingPoints, available_points: points - pendingPoints,
    pending, reserved_by_reward: reserved,
    earns_points: String(user.customer_id ?? "").trim().length > 0,
  };
}
