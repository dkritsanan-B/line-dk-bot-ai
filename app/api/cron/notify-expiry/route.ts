export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

async function pushMessage(lineUserId: string, text: string) {
  await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }] }),
  });
}

async function notifyWindow(daysMin: number, daysMax: number, label: string) {
  const rows = await sql`
    SELECT
      u.id          AS user_id,
      u.line_user_id,
      u.first_name,
      SUM(t.points_earned)::int AS expiring_points,
      MIN(t.expires_at)         AS earliest_expiry
    FROM transactions t
    JOIN users u ON t.user_id = u.id
    WHERE t.type = 'earn'
      AND t.expired = FALSE
      AND t.expires_at BETWEEN NOW() + (${daysMin} || ' days')::interval
                           AND NOW() + (${daysMax} || ' days')::interval
    GROUP BY u.id, u.line_user_id, u.first_name
    HAVING SUM(t.points_earned) > 0
  `;

  let count = 0;
  for (const row of rows) {
    if (!row.line_user_id) continue;

    const name = row.first_name ?? "คุณ";
    const expDate = new Date(row.earliest_expiry as string).toLocaleDateString("th-TH", {
      day: "numeric", month: "long", year: "numeric",
    });

    await pushMessage(
      row.line_user_id as string,
      `⏰ แจ้งเตือนจาก DK Steel and Tools\n\n${name} คะแนนสะสม ${row.expiring_points} แต้มของคุณจะหมดอายุในอีก ${label}\n📅 วันหมดอายุ: ${expDate}\n\nอย่าลืมนำคะแนนมาแลกของรางวัลที่ร้านก่อนหมดอายุนะคะ 🎁\n\nกดดูของรางวัลได้เลยค่ะ 👉 https://line-dk-bot-ai.vercel.app/liff/rewards`
    );
    count++;
  }
  return count;
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // แจ้งเตือน 3 เดือน (85-95 วัน)
  const notify3m = await notifyWindow(85, 95, "3 เดือน");

  // แจ้งเตือน 1 เดือน (27-33 วัน)
  const notify1m = await notifyWindow(27, 33, "1 เดือน");

  return NextResponse.json({ ok: true, notified_3months: notify3m, notified_1month: notify1m });
}
