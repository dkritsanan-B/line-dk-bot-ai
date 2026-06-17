export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { addPoints, getUserByPhone } from "@/lib/points";
import { getAdminRole, hasRole } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "staff")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await req.json() as { rows: { phone: string; amount: number }[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "missing rows" }, { status: 400 });
  }

  const results = await Promise.all(
    rows.map(async ({ phone, amount }) => {
      try {
        const user = await getUserByPhone(phone);
        if (!user) return { phone, amount, status: "error", message: "ไม่พบลูกค้าในระบบ" };

        const result = await addPoints(phone, amount);
        if (!result) return { phone, amount, status: "error", message: "เพิ่มแต้มไม่สำเร็จ" };

        return {
          phone,
          amount,
          status: "success",
          name: user.first_name ? `${user.first_name} ${user.last_name}` : (user.display_name ?? phone),
          pointsEarned: result.pointsEarned,
          totalPoints: result.totalPoints,
        };
      } catch {
        return { phone, amount, status: "error", message: "เกิดข้อผิดพลาด" };
      }
    })
  );

  return NextResponse.json({ results });
}
