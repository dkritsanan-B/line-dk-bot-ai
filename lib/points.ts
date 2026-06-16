import { sql } from "./db";

const POINTS_PER_BAHT = 100;

export const TIERS = [
  { name: "Diamond",  emoji: "💎", min: 10000, cardGrad: "linear-gradient(135deg, #0D47A1 0%, #1565C0 45%, #82B1FF 100%)" },
  { name: "Platinum", emoji: "🔱", min: 4000,  cardGrad: "linear-gradient(135deg, #37474F 0%, #607D8B 45%, #CFD8DC 100%)" },
  { name: "Gold",     emoji: "🥇", min: 1000,  cardGrad: "linear-gradient(135deg, #F57F17 0%, #FFD600 50%, #F9A825 100%)" },
  { name: "Silver",   emoji: "🥈", min: 300,   cardGrad: "linear-gradient(135deg, #37474F 0%, #78909C 50%, #B0BEC5 100%)" },
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
  const existing = await getUserByPhone(phone);
  if (existing) {
    await sql`
      UPDATE users SET
        line_user_id = ${lineUserId},
        display_name = ${displayName ?? null},
        first_name   = ${firstName  ?? null},
        last_name    = ${lastName   ?? null},
        company      = ${company    ?? null},
        birthday     = ${birthday   ?? null}
      WHERE phone = ${phone}
    `;
    return { isNew: false };
  }
  await sql`
    INSERT INTO users (line_user_id, phone, display_name, first_name, last_name, company, birthday)
    VALUES (${lineUserId}, ${phone}, ${displayName ?? null}, ${firstName ?? null}, ${lastName ?? null}, ${company ?? null}, ${birthday ?? null})
  `;
  return { isNew: true };
}

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
