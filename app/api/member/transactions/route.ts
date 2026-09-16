export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyLiffUser, isAuthError } from "@/lib/liff-auth";
import { reviewScenarioFrom } from "@/lib/review-mode";

// ประวัติแต้มของ "เจ้าของ token" เท่านั้น — ตัวตนตรวจกับ LINE ฝั่งเซิร์ฟเวอร์ (14 ก.ย. 69)
export async function GET(req: NextRequest) {
  const rv = reviewScenarioFrom(new URL(req.url));
  if (rv) return NextResponse.json({ transactions: rv.transactions });

  const who = await verifyLiffUser(req);
  if (isAuthError(who)) return NextResponse.json({ error: who.error }, { status: who.status });

  const rows = await sql`
    SELECT
      t.id,
      t.purchase_amount,
      t.points_earned,
      t.type,
      t.note,
      t.created_at
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE u.line_user_id = ${who.userId}
      AND t.cleared = FALSE
    ORDER BY t.created_at DESC
    LIMIT 50
  `;

  return NextResponse.json({ transactions: rows });
}
