import { sql } from "./db";

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
}

export async function migrateDB() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name             TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name              TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS company                TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday               DATE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id            TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS suggested_customer_id  TEXT`;   // บอทเดารหัส Hero จากเบอร์ → พนักงานกดยืนยันเอง (ไม่ผูกอัตโนมัติ กันสวมเบอร์คนอื่น)
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_earned           INT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_purchase_at       TIMESTAMPTZ`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS notified_inactive_11m  BOOLEAN NOT NULL DEFAULT FALSE`;
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
): Promise<{ isNew: boolean }> {
  // กติกาตัวตน (14 ก.ย. 69): 1 คน = 1 บัญชี LINE = 1 เบอร์
  //  - LINE นี้เคยสมัครแล้ว → แก้ข้อมูล/เปลี่ยนเบอร์ของตัวเองได้ (เบอร์ใหม่ต้องไม่ซ้ำคนอื่น)
  //  - เบอร์นี้มีเจ้าของที่ผูก LINE อื่นอยู่ → ปฏิเสธ (เดิมเขียนทับ line_user_id = ใครรู้เบอร์ก็ยึดบัญชี/แต้มคนอื่นได้) → ให้พนักงานปลด LINE เก่าในหน้าแอดมินก่อน
  //  - เบอร์นี้มีในระบบแต่ยังไม่ผูก LINE (พนักงานสร้างให้/ถูกปลด) → รับ LINE นี้เข้าไป (เปลี่ยนเครื่อง/เปลี่ยน LINE ทำแบบนี้)
  const mine = await getUserByLineId(lineUserId);
  const byPhone = await getUserByPhone(phone);
  if (mine) {
    if (byPhone && byPhone.id !== mine.id) throw new RegisterError("เบอร์นี้เป็นของสมาชิกท่านอื่นแล้ว กรุณาติดต่อพนักงานที่ร้านค่ะ");
    await sql`
      UPDATE users SET phone = ${phone}, display_name = ${displayName ?? null}, first_name = ${firstName ?? null},
        last_name = ${lastName ?? null}, company = ${company ?? null}, birthday = ${birthday ?? null}
      WHERE id = ${mine.id}
    `;
    return { isNew: false };
  }
  if (byPhone) {
    if (byPhone.line_user_id && byPhone.line_user_id !== lineUserId) throw new RegisterError("เบอร์นี้ผูกกับบัญชี LINE อื่นอยู่แล้ว ถ้าเปลี่ยน LINE ใหม่ กรุณาแจ้งพนักงานที่ร้านให้ปลดบัญชีเดิมก่อนค่ะ");
    await sql`
      UPDATE users SET line_user_id = ${lineUserId}, display_name = ${displayName ?? null}, first_name = ${firstName ?? null},
        last_name = ${lastName ?? null}, company = ${company ?? null}, birthday = ${birthday ?? null}
      WHERE id = ${byPhone.id}
    `;
    return { isNew: false };
  }
  await sql`
    INSERT INTO users (line_user_id, phone, display_name, first_name, last_name, company, birthday)
    VALUES (${lineUserId}, ${phone}, ${displayName ?? null}, ${firstName ?? null}, ${lastName ?? null}, ${company ?? null}, ${birthday ?? null})
  `;
  return { isNew: true };
}

export class RegisterError extends Error {}

export async function addPoints(
  phone: string,
  purchaseAmount: number,
  note?: string,
): Promise<{ pointsEarned: number; totalPoints: number } | null> {
  const user = await getUserByPhone(phone);
  if (!user) return null;

  const pointsEarned = Math.floor(purchaseAmount / POINTS_PER_BAHT);
  if (pointsEarned <= 0) return null;

  await sql`
    UPDATE users SET
      points               = points + ${pointsEarned},
      total_earned         = total_earned + ${pointsEarned},
      last_purchase_at     = NOW(),
      notified_inactive_11m = FALSE
    WHERE phone = ${phone}
  `;
  await sql`
    INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note, expires_at)
    VALUES (${user.id}, ${purchaseAmount}, ${pointsEarned}, 'earn', ${note ?? null}, NOW() + INTERVAL '1 year')
  `;

  return { pointsEarned, totalPoints: user.points + pointsEarned };
}

export async function deductPoints(
  phone: string,
  points: number,
  note?: string,
): Promise<{ pointsDeducted: number; totalPoints: number } | null> {
  const user = await getUserByPhone(phone);
  if (!user) return null;
  if (user.points < points) return null;

  await sql`UPDATE users SET points = points - ${points} WHERE phone = ${phone}`;
  await sql`
    INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note)
    VALUES (${user.id}, 0, ${points}, 'redeem', ${note ?? null})
  `;

  return { pointsDeducted: points, totalPoints: user.points - points };
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
 * นับเฉพาะก้อนที่จะหมดอายุ "ในช่วงที่เตือน" เท่านั้น (ใช้กับข้อมูลที่อยู่ในมือแล้ว เช่น ข้อมูลจำลองโหมดรีวิว)
 * ตรรกะตรงกับคิวรี SQL ข้างล่างทุกเงื่อนไข: earn เท่านั้น · ยังไม่ถูกตัด (expired) · ไม่ถูกเคลียร์ (cleared)
 * · มีวันหมดอายุ · วันหมดอายุยังไม่ถึง (> ตอนนี้) และอยู่ภายใน windowDays
 */
export function summarizeExpiring(
  lots: ExpiryLot[],
  currentPoints: number,
  now: number = Date.now(),
  windowDays: number = EXPIRY_NOTICE_DAYS,
): ExpirySummary {
  const until = now + windowDays * DAY_MS;
  let sum = 0;
  let earliestMs: number | null = null;
  let earliestRaw: string | Date | null = null;

  for (const lot of lots ?? []) {
    if ((lot.type ?? "earn") !== "earn") continue;
    if (lot.expired === true || lot.cleared === true) continue;
    if (!lot.expires_at) continue;
    const ms = new Date(lot.expires_at).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms <= now || ms > until) continue;
    sum += Math.trunc(Number(lot.points_earned) || 0);
    if (earliestMs === null || ms < earliestMs) { earliestMs = ms; earliestRaw = lot.expires_at; }
  }
  return capExpiring(sum, earliestRaw, currentPoints);
}

type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;
const defaultSql = sql as unknown as SqlTag;

/** แต้มใกล้หมดอายุของสมาชิกคนเดียว — ใช้บนบัตรสมาชิก (/api/member) */
export async function getExpiringSummary(
  userId: number,
  currentPoints: number,
  db: SqlTag = defaultSql,
): Promise<ExpirySummary> {
  const rows = await db`
    SELECT MIN(expires_at) AS earliest_expiry,
           COALESCE(SUM(points_earned), 0)::int AS raw_points
    FROM transactions
    WHERE user_id = ${userId}
      AND type = 'earn'
      AND expired = FALSE
      AND cleared = FALSE
      AND expires_at IS NOT NULL
      AND expires_at > NOW()
      AND expires_at <= NOW() + (${EXPIRY_NOTICE_DAYS}::int * INTERVAL '1 day')
  `;
  const row = rows?.[0];
  if (!row) return { ...NO_EXPIRY };
  return capExpiring(
    Number(row.raw_points ?? 0),
    (row.earliest_expiry as string | Date | null) ?? null,
    currentPoints,
  );
}

export interface ExpiryNotice extends ExpirySummary {
  user_id: number;
  line_user_id: string;
  first_name: string | null;
  earliest_expiry: string;
}

/** รายชื่อคนที่ต้องส่ง LINE เตือนแต้มใกล้หมด — ใช้ที่ /api/cron/notify-expiry (ช่วงเดียวกับบัตรสมาชิก) */
export async function listExpiryNotices(db: SqlTag = defaultSql): Promise<ExpiryNotice[]> {
  const rows = await db`
    SELECT u.id AS user_id,
           u.line_user_id,
           u.first_name,
           u.points,
           MIN(t.expires_at)                AS earliest_expiry,
           COALESCE(SUM(t.points_earned), 0)::int AS raw_points
    FROM transactions t
    JOIN users u ON t.user_id = u.id
    WHERE t.type        = 'earn'
      AND t.expired     = FALSE
      AND t.cleared     = FALSE
      AND t.notified_1m = FALSE
      AND t.expires_at IS NOT NULL
      AND t.expires_at  > NOW()
      AND t.expires_at <= NOW() + (${EXPIRY_NOTICE_DAYS}::int * INTERVAL '1 day')
    GROUP BY u.id, u.line_user_id, u.first_name, u.points
    HAVING u.line_user_id IS NOT NULL
  `;
  const out: ExpiryNotice[] = [];
  for (const row of rows ?? []) {
    const s = capExpiring(
      Number(row.raw_points ?? 0),
      (row.earliest_expiry as string | Date | null) ?? null,
      Number(row.points ?? 0),
    );
    // แต้มคงเหลือ 0 (แลก/ถูกตัดไปหมดแล้ว) → ไม่ต้องทักว่าแต้มจะหมด เปลืองโควตา push และทำลูกค้างง
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

/** มาร์กว่าเตือนก้อนในช่วงนี้ไปแล้ว — ช่วงต้องเท่ากับตอน SELECT ไม่งั้นเตือนซ้ำ/เตือนข้าม */
export async function markExpiryNotified(userId: number, db: SqlTag = defaultSql): Promise<void> {
  await db`
    UPDATE transactions
    SET notified_1m = TRUE
    WHERE user_id   = ${userId}
      AND type      = 'earn'
      AND expired   = FALSE
      AND cleared   = FALSE
      AND expires_at IS NOT NULL
      AND expires_at <= NOW() + (${EXPIRY_NOTICE_DAYS}::int * INTERVAL '1 day')
  `;
}

// หมายเหตุที่ยังแก้ไม่ได้ในงานนี้ (ไม่ใช่กติกาแต้ม แต่เป็นข้อสมมติของโครงข้อมูล):
// deductPoints() หักแต้มที่ users.points อย่างเดียว ไม่ได้ตัดก้อน (transactions แถว earn) แบบ FIFO
// ก้อนเก่าจึงยังเต็มจำนวนอยู่ในตารางแม้ลูกค้าแลกของไปแล้ว → ตัวเลข "จะหมดอายุ" เป็นค่าสูงสุดที่เป็นไปได้
// (over-estimate) ของก้อนในช่วงนั้น เราจึงกดเพดานด้วยแต้มคงเหลือจริงไว้ชั้นหนึ่ง

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
    detail: "เพื่อความปลอดภัยของแต้ม พนักงานต้องยืนยันว่าเบอร์นี้เป็นของคุณจริงก่อน หลังยืนยันแล้ว บิลถัดไปแต้มจะเข้าเองอัตโนมัติค่ะ",
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
