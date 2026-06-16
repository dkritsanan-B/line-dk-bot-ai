export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

async function pushMessage(to: string, text: string) {
  await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
}

function auth(req: NextRequest) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}

// GET — ดึงรายการ pending
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS redemption_requests (
        id           SERIAL PRIMARY KEY,
        user_id      INT NOT NULL,
        reward_id    INT NOT NULL,
        points_required INT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'pending',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confirmed_at TIMESTAMPTZ
      )
    `;
    const rows = await sql`
      SELECT r.id, r.status, r.points_required, r.created_at, r.confirmed_at,
             u.first_name, u.last_name, u.display_name, u.phone, u.line_user_id,
             rw.name AS reward_name, rw.image_url, rw.stock
      FROM redemption_requests r
      JOIN users u  ON u.id  = r.user_id
      JOIN rewards rw ON rw.id = r.reward_id
      ORDER BY r.created_at DESC
      LIMIT 100
    `;
    return NextResponse.json({ requests: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — confirm หรือ cancel
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, action } = await req.json(); // action: 'confirm' | 'cancel'
    if (!id || !action) return NextResponse.json({ error: "missing fields" }, { status: 400 });

    const rows = await sql`
      SELECT r.*, u.line_user_id, u.points, rw.name AS reward_name, rw.stock, rw.id AS reward_id
      FROM redemption_requests r
      JOIN users u  ON u.id  = r.user_id
      JOIN rewards rw ON rw.id = r.reward_id
      WHERE r.id = ${id} AND r.status = 'pending'
      LIMIT 1
    `;
    if (rows.length === 0) return NextResponse.json({ error: "ไม่พบคำขอ หรือดำเนินการไปแล้ว" }, { status: 404 });
    const req2 = rows[0];

    if (action === "confirm") {
      if ((req2.points as number) < (req2.points_required as number)) {
        return NextResponse.json({ error: "แต้มลูกค้าไม่พอแล้ว" }, { status: 400 });
      }
      // หักแต้ม
      await sql`UPDATE users SET points = points - ${req2.points_required as number} WHERE id = ${req2.user_id as number}`;
      // บันทึก transaction
      await sql`
        INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note)
        VALUES (${req2.user_id as number}, 0, ${req2.points_required as number}, 'redeem', ${`แลก: ${req2.reward_name as string} (#REQ-${id as number})`})
      `;
      // ลด stock
      if (req2.stock !== null) {
        await sql`UPDATE rewards SET stock = GREATEST(0, stock - 1) WHERE id = ${req2.reward_id as number}`;
      }
      // อัพเดต status
      await sql`UPDATE redemption_requests SET status = 'confirmed', confirmed_at = NOW() WHERE id = ${id}`;
      // แจ้งลูกค้า
      if (req2.line_user_id) {
        await pushMessage(req2.line_user_id as string,
          `🎉 ยืนยันแลกของรางวัลแล้วค่ะ!\n\n🎁 ${req2.reward_name as string}\n⭐ หักแต้ม ${(req2.points_required as number).toLocaleString()} แต้ม\n\nขอบคุณที่ใช้บริการ DK Steel and Tools นะคะ 😊`
        );
      }
      return NextResponse.json({ success: true, action: "confirmed" });
    }

    if (action === "cancel") {
      await sql`UPDATE redemption_requests SET status = 'cancelled' WHERE id = ${id}`;
      if (req2.line_user_id) {
        await pushMessage(req2.line_user_id as string,
          `❌ คำขอแลก ${req2.reward_name as string} (#REQ-${id as number}) ถูกยกเลิกแล้วค่ะ\n\nหากมีข้อสงสัย กรุณาติดต่อพนักงานที่ร้านได้เลยค่ะ`
        );
      }
      return NextResponse.json({ success: true, action: "cancelled" });
    }

    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
