export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { addPoints, getUserByPhone } from "@/lib/points";
import { getAdminRole, hasRole } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "staff")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { phone, amount, note } = await req.json();
  if (!phone || !amount || amount <= 0) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const user = await getUserByPhone(phone);
  if (!user) {
    return NextResponse.json({ error: "ไม่พบลูกค้าเบอร์นี้ในระบบ" }, { status: 404 });
  }

  const result = await addPoints(phone, amount, note);
  if (!result) {
    return NextResponse.json({ error: "เพิ่มแต้มไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    name: user.first_name ? `${user.first_name} ${user.last_name}` : user.display_name ?? user.phone,
    pointsEarned: result.pointsEarned,
    totalPoints: result.totalPoints,
  });
}
