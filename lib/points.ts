import { sql } from "./db";

const POINTS_PER_BAHT = 100; // 100 บาท = 1 แต้ม

interface User {
  id: number;
  line_user_id: string | null;
  phone: string;
  display_name: string | null;
  points: number;
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
  displayName?: string
): Promise<{ isNew: boolean }> {
  const existing = await getUserByPhone(phone);
  if (existing) {
    await sql`
      UPDATE users SET line_user_id = ${lineUserId}, display_name = ${displayName ?? null}
      WHERE phone = ${phone}
    `;
    return { isNew: false };
  }
  await sql`
    INSERT INTO users (line_user_id, phone, display_name)
    VALUES (${lineUserId}, ${phone}, ${displayName ?? null})
  `;
  return { isNew: true };
}

export async function addPoints(
  phone: string,
  purchaseAmount: number
): Promise<{ pointsEarned: number; totalPoints: number } | null> {
  const user = await getUserByPhone(phone);
  if (!user) return null;

  const pointsEarned = Math.floor(purchaseAmount / POINTS_PER_BAHT);
  if (pointsEarned <= 0) return null;

  await sql`UPDATE users SET points = points + ${pointsEarned} WHERE phone = ${phone}`;
  await sql`
    INSERT INTO transactions (user_id, purchase_amount, points_earned)
    VALUES (${user.id}, ${purchaseAmount}, ${pointsEarned})
  `;

  return { pointsEarned, totalPoints: user.points + pointsEarned };
}
