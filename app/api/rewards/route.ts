export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
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
