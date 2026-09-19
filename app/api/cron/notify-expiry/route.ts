export const runtime = "nodejs";

import { pushLine } from "@/lib/line-push";
import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sql } from "@/lib/db";
import { migrateDB, listExpiryNotices, markExpiryNotified, EXPIRY_NOTICE_DAYS, getTierFromPoints } from "@/lib/points";
import { pointsExpiringFlex, tierExpiryWarningFlex } from "@/lib/line-ui";


async function pushMessage(lineUserId: string, message: object): Promise<boolean> {
  // ตัวส่งกลาง: ดูโควตาก่อนส่ง · ความสำคัญ "notice" (ดู lib/line-push.ts)
  return (await pushLine(lineUserId, message, "notice")).sent;
}

const thaiDate = (d: Date) => d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get("authorization"))) {
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
      pointsExpiringFlex({ name: row.first_name ?? "คุณ", points: Number(row.expiring_points), daysLeft, expiryDate: expDate }),
    );

    if (sent) {
      await markExpiryNotified(row.user_id);
      notified++;
    }
  }

  // แจ้งเตือนสมาชิกที่ไม่ซื้อสินค้า 11 เดือน (เหลืออีก 1 เดือนก่อนระดับลด)
  const inactiveUsers = await sql`
    SELECT id, line_user_id, first_name, last_purchase_at, total_earned, points
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
      tierExpiryWarningFlex({
        name: (row.first_name as string | null) ?? "คุณ",
        // ยังไม่ครบ 12 เดือน → ระดับตอนนี้ยังคิดจากแต้มสะสม · ครบ 365 วันแล้วจะคิดจากแต้มคงเหลือ (getEffectiveTier)
        tierName: getTierFromPoints(Number(row.total_earned ?? 0)).name,
        points: Number(row.points ?? 0),
        deadline: thaiDate(new Date(new Date(row.last_purchase_at as string).getTime() + 365 * 86400000)),
        lastPurchaseDate: thaiDate(new Date(row.last_purchase_at as string)),
      }),
    );
    if (sent) {
      await sql`
        UPDATE users SET notified_inactive_11m = TRUE WHERE id = ${row.id as number}
      `;
    }
  }

  return NextResponse.json({ ok: true, windowDays: EXPIRY_NOTICE_DAYS, candidates: users.length, notified, inactiveNotified: inactiveUsers.length });
}
