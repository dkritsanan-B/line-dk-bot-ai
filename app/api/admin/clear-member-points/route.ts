export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getUserByPhone } from "@/lib/points";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-admin-password");
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phone } = await req.json();
  if (!phone) return NextResponse.json({ error: "missing phone" }, { status: 400 });

  const user = await getUserByPhone(phone);
  if (!user) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });

  const name = user.first_name ? `${user.first_name} ${user.last_name}` : user.display_name ?? user.phone;
  const clearedPoints = user.total_earned;

  // soft delete: ซ่อน transactions ทั้งหมด
  await sql`
    UPDATE transactions SET cleared = TRUE
    WHERE user_id = ${user.id} AND cleared = FALSE
  `;

  // รีเซ็ต points
  await sql`
    UPDATE users SET
      points            = 0,
      total_earned      = 0,
      last_purchase_at  = NULL,
      notified_inactive_11m = FALSE
    WHERE id = ${user.id}
  `;

  // audit log
  await sql`
    INSERT INTO audit_log (action, target_user_id, detail)
    VALUES ('clear_member_points', ${user.id}, ${`เคลียร์ประวัติของ ${name} (total_earned: ${clearedPoints} แต้ม)`})
  `;

  return NextResponse.json({ success: true, name, clearedPoints });
}
