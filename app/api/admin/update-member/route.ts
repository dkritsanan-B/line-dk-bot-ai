export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { migrateDB } from "@/lib/points";
import { getAdminRole, hasRole } from "@/lib/admin-auth";

// PATCH { id, customer_id? , phone?, reset_line? } — งานพนักงาน (staff ขึ้นไป) ที่ลูกค้าทำเองไม่ได้ (14 ก.ย. 69):
//   customer_id : ผูก/แก้รหัสลูกค้า Hero (CUS-xxxxx) — กันผูกซ้ำคนอื่น · ล้าง suggested_customer_id ด้วย
//   phone       : เปลี่ยนเบอร์ให้ลูกค้า (10 หลัก, ห้ามซ้ำคนอื่น) — ลูกค้าเปลี่ยนเองได้ผ่าน LIFF ถ้ายังใช้ LINE เดิม
//   reset_line  : ปลดบัญชี LINE เดิม (line_user_id = NULL) → ลูกค้าเปิด LINE ใหม่ สมัครด้วยเบอร์เดิม แต้ม/ระดับตามไป — ใช้ตอนเปลี่ยนเครื่อง/LINE หาย
export async function PATCH(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "staff")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, customer_id, phone, reset_line } = await req.json();
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  await migrateDB();
  const cur = (await sql`SELECT id, customer_id, phone, line_user_id, first_name, last_name FROM users WHERE id = ${id} LIMIT 1`)[0];
  if (!cur) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
  const who = [cur.first_name, cur.last_name].filter(Boolean).join(" ") || cur.phone;
  const done: string[] = [];

  if (customer_id !== undefined) {
    // รหัสลูกค้า Hero (CUS-xxxxx) — เก็บตัวพิมพ์ใหญ่ตัดช่องว่าง ให้ตรงกับที่ /api/hero/points ใช้จับคู่บิล
    const code = String(customer_id ?? "").trim().toUpperCase() || null;
    if (code) {
      const taken = await sql`SELECT id FROM users WHERE UPPER(TRIM(customer_id)) = ${code} AND id <> ${id} LIMIT 1`;
      if (taken.length) return NextResponse.json({ error: `รหัส ${code} ผูกกับสมาชิกคนอื่นอยู่แล้ว` }, { status: 409 });
    }
    await sql`UPDATE users SET customer_id = ${code}, suggested_customer_id = NULL WHERE id = ${id}`;
    done.push(`รหัส Hero ${cur.customer_id ?? "-"} → ${code ?? "-"}`);
    // บิลที่ค้างไว้ตอนยังไม่ผูก = ปิดทิ้ง ไม่ให้แต้มย้อนหลัง (เจ้าของร้านตัดสินแล้วว่าไม่นับข้อมูลเก่า)
    // ปิดไว้เพื่อให้บัตรสมาชิก/หน้าแอดมินเลิกขึ้นคำเตือน และเหลือหลักฐานว่าตอนผูกมีบิลค้างกี่ใบ
    if (code) {
      try {
        const closed = await sql`UPDATE hero_pending_bills SET resolved_at = NOW() WHERE user_id = ${id} AND resolved_at IS NULL RETURNING bill_no`;
        if (closed.length) done.push(`ปิดบิลค้าง ${closed.length} ใบ (ไม่ให้แต้มย้อนหลัง)`);
      } catch (e) { console.error("[admin] ปิดบิลค้างไม่สำเร็จ", id, e); }
    }
  }

  if (phone !== undefined) {
    const tel = String(phone ?? "").replace(/\D/g, "");
    if (!/^0\d{9}$/.test(tel)) return NextResponse.json({ error: "เบอร์ต้องเป็น 10 หลัก ขึ้นต้น 0" }, { status: 400 });
    const taken = await sql`SELECT id FROM users WHERE phone = ${tel} AND id <> ${id} LIMIT 1`;
    if (taken.length) return NextResponse.json({ error: `เบอร์ ${tel} เป็นของสมาชิก id ${taken[0].id} อยู่แล้ว` }, { status: 409 });
    await sql`UPDATE users SET phone = ${tel} WHERE id = ${id}`;
    done.push(`เบอร์ ${cur.phone} → ${tel}`);
  }

  if (reset_line === true) {
    await sql`UPDATE users SET line_user_id = NULL WHERE id = ${id}`;
    done.push(`ปลด LINE เดิม (${String(cur.line_user_id ?? "-").slice(0, 8)}…) — รอสมัครใหม่ด้วยเบอร์ ${cur.phone}`);
  }

  if (done.length) await sql`INSERT INTO audit_log (action, target_user_id, detail) VALUES ('update_member', ${id}, ${`${who}: ${done.join(" · ")}`})`;
  return NextResponse.json({ success: true, done });
}
