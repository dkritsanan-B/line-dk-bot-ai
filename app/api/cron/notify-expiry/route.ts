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

  // หา users ที่มีคะแนนจะหมดอายุใน 31 วัน และยังไม่ได้รับแจ้งเตือน
  const users = await sql`
    SELECT
      u.id        AS user_id,
      u.line_user_id,
      u.first_name,
      MIN(t.expires_at)         AS earliest_expiry,
      SUM(t.points_earned)::int AS expiring_points
    FROM transactions t
    JOIN users u ON t.user_id = u.id
    WHERE t.type        = 'earn'
      AND t.expired     = FALSE
      AND t.notified_1m = FALSE
      AND t.expires_at  > NOW()
      AND t.expires_at <= NOW() + INTERVAL '31 days'
    GROUP BY u.id, u.line_user_id, u.first_name
    HAVING u.line_user_id IS NOT NULL
  `;

  let notified = 0;

  for (const row of users) {
    const expDate  = new Date(row.earliest_expiry as string).toLocaleDateString("th-TH", {
      day: "numeric", month: "long", year: "numeric",
    });
    const daysLeft = Math.ceil(
      (new Date(row.earliest_expiry as string).getTime() - Date.now()) / 86400000,
    );

    const sent = await pushMessage(
      row.line_user_id as string,
      `⏰ แจ้งเตือนจาก DK Steel and Tools\n\nสวัสดีค่ะ ${row.first_name ?? "คุณ"} คะแนนสะสม ${row.expiring_points} แต้มของคุณจะหมดอายุในอีก ${daysLeft} วัน\n📅 วันหมดอายุ: ${expDate}\n\nอย่าลืมมาแลกของรางวัลที่ร้านก่อนหมดอายุนะคะ 🎁`,
    );

    if (sent) {
      await sql`
        UPDATE transactions
        SET notified_1m = TRUE
        WHERE user_id   = ${row.user_id as number}
          AND type      = 'earn'
          AND expired   = FALSE
          AND expires_at <= NOW() + INTERVAL '31 days'
      `;
      notified++;
    }
  }

  return NextResponse.json({ ok: true, notified });
}
