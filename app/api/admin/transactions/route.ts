export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("x-admin-password");
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search   = req.nextUrl.searchParams.get("search") ?? "";
  const dateFrom = req.nextUrl.searchParams.get("from") ?? "";
  const dateTo   = req.nextUrl.searchParams.get("to") ?? "";

  const rows = await sql`
    SELECT
      t.id,
      t.purchase_amount,
      t.points_earned,
      t.created_at,
      u.phone,
      u.first_name,
      u.last_name,
      u.display_name
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE
      (${search} = '' OR u.phone ILIKE ${"%" + search + "%"}
        OR u.first_name ILIKE ${"%" + search + "%"}
        OR u.last_name  ILIKE ${"%" + search + "%"})
      AND (${dateFrom} = '' OR t.created_at >= ${dateFrom}::date)
      AND (${dateTo}   = '' OR t.created_at <  (${dateTo}::date + interval '1 day'))
    ORDER BY t.created_at DESC
    LIMIT 500
  `;

  return NextResponse.json({ transactions: rows });
}
