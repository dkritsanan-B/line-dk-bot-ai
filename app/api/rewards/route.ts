export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { reviewScenarioFrom, REVIEW_REWARDS } from "@/lib/review-mode";

export async function GET(req: NextRequest) {
  // โหมดรีวิว: ของรางวัลจำลอง ไม่แตะฐานข้อมูล
  if (reviewScenarioFrom(new URL(req.url))) return NextResponse.json({ rewards: REVIEW_REWARDS });
  try {
    const rows = await sql`
      SELECT id, name, description, points_required, image_url, stock
      FROM rewards
      WHERE active = TRUE
      ORDER BY sort_order ASC NULLS LAST, id ASC
    `;
    return NextResponse.json({ rewards: rows });
  } catch {
    return NextResponse.json({ rewards: [] });
  }
}
