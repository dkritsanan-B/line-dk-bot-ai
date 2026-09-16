export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { reviewScenarioFrom, REVIEW_REWARDS } from "@/lib/review-mode";
import { apiOk, dbError, reviewFaultResponse } from "@/app/api/_lib/api-error";

// รายการของรางวัล (ไม่ต้องล็อกอิน — ใครก็ดูได้ แต่จะแลกได้ต้องมี token)
//
// 16 ก.ย. 69: เดิมเป็น `catch { return { rewards: [] } }` — ฐานข้อมูลล่มแล้วลูกค้าเห็น "ยังไม่มีของรางวัลในขณะนี้"
// เหมือนร้านเลิกแจกของรางวัล และไม่มี log ให้รู้ด้วยซ้ำว่าล่ม · ตอนนี้บอกความจริงเป็น 503 + code
export async function GET(req: NextRequest) {
  // โหมดรีวิว: ของรางวัลจำลอง ไม่แตะฐานข้อมูล
  const rv = reviewScenarioFrom(new URL(req.url));
  if (rv) {
    const fault = reviewFaultResponse(rv.fault);
    if (fault) return fault;
    return apiOk({ rewards: REVIEW_REWARDS });
  }
  try {
    const rows = await sql`
      SELECT id, name, description, points_required, image_url, stock
      FROM rewards
      WHERE active = TRUE
      ORDER BY sort_order ASC NULLS LAST, id ASC
    `;
    return apiOk({ rewards: rows });
  } catch (e) {
    return dbError(e, "GET /api/rewards");
  }
}
