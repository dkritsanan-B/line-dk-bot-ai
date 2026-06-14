import { sql } from "./db";

const POINTS_PER_BAHT = 100; // 100 บาท = 1 แต้ม

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
  created_at: string;
}

export async function migrateDB() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name  TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name   TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS company     TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday    DATE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id TEXT`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'earn'`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS note TEXT`;
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

  await sql`UPDATE users SET points = points + ${pointsEarned} WHERE phone = ${phone}`;
  await sql`
    INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note)
    VALUES (${user.id}, ${purchaseAmount}, ${pointsEarned}, 'earn', ${note ?? null})
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
