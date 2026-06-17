export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getAdminRole, hasRole } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "super")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const phone = req.nextUrl.searchParams.get("phone") ?? "";

  const logs = await sql`
    SELECT al.id, al.action, al.detail, al.created_at,
           u.first_name, u.last_name, u.phone
    FROM audit_log al
    LEFT JOIN users u ON u.id = al.target_user_id
    ORDER BY al.created_at DESC
    LIMIT 200
  `;

  // ถ้าระบุเบอร์ → ดึง cleared transactions ของคนนั้น
  let cleared: unknown[] = [];
  if (phone) {
    cleared = await sql`
      SELECT t.id, t.type, t.points_earned, t.purchase_amount, t.note, t.created_at
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      WHERE u.phone = ${phone} AND t.cleared = TRUE
      ORDER BY t.created_at DESC
    `;
  }

  return NextResponse.json({ logs, cleared });
}
