export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyLiffUser, isAuthError } from "@/lib/liff-auth";
import { reviewScenarioFrom } from "@/lib/review-mode";
import { apiOk, authError, dbError, reviewFaultResponse } from "@/app/api/_lib/api-error";

// ประวัติแต้มของ "เจ้าของ token" เท่านั้น — ตัวตนตรวจกับ LINE ฝั่งเซิร์ฟเวอร์ (14 ก.ย. 69)
//
// 200 { transactions: [...] } = อ่านได้จริง (ลิสต์ว่าง = ยังไม่เคยมีรายการจริง ๆ)
// 4xx/5xx { ok:false, code, error } = อ่านไม่ได้ ห้ามโชว์ "ไม่มีรายการ" (16 ก.ย. 69)
// เดิมคิวรีล้มแล้ว throw ออกไปเป็นหน้า error ของ Next ที่ไม่ใช่ JSON → หน้าเว็บ parse ไม่ได้ ปุ่มดูประวัติกดแล้วเงียบ
export async function GET(req: NextRequest) {
  const rv = reviewScenarioFrom(new URL(req.url));
  if (rv) {
    const fault = reviewFaultResponse(rv.fault);
    if (fault) return fault;
    return apiOk({ transactions: rv.transactions });
  }

  const who = await verifyLiffUser(req);
  if (isAuthError(who)) return authError(who);

  try {
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
    return apiOk({ transactions: rows });
  } catch (e) {
    return dbError(e, "GET /api/member/transactions");
  }
}
