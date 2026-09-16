export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { migrateDB, buildLinkState, getPendingBillsByUser, LINK_OVERDUE_DAYS } from "@/lib/points";
import { getAdminRole, hasRole } from "@/lib/admin-auth";
import { ADMIN_REVIEW_NOTE, filterAdminReviewMembers, isAdminReviewRequest } from "@/lib/review-admin";

export async function GET(req: NextRequest) {
  if (isAdminReviewRequest(req.nextUrl)) {
    const users = filterAdminReviewMembers(req.nextUrl.searchParams.get("search") ?? "");
    return NextResponse.json({ users, review: true, review_note: ADMIN_REVIEW_NOTE });
  }
  const role = await getAdminRole(req);
  if (!hasRole(role, "viewer")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await migrateDB();

  const search = req.nextUrl.searchParams.get("search") ?? "";
  const rows = search
    ? await sql`
        SELECT id, customer_id, suggested_customer_id, line_user_id, first_name, last_name, phone, company, birthday, points, created_at
        FROM users
        WHERE first_name  ILIKE ${"%" + search + "%"}
           OR last_name   ILIKE ${"%" + search + "%"}
           OR phone       ILIKE ${"%" + search + "%"}
           OR company     ILIKE ${"%" + search + "%"}
           OR customer_id ILIKE ${"%" + search + "%"}
        ORDER BY created_at DESC
      `
    : await sql`
        SELECT id, customer_id, suggested_customer_id, line_user_id, first_name, last_name, phone, company, birthday, points, created_at
        FROM users
        ORDER BY created_at DESC
      `;

  // สมาชิกที่ยังไม่ถูกผูกรหัส = ยังไม่ได้แต้มจากบิลเลย · ส่งสถานะ + จำนวนวันที่รอ + บิลค้าง ไปให้หน้าแอดมินตามงานได้
  // (ตัวเลขบิลค้างมาจาก hero_pending_bills — บิลที่บอทเห็นแล้วแต่ให้แต้มไม่ได้ ไม่ใช่คิวจ่ายย้อนหลัง)
  const pendingByUser = await getPendingBillsByUser();

  const users = rows.map((u) => {
    const link = buildLinkState(u as { customer_id?: string | null; suggested_customer_id?: string | null; created_at?: string | null },
      { pendingBills: pendingByUser.get(Number(u.id)) ?? null });
    return { ...u, link_status: link.status, waiting_days: link.waiting_days, link_overdue: link.overdue, pending_bills: link.pending_bills };
  });
  const summary = {
    total: users.length,
    linked: users.filter((u) => u.link_status === "linked").length,
    suggested: users.filter((u) => u.link_status === "suggested").length,
    pending: users.filter((u) => u.link_status === "pending").length,
    overdue: users.filter((u) => u.link_status !== "linked" && u.link_overdue).length,
    overdue_days: LINK_OVERDUE_DAYS,
    pending_bills: [...pendingByUser.values()].reduce((n, p) => n + p.count, 0),
  };

  return NextResponse.json({ users, link_summary: summary });
}

// DELETE ?id=N → ลบสมาชิกทิ้งทั้งคน (super เท่านั้น) — ใช้ล้างข้อมูลทดสอบ/สมัครซ้ำ · ลบทุกอย่างที่อ้างถึงคนนี้ก่อน แล้วค่อยลบ users
// ต่างจาก clear-member-points ที่แค่รีเซ็ตแต้ม: คนที่ถูกลบจะสมัครใหม่ผ่าน LIFF ได้เหมือนไม่เคยมี
export async function DELETE(req: NextRequest) {
  if (isAdminReviewRequest(req.nextUrl)) return NextResponse.json({ success: true, review: true });
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
    await del("hero_pending_bills", () => sql`DELETE FROM hero_pending_bills WHERE user_id = ${id} RETURNING bill_no`),
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
