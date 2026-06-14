export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { deductPoints, getUserByPhone } from "@/lib/points";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-admin-password");
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phone, points, note } = await req.json();
  if (!phone || !points || points <= 0) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const user = await getUserByPhone(phone);
  if (!user) return NextResponse.json({ error: "ไม่พบลูกค้าเบอร์นี้ในระบบ" }, { status: 404 });
  if (user.points < points) return NextResponse.json({ error: `แต้มไม่พอ (มี ${user.points} แต้ม)` }, { status: 400 });

  const result = await deductPoints(phone, points, note);
  if (!result) return NextResponse.json({ error: "ลดแต้มไม่สำเร็จ" }, { status: 500 });

  return NextResponse.json({
    success: true,
    name: user.first_name ? `${user.first_name} ${user.last_name}` : (user.display_name ?? user.phone),
    pointsDeducted: result.pointsDeducted,
    totalPoints: result.totalPoints,
  });
}
