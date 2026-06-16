export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const STAFF_GROUP_ID = process.env.LINE_STAFF_GROUP_ID ?? "";

async function pushMessage(to: string, messages: object[]) {
  await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ to, messages }),
  });
}

export async function POST(req: NextRequest) {
  const { lineUserId, rewardId } = await req.json();
  if (!lineUserId || !rewardId) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  const userRows = await sql`SELECT * FROM users WHERE line_user_id = ${lineUserId} LIMIT 1`;
  const user = userRows[0];
  if (!user) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });

  const rewardRows = await sql`SELECT * FROM rewards WHERE id = ${rewardId} AND active = TRUE LIMIT 1`;
  const reward = rewardRows[0];
  if (!reward) return NextResponse.json({ error: "ไม่พบของรางวัล" }, { status: 404 });

  if ((user.points as number) < (reward.points_required as number)) {
    return NextResponse.json({ error: "แต้มไม่พอ" }, { status: 400 });
  }

  // สร้าง redemption request
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

  // เช็คว่ามี pending request อยู่แล้วไหม
  const existing = await sql`
    SELECT id FROM redemption_requests
    WHERE user_id = ${user.id as number} AND reward_id = ${rewardId} AND status = 'pending'
    LIMIT 1
  `;
  if (existing.length > 0) {
    return NextResponse.json({ error: "คุณมีคำขอแลกรางวัลนี้รออยู่แล้ว" }, { status: 400 });
  }

  const result = await sql`
    INSERT INTO redemption_requests (user_id, reward_id, points_required)
    VALUES (${user.id as number}, ${rewardId}, ${reward.points_required as number})
    RETURNING id
  `;
  const requestId = result[0].id;

  const name = (user.first_name as string) ? `${user.first_name} ${user.last_name}` : (user.display_name as string) ?? "ลูกค้า";

  // แจ้งพนักงานใน group
  if (STAFF_GROUP_ID) {
    await pushMessage(STAFF_GROUP_ID, [{
      type: "text",
      text: `🎁 มีคำขอแลกของรางวัล!\n\n👤 ${name}\n📱 ${user.phone as string}\n🎁 ${reward.name as string}\n⭐ ${(reward.points_required as number).toLocaleString()} แต้ม\n\n🔗 ยืนยันที่ Admin Panel\n#REQ-${requestId as number}`,
    }]);
  }

  // แจ้งลูกค้า
  await pushMessage(lineUserId, [{
    type: "text",
    text: `✅ ส่งคำขอแลกของรางวัลแล้วค่ะ!\n\n🎁 ${reward.name as string}\n⭐ ${(reward.points_required as number).toLocaleString()} แต้ม\n\n📋 หมายเลขคำขอ: #REQ-${requestId as number}\n\nกรุณาเดินทางมารับที่ร้านได้เลยค่ะ พนักงานจะยืนยันและหักแต้มให้เมื่อรับของ 😊`,
  }]);

  return NextResponse.json({ success: true, requestId });
}
