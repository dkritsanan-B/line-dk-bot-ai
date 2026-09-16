export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { migrateDB, listExpiryNotices, markExpiryNotified, EXPIRY_NOTICE_DAYS } from "@/lib/points";

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

  // หา users ที่มีคะแนนจะหมดอายุในช่วงเตือน และยังไม่ได้รับแจ้งเตือน
  // คิวรีอยู่ที่ lib/points.ts ที่เดียว ใช้ช่วงเดียวกับบัตรสมาชิก (EXPIRY_NOTICE_DAYS วัน) กันสองที่นับไม่ตรงกันอีก
  const users = await listExpiryNotices();

  let notified = 0;

  for (const row of users) {
    const expDate  = new Date(row.earliest_expiry).toLocaleDateString("th-TH", {
      day: "numeric", month: "long", year: "numeric",
    });
    const daysLeft = Math.ceil(
      (new Date(row.earliest_expiry).getTime() - Date.now()) / 86400000,
    );

    const sent = await pushMessage(
      row.line_user_id,
      `⏰ แจ้งเตือนจาก DK Steel and Tools\n\nสวัสดีค่ะ ${row.first_name ?? "คุณ"} คะแนนสะสม ${row.expiring_points} แต้มของคุณจะหมดอายุในอีก ${daysLeft} วัน\n📅 วันหมดอายุ: ${expDate}\n\nอย่าลืมมาแลกของรางวัลที่ร้านก่อนหมดอายุนะคะ 🎁`,
    );

    if (sent) {
      await markExpiryNotified(row.user_id);
      notified++;
    }
  }

  // แจ้งเตือนสมาชิกที่ไม่ซื้อสินค้า 11 เดือน (เหลืออีก 1 เดือนก่อนระดับลด)
  const inactiveUsers = await sql`
    SELECT id, line_user_id, first_name, last_purchase_at
    FROM users
    WHERE line_user_id IS NOT NULL
      AND last_purchase_at IS NOT NULL
      AND last_purchase_at <= NOW() - INTERVAL '11 months'
      AND last_purchase_at >  NOW() - INTERVAL '12 months'
      AND notified_inactive_11m = FALSE
  `;

  for (const row of inactiveUsers) {
    const sent = await pushMessage(
      row.line_user_id as string,
      `⚠️ แจ้งเตือนจาก DK Steel and Tools\n\nสวัสดีค่ะ ${row.first_name ?? "คุณ"}\n\nคุณไม่ได้ซื้อสินค้ามา 11 เดือนแล้วค่ะ\nหากไม่มีการซื้อภายใน 1 เดือน ระดับสมาชิกของคุณจะลดลงนะคะ\n\n🛒 แวะมาซื้อสินค้าเพื่อรักษาระดับสมาชิกของคุณได้เลยค่ะ 😊`,
    );
    if (sent) {
      await sql`
        UPDATE users SET notified_inactive_11m = TRUE WHERE id = ${row.id as number}
      `;
    }
  }

  return NextResponse.json({ ok: true, windowDays: EXPIRY_NOTICE_DAYS, candidates: users.length, notified, inactiveNotified: inactiveUsers.length });
}
