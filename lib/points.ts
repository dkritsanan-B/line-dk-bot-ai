import { sql, db as defaultDb, type Db } from "./db";
import { viewLedger, ledgerViewFor, type LedgerRow, type LedgerView } from "./points-ledger";
import { PDPA_VERSION } from "./pdpa";

const POINTS_PER_BAHT = 100;

export const TIERS = [
  { name: "Diamond",  emoji: "💎", min: 10000, cardGrad: "linear-gradient(135deg, #0D47A1 0%, #1565C0 45%, #82B1FF 100%)" },
  { name: "Platinum", emoji: "🔱", min: 5000,  cardGrad: "linear-gradient(135deg, #37474F 0%, #607D8B 45%, #CFD8DC 100%)" },
  { name: "Gold",     emoji: "🥇", min: 2000,  cardGrad: "linear-gradient(135deg, #F57F17 0%, #FFD600 50%, #F9A825 100%)" },
  { name: "Silver",   emoji: "🥈", min: 500,   cardGrad: "linear-gradient(135deg, #37474F 0%, #78909C 50%, #B0BEC5 100%)" },
  { name: "Bronze",   emoji: "🥉", min: 100,   cardGrad: "linear-gradient(135deg, #6D4C41 0%, #A1887F 50%, #D7A27C 100%)" },
  { name: "Welcome",  emoji: "👋", min: 0,     cardGrad: "linear-gradient(135deg, #455A64 0%, #607D8B 50%, #90A4AE 100%)" },
] as const;

export type Tier = typeof TIERS[number];

export function getTierFromPoints(points: number): Tier {
  return TIERS.find(t => points >= t.min) ?? TIERS[TIERS.length - 1];
}

export function getEffectiveTier(totalEarned: number, currentPoints: number, lastPurchaseAt: string | null): Tier {
  const isActive = lastPurchaseAt !== null &&
    Date.now() - new Date(lastPurchaseAt).getTime() < 365 * 24 * 60 * 60 * 1000;
  return getTierFromPoints(isActive ? totalEarned : currentPoints);
}

export function getNextTier(tier: Tier): Tier | null {
  const idx = TIERS.findIndex(t => t.name === tier.name);
  return idx > 0 ? TIERS[idx - 1] : null;
}

export interface User {
  id: number;
  line_user_id: string | null;
  phone: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  birthday: string | null;
  points: number;
  total_earned: number;
  last_purchase_at: string | null;
  created_at: string;
  /** PDPA: เวลาที่ติ๊กยอมรับนโยบาย (NULL = สมาชิกเก่าที่สมัครก่อนมีระบบนี้) */
  pdpa_consent_at?: string | null;
  pdpa_version?: string | null;
}

export async function migrateDB() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name             TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name              TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS company                TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday               DATE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id            TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS suggested_customer_id  TEXT`;   // บอทเดารหัส Hero จากเบอร์ → พนักงานกดยืนยันเอง (ไม่ผูกอัตโนมัติ กันสวมเบอร์คนอื่น)
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS backfill_from           DATE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS backfill_done_at        TIMESTAMPTZ`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_earned           INT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_purchase_at       TIMESTAMPTZ`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS notified_inactive_11m  BOOLEAN NOT NULL DEFAULT FALSE`;
  // PDPA (18 ก.ย. 69): เวลาที่สมาชิกติ๊กยอมรับนโยบายความเป็นส่วนตัว + ฉบับของนโยบาย (lib/pdpa.ts)
  // สมาชิกที่สมัครก่อนมีช่องนี้ = NULL ใช้งานต่อได้ตามปกติ (ไม่บล็อก)
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pdpa_consent_at        TIMESTAMPTZ`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS pdpa_version           TEXT`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS type        TEXT NOT NULL DEFAULT 'earn'`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS note        TEXT`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expired     BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notified_1m BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cleared     BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`
    UPDATE transactions
    SET expires_at = created_at + INTERVAL '1 year'
    WHERE type = 'earn' AND expires_at IS NULL
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS rewards (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      description     TEXT,
      points_required INT NOT NULL,
      image_url       TEXT,
      stock           INT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`;
  // บิลที่บอท Hero ส่งมาแล้ว "ยังให้แต้มไม่ได้" เพราะสมาชิกยังไม่ถูกผูกรหัส (มีแค่รหัสที่ระบบเดาไว้)
  // เก็บไว้เพื่อ "บอกลูกค้า/พนักงานว่ามีบิลค้างอยู่กี่ใบ" เท่านั้น — ไม่ใช่คิวให้แต้มย้อนหลัง (เจ้าของร้านตัดสินแล้วว่าไม่นับข้อมูลเก่า)
  await sql`
    CREATE TABLE IF NOT EXISTS hero_pending_bills (
      bill_no       TEXT PRIMARY KEY,
      user_id       INT NOT NULL,
      customer_code TEXT NOT NULL,
      amount        NUMERIC NOT NULL,
      bill_date     DATE,
      seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at   TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS hero_pending_bills_user ON hero_pending_bills (user_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id            SERIAL PRIMARY KEY,
      action        TEXT NOT NULL,
      target_user_id INT,
      detail        TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // migrate total_earned จาก transactions เดิม
  await sql`
    UPDATE users u
    SET total_earned = COALESCE((
      SELECT SUM(t.points_earned)
      FROM transactions t
      WHERE t.user_id = u.id AND t.type = 'earn' AND t.cleared = FALSE
    ), 0)
    WHERE total_earned = 0
  `;
  // migrate last_purchase_at จาก transactions เดิม
  await sql`
    UPDATE users u
    SET last_purchase_at = (
      SELECT MAX(t.created_at)
      FROM transactions t
      WHERE t.user_id = u.id AND t.type = 'earn' AND t.cleared = FALSE
    )
    WHERE last_purchase_at IS NULL
  `;
}

export async function getUserByPhone(phone: string): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE phone = ${phone} LIMIT 1`;
  return (rows[0] as User) ?? null;
}

export async function getUserByLineId(lineUserId: string): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE line_user_id = ${lineUserId} LIMIT 1`;
  return (rows[0] as User) ?? null;
}

export async function registerUser(
  lineUserId: string,
  phone: string,
  displayName?: string,
  firstName?: string,
  lastName?: string,
  company?: string,
  birthday?: string,
  opts: { consent?: boolean; database?: Db } = {},
): Promise<{ isNew: boolean }> {
  // กติกาตัวตน (14 ก.ย. 69): 1 คน = 1 บัญชี LINE = 1 เบอร์
  //  - LINE นี้เคยสมัครแล้ว → แก้ข้อมูล/เปลี่ยนเบอร์ของตัวเองได้ (เบอร์ใหม่ต้องไม่ซ้ำคนอื่น)
  //  - เบอร์นี้มีเจ้าของที่ผูก LINE อื่นอยู่ → ปฏิเสธ (เดิมเขียนทับ line_user_id = ใครรู้เบอร์ก็ยึดบัญชี/แต้มคนอื่นได้) → ให้พนักงานปลด LINE เก่าในหน้าแอดมินก่อน
  //  - เบอร์นี้มีในระบบแต่ยังไม่ผูก LINE (พนักงานสร้างให้/ถูกปลด) → รับ LINE นี้เข้าไป (เปลี่ยนเครื่อง/เปลี่ยน LINE ทำแบบนี้)
  // PDPA (18 ก.ย. 69): การสมัคร (สร้างใหม่ / รับ LINE เข้าเบอร์เดิม) ต้องมี consent:true เสมอ → บันทึกเวลา + ฉบับนโยบาย
  //  สมาชิกที่สมัครแล้วแก้ข้อมูลตัวเอง ไม่ต้องติ๊กซ้ำ (สมาชิกเก่าก่อนมีระบบนี้ต้องใช้งานต่อได้)
  const database = opts.database ?? defaultDb;
  const consent = opts.consent === true;
  const [mine] = (await database.query(`SELECT * FROM users WHERE line_user_id = $1 LIMIT 1`, [lineUserId])) as unknown as User[];
  const [byPhone] = (await database.query(`SELECT * FROM users WHERE phone = $1 LIMIT 1`, [phone])) as unknown as User[];
  const common = [displayName ?? null, firstName ?? null, lastName ?? null, company ?? null, birthday ?? null];
  if (mine) {
    if (byPhone && byPhone.id !== mine.id) throw new RegisterError("เบอร์นี้เป็นของสมาชิกท่านอื่นแล้ว กรุณาติดต่อพนักงานที่ร้านค่ะ");
    await database.query(
      `UPDATE users SET phone = $1, display_name = $2, first_name = $3, last_name = $4, company = $5, birthday = $6,
         pdpa_consent_at = CASE WHEN $7::boolean THEN NOW() ELSE pdpa_consent_at END,
         pdpa_version    = CASE WHEN $7::boolean THEN $8 ELSE pdpa_version END
       WHERE id = $9`,
      [phone, ...common, consent, PDPA_VERSION, mine.id],
    );
    return { isNew: false };
  }
  if (!consent) throw new ConsentError();
  if (byPhone) {
    if (byPhone.line_user_id && byPhone.line_user_id !== lineUserId) throw new RegisterError("เบอร์นี้ผูกกับบัญชี LINE อื่นอยู่แล้ว ถ้าเปลี่ยน LINE ใหม่ กรุณาแจ้งพนักงานที่ร้านให้ปลดบัญชีเดิมก่อนค่ะ");
    await database.query(
      `UPDATE users SET line_user_id = $1, display_name = $2, first_name = $3, last_name = $4, company = $5, birthday = $6,
         pdpa_consent_at = NOW(), pdpa_version = $7
       WHERE id = $8`,
      [lineUserId, ...common, PDPA_VERSION, byPhone.id],
    );
    return { isNew: false };
  }
  await database.query(
    `INSERT INTO users (line_user_id, phone, display_name, first_name, last_name, company, birthday, pdpa_consent_at, pdpa_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
    [lineUserId, phone, ...common, PDPA_VERSION],
  );
  return { isNew: true };
}

export class RegisterError extends Error {}
/** สมัครโดยไม่ได้ติ๊กยอมรับนโยบายความเป็นส่วนตัว — route ตอบ 400 CONSENT_REQUIRED */
export class ConsentError extends Error {
  constructor() { super("ต้องยอมรับนโยบายความเป็นส่วนตัวก่อนสมัครสมาชิก"); }
}

// ให้แต้ม / หักแต้ม — คำสั่งเดียว ปรับยอดกับลงประวัติต้องเกิดคู่กันเสมอ (16 ก.ย. 69)
// เดิมเป็น 2 คำสั่งแยกกัน ถ้าคำสั่งที่สองล้ม ยอดแต้มจะเปลี่ยนโดยไม่มีประวัติ (และตัวตัดแต้มหมดอายุไม่รู้ว่าแต้มก้อนนั้นอยู่ไหน)
// ยอดที่คืนกลับมาอ่านจากแถวหลังแก้ ไม่ใช่เอาค่าที่อ่านไว้ก่อนมาบวกลบเอง

export async function addPoints(
  phone: string,
  purchaseAmount: number,
  note?: string,
  database: Db = defaultDb,
): Promise<{ pointsEarned: number; totalPoints: number } | null> {
  const pointsEarned = Math.floor(purchaseAmount / POINTS_PER_BAHT);
  if (!(pointsEarned > 0)) return null;

  const rows = await database.query(
    `WITH u AS (
       UPDATE users SET
         points                = points + $2,
         total_earned          = total_earned + $2,
         last_purchase_at      = NOW(),
         notified_inactive_11m = FALSE
        WHERE phone = $1
       RETURNING id, points
     ), t AS (
       INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note, expires_at)
       SELECT id, $3, $2, 'earn', $4, NOW() + INTERVAL '1 year' FROM u
       RETURNING id
     )
     SELECT points FROM u`,
    [phone, pointsEarned, purchaseAmount, note ?? null],
  );
  if (!rows[0]) return null;
  return { pointsEarned, totalPoints: Number(rows[0].points) };
}

/** หักแต้ม (แอดมินหักเอง) — ไม่พบสมาชิก / แต้มไม่พอ / จำนวนไม่ถูกต้อง = null และไม่เขียนอะไรเลย · แต้มไม่มีทางติดลบ */
export async function deductPoints(
  phone: string,
  points: number,
  note?: string,
  database: Db = defaultDb,
): Promise<{ pointsDeducted: number; totalPoints: number } | null> {
  const pts = Math.trunc(Number(points));
  if (!(pts > 0)) return null;

  const rows = await database.query(
    `WITH u AS (
       UPDATE users SET points = points - $2
        WHERE phone = $1 AND points >= $2
       RETURNING id, points
     ), t AS (
       INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note)
       SELECT id, 0, $2, 'redeem', $3 FROM u
       RETURNING id
     )
     SELECT points FROM u`,
    [phone, pts, note ?? null],
  );
  if (!rows[0]) return null;
  return { pointsDeducted: pts, totalPoints: Number(rows[0].points) };
}

// ─────────────────────────────────────────────────────────────────────────────
// "แต้มที่กำลังจะหมดอายุ" — กติกาเดียวของทั้งระบบ
//
// เดิมคิดกัน 2 ที่ไม่ตรงกัน: /api/member รวม "ทุกก้อนที่ยังไม่หมดอายุ" (ไกลอีก 11 เดือนก็นับ)
// แล้วเอาไปโชว์คู่กับวันหมดอายุที่ใกล้ที่สุด → บัตรขึ้นว่า "2,000 แต้ม จะหมดอายุ อีก 21 วัน"
// ทั้งที่ก้อนที่จะหมดจริงใน 21 วันมีแค่ 50 แต้ม · ส่วน cron แจ้งเตือนกรอง 31 วันไว้ถูกแล้ว
// ตั้งแต่ 16 ก.ย. 69 ทั้งสองที่เรียกฟังก์ชันในไฟล์นี้ ห้ามเขียนคิวรีนับแต้มใกล้หมดอายุที่อื่นอีก
// ─────────────────────────────────────────────────────────────────────────────

/** ช่วงที่ถือว่า "ใกล้หมดอายุ" — เท่ากับรอบแจ้งเตือน LINE (เดิมฝังเลข 31 ไว้ในคิวรี cron) */
export const EXPIRY_NOTICE_DAYS = 31;

const DAY_MS = 86400000;

export interface ExpiryLot {
  points_earned: number;
  expires_at: string | Date | null;
  type?: string;
  expired?: boolean;
  cleared?: boolean;
}

export interface ExpirySummary {
  earliest_expiry: string | null;
  expiring_points: number;
}

export const NO_EXPIRY: ExpirySummary = { earliest_expiry: null, expiring_points: 0 };

const asIso = (v: string | Date): string => (typeof v === "string" ? v : v.toISOString());

/**
 * ตัวปิดท้ายของทุกทาง — แต้มที่จะหมดอายุต้องไม่เกินแต้มที่ลูกค้ามีอยู่จริง
 * (แลกของรางวัลแล้วก้อนเก่ายังอยู่ครบในตาราง ดูหมายเหตุ FIFO ท้ายไฟล์)
 * ถ้าเหลือ 0 ให้ถือว่า "ไม่มีอะไรจะหมด" เพื่อไม่ให้ขึ้นกล่องเตือน 0 แต้ม
 */
export function capExpiring(rawPoints: number, earliest: string | Date | null, currentPoints: number): ExpirySummary {
  const raw = Math.trunc(Number(rawPoints) || 0);
  const bal = Math.trunc(Number(currentPoints) || 0);
  const pts = Math.max(0, Math.min(raw, bal));
  if (pts <= 0 || !earliest) return { ...NO_EXPIRY };
  return { earliest_expiry: asIso(earliest), expiring_points: pts };
}

/**
 * แต้มใกล้หมดอายุจากข้อมูลที่อยู่ในมือแล้ว (โหมดรีวิว / เทสต์) — ใช้สูตร FIFO ตัวเดียวกับของจริง (lib/points-ledger.ts)
 * รับได้ทั้งแถว earn อย่างเดียว หรือบัญชีเต็ม (earn + redeem/expire/adjust) · แถวไม่ระบุ type ถือเป็น earn
 */
export function summarizeExpiring(
  lots: ExpiryLot[],
  currentPoints: number,
  now: number = Date.now(),
  windowDays: number = EXPIRY_NOTICE_DAYS,
): ExpirySummary {
  const rows: LedgerRow[] = (lots ?? []).map(l => ({
    type: l.type ?? "earn",
    points_earned: l.points_earned,
    expires_at: l.expires_at,
    cleared: l.cleared ?? false,
    expired: l.expired ?? false,
  }));
  return fromView(viewLedger(rows, currentPoints, now, windowDays));
}

function fromView(v: LedgerView): ExpirySummary {
  return capExpiring(v.soon, v.soonEarliest, v.soon);
}

/** แต้มใกล้หมดอายุของสมาชิกคนเดียว — ใช้บนบัตรสมาชิก (/api/member) */
export async function getExpiringSummary(
  userId: number,
  currentPoints: number,
  database: Db = defaultDb,
  now: number = Date.now(),
): Promise<ExpirySummary> {
  return fromView(await ledgerViewFor(database, userId, currentPoints, EXPIRY_NOTICE_DAYS, now));
}

export interface ExpiryNotice extends ExpirySummary {
  user_id: number;
  line_user_id: string;
  first_name: string | null;
  earliest_expiry: string;
}

/** cron แจ้งเตือนหนึ่งรอบทักได้ไม่เกินนี้ (โควตา LINE push 300/เดือน) — ที่เหลือรอรอบถัดไป */
export const NOTICE_USERS_PER_RUN = 200;

/**
 * รายชื่อคนที่ต้องส่ง LINE เตือนแต้มใกล้หมด — ใช้ที่ /api/cron/notify-expiry (สูตรเดียวกับบัตรสมาชิก)
 * SQL หาเฉพาะ "ผู้มีสิทธิ์" (มีก้อนในช่วงเตือนที่ยังไม่เคยเตือน) แล้วคิดยอดจริงด้วย FIFO ทีละคน
 * คนที่แลกของ/ใช้แต้มก้อนนั้นไปแล้วจะไม่ถูกทัก
 */
export async function listExpiryNotices(database: Db = defaultDb, now: number = Date.now()): Promise<ExpiryNotice[]> {
  const nowIso = new Date(now).toISOString();
  const candidates = await database.query(
    `SELECT u.id AS user_id, u.line_user_id, u.first_name, u.points
       FROM users u
      WHERE u.line_user_id IS NOT NULL
        AND u.points > 0
        AND EXISTS (
          SELECT 1 FROM transactions t
           WHERE t.user_id = u.id AND t.type = 'earn'
             AND t.expired = FALSE AND t.cleared = FALSE AND t.notified_1m = FALSE
             AND t.expires_at IS NOT NULL
             AND t.expires_at >  $1::timestamptz
             AND t.expires_at <= $1::timestamptz + ($2::int * INTERVAL '1 day'))
      ORDER BY u.id
      LIMIT $3`,
    [nowIso, EXPIRY_NOTICE_DAYS, NOTICE_USERS_PER_RUN],
  );
  const out: ExpiryNotice[] = [];
  for (const row of candidates) {
    const s = await getExpiringSummary(Number(row.user_id), Number(row.points ?? 0), database, now);
    // ใช้ก้อนนั้นไปแล้ว / แต้มคงเหลือไม่พอ → ไม่ต้องทัก (เปลืองโควตาและทำลูกค้างง)
    if (s.expiring_points <= 0 || !s.earliest_expiry) continue;
    out.push({
      user_id: Number(row.user_id),
      line_user_id: String(row.line_user_id),
      first_name: (row.first_name as string | null) ?? null,
      earliest_expiry: s.earliest_expiry,
      expiring_points: s.expiring_points,
    });
  }
  return out;
}

/** มาร์กว่าเตือนก้อนในช่วงนี้ไปแล้ว — ช่วงต้องเท่ากับตอนเลือก (ทั้งขอบล่างและขอบบน) ไม่งั้นเตือนซ้ำ/เตือนข้าม */
export async function markExpiryNotified(userId: number, database: Db = defaultDb, now: number = Date.now()): Promise<void> {
  const nowIso = new Date(now).toISOString();
  await database.query(
    `UPDATE transactions
        SET notified_1m = TRUE
      WHERE user_id = $1 AND type = 'earn'
        AND expired = FALSE AND cleared = FALSE
        AND expires_at IS NOT NULL
        AND expires_at >  $2::timestamptz
        AND expires_at <= $2::timestamptz + ($3::int * INTERVAL '1 day')`,
    [userId, nowIso, EXPIRY_NOTICE_DAYS],
  );
}

// ===================================================================
//  สถานะการผูกรหัสลูกค้า Hero (link state) — 16 ก.ย. 69
//
//  แต้มเข้าอัตโนมัติได้ก็ต่อเมื่อ users.customer_id ถูกผูกกับรหัสลูกค้าใน Hero แล้วเท่านั้น
//  (/api/hero/points จับบิลด้วย UPPER(TRIM(customer_id)) — ดูไฟล์นั้นประกอบ)
//  ก่อนหน้านี้คนที่ยังไม่ถูกผูกจะ "ไม่ได้แต้มแบบเงียบ ๆ" ทั้งที่จอสมัครเขียนว่าแต้มเข้าอัตโนมัติ
//  ตรงนี้คือแหล่งความจริงแหล่งเดียวที่บอกว่า "ตอนนี้บัญชีนี้ได้แต้มหรือยัง" ใช้ร่วมกันทั้ง API จริงและโหมดรีวิว
//
//  ไม่แตะกติกาแต้ม/ระดับ และไม่ให้แต้มย้อนหลังเด็ดขาด — ที่นี่แค่ "รายงานสถานะ"
// ===================================================================

export type LinkStatus = "linked" | "suggested" | "pending";

/** ค้างเกินกี่วันถือว่านานเกินไป (ใช้ตั้งธง overdue ให้พนักงานตาม — ไม่มีผลกับแต้ม) */
export const LINK_OVERDUE_DAYS = 3;

export interface LinkableUser {
  id?: number;
  customer_id?: string | null;
  suggested_customer_id?: string | null;
  created_at?: string | Date | null;
}

/** สรุปบิลที่ระบบเห็นแล้วแต่ยังให้แต้มไม่ได้ (ตาราง hero_pending_bills) — เป็นตัวเลขไว้แสดงเท่านั้น */
export interface PendingBillSummary {
  count: number;
  amount: number;
  /** แต้มที่ "จะได้ถ้าผูกรหัสทัน" — คิดด้วยกติกาเดิม (100 บาท = 1 แต้ม ปัดลงต่อบิล) ไม่ใช่แต้มที่จะจ่ายย้อนหลัง */
  estimated_points: number;
  first_bill_date: string | null;
  last_bill_date: string | null;
}

export interface LinkState {
  status: LinkStatus;
  /** ตอนนี้บิลใหม่จะเข้าแต้มอัตโนมัติไหม */
  earns_points: boolean;
  customer_id: string | null;
  suggested_customer_id: string | null;
  /** รอมากี่วันนับจากวันสมัคร (null = ไม่รู้วันสมัคร) */
  waiting_days: number | null;
  overdue: boolean;
  pending_bills: PendingBillSummary | null;
  /** ข้อความไทยสำรองให้หน้าเว็บใช้ได้ทันที (ฝั่งหน้าเว็บเขียนเองทับได้) */
  headline: string;
  detail: string;
  action: string | null;
}

/** รหัสลูกค้า Hero ให้เป็นรูปแบบเดียวกับที่ /api/hero/points ใช้จับคู่ (ตัดช่องว่าง + ตัวพิมพ์ใหญ่) · ว่าง = null */
export function normalizeCustomerCode(v: unknown): string | null {
  const s = String(v ?? "").trim().toUpperCase();
  return s.length ? s : null;
}

export function linkStatusOf(u: LinkableUser): LinkStatus {
  if (normalizeCustomerCode(u.customer_id)) return "linked";          // ผูกแล้ว (ชนะเสมอ ถึงจะมีรหัสที่เดาไว้ค้างอยู่)
  if (normalizeCustomerCode(u.suggested_customer_id)) return "suggested";
  return "pending";
}

/** รอมากี่วันนับจากวันสมัคร — วันที่เพี้ยน/อนาคต (นาฬิกาเครื่องเหลื่อม) คืน 0 ไม่คืนค่าติดลบ */
export function waitingDaysSince(createdAt: string | Date | null | undefined, now: number = Date.now()): number | null {
  if (createdAt === null || createdAt === undefined || createdAt === "") return null;
  const t = new Date(createdAt as string).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86400000));
}

export function buildLinkState(
  u: LinkableUser,
  opts: { pendingBills?: PendingBillSummary | null; now?: number } = {},
): LinkState {
  const status = linkStatusOf(u);
  const customerId = normalizeCustomerCode(u.customer_id);
  const suggested = normalizeCustomerCode(u.suggested_customer_id);
  const waiting = waitingDaysSince(u.created_at, opts.now ?? Date.now());
  const pending = status === "linked" ? null : (opts.pendingBills ?? null);

  if (status === "linked") {
    return {
      status, earns_points: true, customer_id: customerId, suggested_customer_id: null,
      waiting_days: waiting, overdue: false, pending_bills: null,
      headline: "แต้มเข้าอัตโนมัติแล้ว",
      detail: `บัญชีนี้ผูกกับรหัสลูกค้า ${customerId} เรียบร้อย ซื้อของแล้วแต้มจะเข้าเองภายในไม่กี่นาทีค่ะ`,
      action: null,
    };
  }

  const overdue = waiting !== null && waiting >= LINK_OVERDUE_DAYS;
  const missed = pending && pending.count > 0
    ? ` ตอนนี้มีบิลที่ระบบเห็นแล้วแต่ยังให้แต้มไม่ได้ ${pending.count} ใบ`
    : "";

  if (status === "suggested") {
    return {
      status, earns_points: false, customer_id: null, suggested_customer_id: suggested,
      waiting_days: waiting, overdue, pending_bills: pending,
      headline: "รอพนักงานยืนยันรหัสลูกค้า — แต้มยังไม่เข้า",
      detail: `ระบบเจอรหัสลูกค้า ${suggested} ที่เบอร์ตรงกับของคุณ แต่ต้องให้พนักงานกดยืนยันก่อน แต้มถึงจะเข้าอัตโนมัติค่ะ${missed}`,
      action: "แจ้งพนักงานที่ร้านให้กดยืนยันรหัสลูกค้าให้ค่ะ",
    };
  }

  return {
    status, earns_points: false, customer_id: null, suggested_customer_id: null,
    waiting_days: waiting, overdue, pending_bills: pending,
    headline: "ยังไม่ได้ผูกรหัสลูกค้า — แต้มยังไม่เข้า",
    detail: `บัญชีนี้ยังไม่ได้ผูกกับรหัสลูกค้าของร้าน บิลที่ซื้อไปจึงยังไม่ได้แต้มค่ะ${missed}`,
    action: "แจ้งเบอร์ที่สมัครไว้กับพนักงานหน้าร้าน ให้กดผูกรหัสลูกค้าให้ค่ะ",
  };
}

// ===================================================================
//  สิ่งที่ "ลูกค้าเห็นได้" — กรองก่อนส่งออกจาก API ฝั่ง LIFF ทุกครั้ง (16 ก.ย. 69)
//
//  ทำไมต้องกรอง: ใครก็สมัครด้วยเบอร์ของคนอื่นได้ (ระบบไม่ผูกให้ แค่ "เดา" รหัสไว้รอพนักงานยืนยัน)
//  ถ้าส่ง buildLinkState ออกไปตรง ๆ คนที่สวมเบอร์จะได้เห็น
//    1) รหัสลูกค้า Hero ของเจ้าของเบอร์ตัวจริง (suggested_customer_id และในข้อความ detail)
//    2) จำนวนบิล ยอดเงิน และวันที่ซื้อของเจ้าของเบอร์ (pending_bills)
//    3) แค่สถานะ suggested ≠ pending ก็บอกได้แล้วว่า "เบอร์นี้เป็นลูกค้าร้าน" → ไล่เดาเบอร์ได้
//  ดังนั้นฝั่งลูกค้าเห็นแค่ "ผูกแล้ว / ยังไม่ผูก" + วันที่รอ (นับจากวันสมัครของตัวเอง)
//  ข้อมูลเต็มยังใช้ได้ในแอดมิน (พนักงานล็อกอินแล้ว) ผ่าน buildLinkState ตามเดิม
// ===================================================================

export interface ClientLinkState {
  status: "linked" | "pending";
  earns_points: boolean;
  /** เฉพาะคนที่ผูกแล้ว = รหัสของตัวเอง · ยังไม่ผูก = null เสมอ */
  customer_id: string | null;
  waiting_days: number | null;
  overdue: boolean;
  headline: string;
  detail: string;
  action: string | null;
}

export function toClientLink(s: LinkState | null | undefined): ClientLinkState | null {
  if (!s) return null;
  if (s.status === "linked") {
    return {
      status: "linked", earns_points: true, customer_id: s.customer_id,
      waiting_days: s.waiting_days, overdue: false,
      headline: s.headline, detail: s.detail, action: null,
    };
  }
  // suggested กับ pending ต้องหน้าตาเหมือนกันทุกไบต์ ไม่ให้แยกออกว่าระบบเจอรหัสหรือไม่
  return {
    status: "pending", earns_points: false, customer_id: null,
    waiting_days: s.waiting_days, overdue: s.overdue,
    headline: "รอพนักงานยืนยันตัวตน — แต้มยังไม่เข้า",
    detail: "เพื่อความปลอดภัยของแต้ม พนักงานต้องยืนยันว่าเบอร์นี้เป็นของคุณจริงก่อน หลังยืนยันแล้ว บิลที่ซื้อตั้งแต่วันสมัคร (ย้อนหลังไม่เกิน 30 วัน) จะได้แต้มด้วยค่ะ",
    action: "ครั้งหน้าที่มาร้าน แจ้งพนักงานว่า \"ยืนยันสมาชิก LINE\" พร้อมบอกเบอร์ที่สมัครไว้ค่ะ",
  };
}

/** ฟิลด์ของ users ที่ห้ามส่งถึงหน้า LIFF (ภายในร้าน / ใช้สวมตัวตนได้) */
const PRIVATE_USER_FIELDS = ["suggested_customer_id", "line_user_id", "expiry_notified_at"] as const;

export function toClientUser<T extends Record<string, unknown>>(u: T | null | undefined): Omit<T, typeof PRIVATE_USER_FIELDS[number]> | null {
  if (!u) return null;
  const out: Record<string, unknown> = { ...u };
  for (const k of PRIVATE_USER_FIELDS) delete out[k];
  return out as Omit<T, typeof PRIVATE_USER_FIELDS[number]>;
}

/**
 * สรุปบิลค้างของสมาชิกคนหนึ่ง (บิลที่บอทส่งมาตอนยังไม่ผูกรหัส)
 * คืน null เมื่อไม่มีบิลค้าง หรืออ่านตารางไม่ได้ — หน้าบัตรสมาชิกต้องไม่พังเพราะเรื่องนี้
 */
export async function getPendingBillSummary(userId: number): Promise<PendingBillSummary | null> {
  try {
    const rows = await sql`
      SELECT COUNT(*)::int                                            AS count,
             COALESCE(SUM(amount), 0)::float8                         AS amount,
             COALESCE(SUM(FLOOR(amount / ${POINTS_PER_BAHT})), 0)::int AS estimated_points,
             MIN(bill_date)::text                                     AS first_bill_date,
             MAX(bill_date)::text                                     AS last_bill_date
      FROM hero_pending_bills
      WHERE user_id = ${userId} AND resolved_at IS NULL
    `;
    const r = rows[0] as { count?: number; amount?: number; estimated_points?: number; first_bill_date?: string | null; last_bill_date?: string | null } | undefined;
    const count = Number(r?.count ?? 0);
    if (!r || !count) return null;
    return {
      count,
      amount: Number(r.amount ?? 0),
      estimated_points: Number(r.estimated_points ?? 0),
      first_bill_date: r.first_bill_date ?? null,
      last_bill_date: r.last_bill_date ?? null,
    };
  } catch {
    return null;   // ตารางยังไม่ถูกสร้าง (ยังไม่เคยมีบิลค้าง) หรือฐานข้อมูลมีปัญหา — ถือว่าไม่มีบิลค้าง
  }
}

/** บิลค้างของสมาชิกทุกคนในครั้งเดียว (หน้าแอดมิน) — คืน Map ว่างถ้าอ่านตารางไม่ได้ */
export async function getPendingBillsByUser(): Promise<Map<number, PendingBillSummary>> {
  const out = new Map<number, PendingBillSummary>();
  try {
    const rows = await sql`
      SELECT user_id,
             COUNT(*)::int                                            AS count,
             COALESCE(SUM(amount), 0)::float8                         AS amount,
             COALESCE(SUM(FLOOR(amount / ${POINTS_PER_BAHT})), 0)::int AS estimated_points,
             MIN(bill_date)::text                                     AS first_bill_date,
             MAX(bill_date)::text                                     AS last_bill_date
      FROM hero_pending_bills
      WHERE resolved_at IS NULL
      GROUP BY user_id
    `;
    for (const r of rows as Record<string, unknown>[]) {
      out.set(Number(r.user_id), {
        count: Number(r.count ?? 0),
        amount: Number(r.amount ?? 0),
        estimated_points: Number(r.estimated_points ?? 0),
        first_bill_date: (r.first_bill_date as string | null) ?? null,
        last_bill_date: (r.last_bill_date as string | null) ?? null,
      });
    }
  } catch { /* ตารางยังไม่ถูกสร้าง = ยังไม่เคยมีบิลค้าง */ }
  return out;
}

/** สถานะการผูก + บิลค้าง ของสมาชิกที่อ่านจากฐานข้อมูลมาแล้ว (ไม่ query ซ้ำถ้าผูกแล้ว) */
export async function getLinkState(u: LinkableUser & { id: number }): Promise<LinkState> {
  const status = linkStatusOf(u);
  const pendingBills = status === "linked" ? null : await getPendingBillSummary(u.id);
  return buildLinkState(u, { pendingBills });
}
