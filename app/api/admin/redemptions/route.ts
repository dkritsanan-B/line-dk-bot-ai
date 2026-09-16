export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getAdminRole, hasRole } from "@/lib/admin-auth";
import type { SqlTag } from "@/app/api/liff/redeem/logic";
import { confirmRedemption, cancelRedemption } from "./logic";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

async function pushMessage(to: string, text: string) {
  await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
}

async function auth(req: NextRequest) {
  const role = await getAdminRole(req);
  return hasRole(role, "staff");
}

// GET — ดึงรายการ pending
export async function GET(req: NextRequest) {
  if (!await auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  if (!await auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, action } = await req.json(); // action: 'confirm' | 'cancel'
    if (!id || !action) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    if (action !== "confirm" && action !== "cancel") return NextResponse.json({ error: "invalid action" }, { status: 400 });

    // ตรรกะทั้งหมด (ยึดคำขอ → ตัดสต๊อกเฉพาะที่ยังเหลือจริง → หักแต้มเฉพาะที่ยังพอ → ถอยคืนถ้าติดขัด)
    // อยู่ใน ./logic.ts ทดสอบได้โดยไม่ต่อฐานข้อมูล — tests/admin-confirm.test.ts
    const db = sql as unknown as SqlTag;
    const result = action === "confirm"
      ? await confirmRedemption(db, Number(id))
      : await cancelRedemption(db, Number(id));

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    const row = result.row;
    if (result.action === "confirmed") {
      if (row.line_user_id) {
        await pushMessage(row.line_user_id,
          `🎉 ยืนยันแลกของรางวัลแล้วค่ะ!\n\n🎁 ${row.reward_name}\n⭐ หักแต้ม ${row.points_required.toLocaleString()} แต้ม\n⭐ แต้มคงเหลือ ${result.pointsLeft.toLocaleString()} แต้ม\n\nขอบคุณที่ใช้บริการ DK Steel and Tools นะคะ 😊`
        );
      }
      return NextResponse.json({ success: true, action: "confirmed", points_left: result.pointsLeft, stock_left: result.stockLeft });
    }

    if (row.line_user_id) {
      await pushMessage(row.line_user_id,
        `❌ คำขอแลก ${row.reward_name} (#REQ-${row.id}) ถูกยกเลิกแล้วค่ะ\n\nแต้ม ${row.points_required.toLocaleString()} แต้มที่จองไว้ ถูกปล่อยคืนให้ใช้แลกรายการอื่นได้แล้ว\nหากมีข้อสงสัย กรุณาติดต่อพนักงานที่ร้านได้เลยค่ะ`
      );
    }
    return NextResponse.json({ success: true, action: "cancelled" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
