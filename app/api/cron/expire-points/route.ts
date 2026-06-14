export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { migrateDB } from "@/lib/points";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

async function pushMessage(lineUserId: string, text: string) {
  const res = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }] }),
  });
  return res.ok;
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await migrateDB();

  // หา earn transactions ที่หมดอายุแล้วและยังไม่ถูกตัด
  const expiring = await sql`
    SELECT t.id, t.user_id, t.points_earned, u.line_user_id, u.points, u.first_name
    FROM transactions t
    JOIN users u ON t.user_id = u.id
    WHERE t.type     = 'earn'
      AND t.expired  = FALSE
      AND t.expires_at <= NOW()
  `;

  let totalExpired = 0;
  const processed: number[] = [];
  // รวมคะแนนหมดอายุต่อ user สำหรับส่ง LINE push ครั้งเดียว
  const byUser = new Map<number, { lineUserId: string; firstName: string; total: number }>();

  for (const row of expiring) {
    const toExpire = Math.min(row.points_earned as number, row.points as number);
    if (toExpire <= 0) {
      await sql`UPDATE transactions SET expired = TRUE WHERE id = ${row.id}`;
      processed.push(row.id as number);
      continue;
    }

    await sql`UPDATE users SET points = GREATEST(points - ${toExpire}, 0) WHERE id = ${row.user_id}`;
    await sql`
      INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note)
      VALUES (${row.user_id}, 0, ${toExpire}, 'expire', 'คะแนนหมดอายุ 1 ปี')
    `;
    await sql`UPDATE transactions SET expired = TRUE WHERE id = ${row.id}`;

    totalExpired += toExpire;
    processed.push(row.id as number);

    if (row.line_user_id) {
      const prev = byUser.get(row.user_id as number);
      byUser.set(row.user_id as number, {
        lineUserId: row.line_user_id as string,
        firstName:  row.first_name  as string,
        total:      (prev?.total ?? 0) + toExpire,
      });
    }
  }

  // ส่ง LINE push 1 ครั้งต่อ user
  let notified = 0;
  for (const [, u] of byUser) {
    const sent = await pushMessage(
      u.lineUserId,
      `⚠️ แจ้งเตือนจาก DK Steel and Tools\n\nสวัสดีค่ะ ${u.firstName ?? "คุณ"} คะแนนสะสม ${u.total} แต้มของคุณได้หมดอายุแล้วค่ะ\n\nสะสมแต้มใหม่ได้ทุกการซื้อสินค้า ทุก 100 บาท = 1 แต้ม 🌟`,
    );
    if (sent) notified++;
  }

  return NextResponse.json({ ok: true, processed: processed.length, totalExpired, notified });
}
