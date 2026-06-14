export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { migrateDB } from "@/lib/points";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

async function pushMessage(lineUserId: string, text: string) {
  const res = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }] }),
  });
  return res.ok;
}

export async function GET(req: NextRequest) {
  await migrateDB();

  const action = req.nextUrl.searchParams.get("action");
  const phone  = req.nextUrl.searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ error: "ต้องระบุ ?phone=เบอร์โทร" }, { status: 400 });
  }

  const users = await sql`SELECT * FROM users WHERE phone = ${phone} LIMIT 1`;
  if (!users[0]) return NextResponse.json({ error: "ไม่พบสมาชิกเบอร์นี้" }, { status: 404 });
  const user = users[0] as { id: number; line_user_id: string; first_name: string; points: number };

  // ── status: ดูข้อมูล transactions ──────────────────────────────
  if (!action || action === "status") {
    const txs = await sql`
      SELECT id, points_earned, type, expired, created_at, expires_at
      FROM transactions WHERE user_id = ${user.id} ORDER BY created_at DESC
    `;
    return NextResponse.json({ user, transactions: txs });
  }

  // ── set-expire: ตั้งให้หมดอายุเมื่อวาน แล้วตัดคะแนนทันที ──────
  if (action === "set-expire") {
    await sql`
      UPDATE transactions SET expires_at = NOW() - INTERVAL '1 day'
      WHERE user_id = ${user.id} AND type = 'earn' AND expired = FALSE
    `;

    // รัน expire logic ทันที
    const expiring = await sql`
      SELECT id, points_earned FROM transactions
      WHERE user_id = ${user.id} AND type = 'earn' AND expired = FALSE AND expires_at <= NOW()
    `;
    let totalExpired = 0;
    for (const t of expiring) {
      const toExpire = Math.min(t.points_earned as number, user.points - totalExpired);
      if (toExpire > 0) {
        await sql`UPDATE users SET points = GREATEST(points - ${toExpire}, 0) WHERE id = ${user.id}`;
        await sql`INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note)
                  VALUES (${user.id}, 0, ${toExpire}, 'expire', 'ทดสอบ: คะแนนหมดอายุ')`;
        totalExpired += toExpire;
      }
      await sql`UPDATE transactions SET expired = TRUE WHERE id = ${t.id}`;
    }

    // ส่ง LINE แจ้งเตือน
    let lineSent = false;
    if (user.line_user_id && totalExpired > 0) {
      lineSent = await pushMessage(
        user.line_user_id,
        `⚠️ แจ้งเตือนจาก DK Steel and Tools\n\n${user.first_name ?? "คุณ"} คะแนนสะสม ${totalExpired} แต้มของคุณได้หมดอายุแล้วค่ะ\n\nสะสมแต้มใหม่ได้ทุกการซื้อสินค้า ทุก 100 บาท = 1 แต้ม 🌟`
      );
    }

    return NextResponse.json({ ok: true, totalExpired, lineSent });
  }

  // ── set-notify1m: ตั้งให้หมดอายุใน 30 วัน แล้วส่งแจ้งเตือนทันที (จำลอง cron notify-expiry) ──
  if (action === "set-notify1m") {
    await sql`
      UPDATE transactions
      SET expires_at = NOW() + INTERVAL '30 days', notified_1m = FALSE
      WHERE user_id = ${user.id} AND type = 'earn' AND expired = FALSE
    `;
    const expDate = new Date(Date.now() + 30 * 86400000).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
    const rows = await sql`
      SELECT SUM(points_earned)::int AS pts FROM transactions
      WHERE user_id = ${user.id} AND type = 'earn' AND expired = FALSE
    `;
    const pts = rows[0]?.pts ?? 0;

    let lineSent = false;
    if (user.line_user_id) {
      lineSent = await pushMessage(
        user.line_user_id,
        `⏰ แจ้งเตือนจาก DK Steel and Tools\n\nสวัสดีค่ะ ${user.first_name ?? "คุณ"} คะแนนสะสม ${pts} แต้มของคุณจะหมดอายุในอีก 30 วัน\n📅 วันหมดอายุ: ${expDate}\n\nอย่าลืมมาแลกของรางวัลที่ร้านก่อนหมดอายุนะคะ 🎁`
      );
    }
    if (lineSent) {
      await sql`
        UPDATE transactions SET notified_1m = TRUE
        WHERE user_id = ${user.id} AND type = 'earn' AND expired = FALSE
      `;
    }
    return NextResponse.json({ ok: true, expiringPoints: pts, lineSent });
  }

  // ── reset: คืนสถานะทุกอย่างกลับ (ใช้หลังเทส) ─────────────────
  if (action === "reset") {
    // ลบ transaction ประเภท expire ที่สร้างจากการเทส
    const expired = await sql`
      SELECT SUM(points_earned)::int AS pts FROM transactions
      WHERE user_id = ${user.id} AND type = 'expire'
    `;
    const ptsToRestore = expired[0]?.pts ?? 0;

    await sql`DELETE FROM transactions WHERE user_id = ${user.id} AND type = 'expire'`;

    // คืน expired = FALSE, expires_at = 1 ปีจาก created_at, notified_1m = FALSE ให้ earn transactions
    await sql`
      UPDATE transactions
      SET expired = FALSE, expires_at = created_at + INTERVAL '1 year', notified_1m = FALSE
      WHERE user_id = ${user.id} AND type = 'earn'
    `;

    // คืนคะแนน
    if (ptsToRestore > 0) {
      await sql`UPDATE users SET points = points + ${ptsToRestore} WHERE id = ${user.id}`;
    }

    return NextResponse.json({ ok: true, message: `reset สำเร็จ คืนคะแนน ${ptsToRestore} แต้ม` });
  }

  return NextResponse.json({ error: "action ไม่ถูกต้อง: status / set-expire / set-notify1m / reset" }, { status: 400 });
}
