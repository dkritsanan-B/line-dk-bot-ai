export const runtime = "nodejs";

/**
 * TEST ONLY — ใช้สำหรับทดสอบระบบ cron เท่านั้น
 * GET /api/cron/test?action=expire&lineUserId=Uxxxxxxx   → ตั้ง expires_at เป็นเมื่อวาน (ทดสอบตัดคะแนน)
 * GET /api/cron/test?action=notify3m&lineUserId=Uxxxxxxx → ตั้ง expires_at เป็น 90 วันข้างหน้า (ทดสอบแจ้งเตือน 3 เดือน)
 * GET /api/cron/test?action=notify1m&lineUserId=Uxxxxxxx → ตั้ง expires_at เป็น 30 วันข้างหน้า (ทดสอบแจ้งเตือน 1 เดือน)
 * GET /api/cron/test?action=status&lineUserId=Uxxxxxxx   → ดูสถานะ transactions ปัจจุบัน
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const action     = req.nextUrl.searchParams.get("action");
  const lineUserId = req.nextUrl.searchParams.get("lineUserId");
  const phone      = req.nextUrl.searchParams.get("phone");

  if (!lineUserId && !phone) {
    return NextResponse.json({ error: "ต้องระบุ lineUserId หรือ phone" }, { status: 400 });
  }

  const users = lineUserId
    ? await sql`SELECT * FROM users WHERE line_user_id = ${lineUserId} LIMIT 1`
    : await sql`SELECT * FROM users WHERE phone = ${phone} LIMIT 1`;
  if (!users[0]) return NextResponse.json({ error: "ไม่พบ user" }, { status: 404 });
  const user = users[0];

  if (action === "status") {
    const txs = await sql`
      SELECT id, points_earned, type, expired, created_at, expires_at
      FROM transactions
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ user, transactions: txs });
  }

  if (action === "expire") {
    // ตั้ง expires_at เป็นเมื่อวาน → cron expire-points จะตัดออก
    await sql`
      UPDATE transactions
      SET expires_at = NOW() - INTERVAL '1 day'
      WHERE user_id = ${user.id} AND type = 'earn' AND expired = FALSE
    `;
    return NextResponse.json({ ok: true, message: "ตั้ง expires_at เป็นเมื่อวานแล้ว → ลองเรียก /api/cron/expire-points" });
  }

  if (action === "notify3m") {
    // ตั้ง expires_at เป็น 90 วันข้างหน้า → cron notify-expiry จะแจ้งเตือน 3 เดือน
    await sql`
      UPDATE transactions
      SET expires_at = NOW() + INTERVAL '90 days'
      WHERE user_id = ${user.id} AND type = 'earn' AND expired = FALSE
    `;
    return NextResponse.json({ ok: true, message: "ตั้ง expires_at เป็น 90 วันข้างหน้าแล้ว → ลองเรียก /api/cron/notify-expiry" });
  }

  if (action === "notify1m") {
    // ตั้ง expires_at เป็น 30 วันข้างหน้า → cron notify-expiry จะแจ้งเตือน 1 เดือน
    await sql`
      UPDATE transactions
      SET expires_at = NOW() + INTERVAL '30 days'
      WHERE user_id = ${user.id} AND type = 'earn' AND expired = FALSE
    `;
    return NextResponse.json({ ok: true, message: "ตั้ง expires_at เป็น 30 วันข้างหน้าแล้ว → ลองเรียก /api/cron/notify-expiry" });
  }

  return NextResponse.json({ error: "action ไม่ถูกต้อง (expire / notify3m / notify1m / status)" }, { status: 400 });
}
