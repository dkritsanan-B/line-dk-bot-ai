export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { migrateDB } from "@/lib/points";
import { getAdminRole, hasRole } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "viewer")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await migrateDB();

  const search = req.nextUrl.searchParams.get("search") ?? "";
  const rows = search
    ? await sql`
        SELECT id, customer_id, first_name, last_name, phone, company, birthday, points, created_at
        FROM users
        WHERE first_name  ILIKE ${"%" + search + "%"}
           OR last_name   ILIKE ${"%" + search + "%"}
           OR phone       ILIKE ${"%" + search + "%"}
           OR company     ILIKE ${"%" + search + "%"}
           OR customer_id ILIKE ${"%" + search + "%"}
        ORDER BY created_at DESC
      `
    : await sql`
        SELECT id, customer_id, first_name, last_name, phone, company, birthday, points, created_at
        FROM users
        ORDER BY created_at DESC
      `;

  return NextResponse.json({ users: rows });
}

// DELETE ?id=N → ลบสมาชิกทิ้งทั้งคน (super เท่านั้น) — ใช้ล้างข้อมูลทดสอบ/สมัครซ้ำ · ลบทุกอย่างที่อ้างถึงคนนี้ก่อน แล้วค่อยลบ users
// ต่างจาก clear-member-points ที่แค่รีเซ็ตแต้ม: คนที่ถูกลบจะสมัครใหม่ผ่าน LIFF ได้เหมือนไม่เคยมี
export async function DELETE(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "super")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "bad id" }, { status: 400 });

  await migrateDB();
  const user = (await sql`SELECT id, first_name, last_name, phone, customer_id, points, total_earned FROM users WHERE id = ${id} LIMIT 1`)[0];
  if (!user) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.phone;

  // ตารางลูกอาจยังไม่ถูกสร้าง (สร้างตอนใช้ครั้งแรก) → นับแยกทีละตาราง ล้มตารางไหนถือว่า 0
  const del = async (label: string, q: () => Promise<unknown[]>) => { try { return { [label]: (await q()).length }; } catch { return { [label]: 0 }; } };
  const removed = Object.assign({},
    await del("transactions", () => sql`DELETE FROM transactions WHERE user_id = ${id} RETURNING id`),
    await del("hero_point_bills", () => sql`DELETE FROM hero_point_bills WHERE user_id = ${id} RETURNING bill_no`),
    await del("redemption_requests", () => sql`DELETE FROM redemption_requests WHERE user_id = ${id} RETURNING id`),
    await del("quiz_sessions", () => sql`DELETE FROM quiz_sessions WHERE user_id = ${id} RETURNING id`),
  );
  await sql`DELETE FROM users WHERE id = ${id}`;
  await sql`
    INSERT INTO audit_log (action, target_user_id, detail)
    VALUES ('delete_member', ${id}, ${`ลบสมาชิก ${name} (${user.phone ?? "-"} · CUS ${user.customer_id ?? "-"} · แต้ม ${user.points}/${user.total_earned}) · ${JSON.stringify(removed)}`})
  `;
  return NextResponse.json({ success: true, id, name, removed });
}
