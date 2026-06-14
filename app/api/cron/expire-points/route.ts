export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { migrateDB } from "@/lib/points";

export async function GET(req: NextRequest) {
  // Vercel Cron ส่ง Authorization header มาให้
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await migrateDB();

  // หา earn transactions ที่หมดอายุแล้วและยังไม่ถูกตัด
  const expiring = await sql`
    SELECT t.id, t.user_id, t.points_earned, u.line_user_id, u.points, u.first_name
    FROM transactions t
    JOIN users u ON t.user_id = u.id
    WHERE t.type = 'earn'
      AND t.expired = FALSE
      AND t.expires_at <= NOW()
  `;

  let totalExpired = 0;
  const processed: number[] = [];

  for (const row of expiring) {
    const toExpire = Math.min(row.points_earned as number, row.points as number);
    if (toExpire <= 0) {
      // คะแนนถูกใช้หมดแล้ว แค่ mark expired
      await sql`UPDATE transactions SET expired = TRUE WHERE id = ${row.id}`;
      processed.push(row.id as number);
      continue;
    }

    // ตัดคะแนนจากยอดรวม
    await sql`UPDATE users SET points = GREATEST(points - ${toExpire}, 0) WHERE id = ${row.user_id}`;
    await sql`
      INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note)
      VALUES (${row.user_id}, 0, ${toExpire}, 'expire', 'คะแนนหมดอายุ 1 ปี')
    `;
    await sql`UPDATE transactions SET expired = TRUE WHERE id = ${row.id}`;

    totalExpired += toExpire;
    processed.push(row.id as number);
  }

  return NextResponse.json({ ok: true, processed: processed.length, totalExpired });
}
