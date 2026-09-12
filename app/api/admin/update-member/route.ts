export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { migrateDB } from "@/lib/points";
import { getAdminRole, hasRole } from "@/lib/admin-auth";

export async function PATCH(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "staff")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, customer_id } = await req.json();
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  await migrateDB();
  // รหัสลูกค้า Hero (CSCUSTOMER.CODE เช่น CUS-10595) — เก็บตัวพิมพ์ใหญ่ตัดช่องว่าง ให้ตรงกับที่ /api/hero/points ใช้จับคู่บิล
  const code = String(customer_id ?? "").trim().toUpperCase() || null;
  if (code) {
    const taken = await sql`SELECT id FROM users WHERE UPPER(TRIM(customer_id)) = ${code} AND id <> ${id} LIMIT 1`;
    if (taken.length) return NextResponse.json({ error: `รหัส ${code} ผูกกับสมาชิกคนอื่นอยู่แล้ว` }, { status: 409 });
  }
  await sql`UPDATE users SET customer_id = ${code} WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
