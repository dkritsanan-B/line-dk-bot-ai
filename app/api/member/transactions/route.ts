export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId");
  if (!lineUserId) return NextResponse.json({ error: "missing lineUserId" }, { status: 400 });

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
    WHERE u.line_user_id = ${lineUserId}
      AND t.cleared = FALSE
    ORDER BY t.created_at DESC
    LIMIT 50
  `;

  return NextResponse.json({ transactions: rows });
}
