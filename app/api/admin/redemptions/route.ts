export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql, db } from "@/lib/db";
import { getAdminRole, hasRole } from "@/lib/admin-auth";
import { confirmRedemption, cancelRedemption } from "./logic";
import { redemptionCancelledFlex, redemptionConfirmedFlex } from "@/lib/line-ui";
import { ADMIN_REVIEW_REDEMPTIONS, isAdminReviewRequest } from "@/lib/review-admin";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

async function pushMessage(to: string, message: object) {
  await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ to, messages: [message] }),
  });
}

async function auth(req: NextRequest) {
  const role = await getAdminRole(req);
  return hasRole(role, "staff");
}

// GET — ดึงรายการ pending
export async function GET(req: NextRequest) {
  if (isAdminReviewRequest(req.nextUrl)) return NextResponse.json({ requests: ADMIN_REVIEW_REDEMPTIONS, review: true });
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
  if (isAdminReviewRequest(req.nextUrl)) {
    const { id, action } = await req.json();
    if (!id || !["confirm", "cancel"].includes(action)) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    return NextResponse.json({ success: true, action: action === "confirm" ? "confirmed" : "cancelled", review: true });
  }
  if (!await auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, action } = await req.json(); // action: 'confirm' | 'cancel'
    if (!id || !action) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    if (action !== "confirm" && action !== "cancel") return NextResponse.json({ error: "invalid action" }, { status: 400 });

    // ตรรกะทั้งหมดอยู่ใน ./logic.ts — ยืนยัน = คำสั่งเดียวที่สำเร็จทั้งหมดหรือไม่เขียนอะไรเลย (tests/admin-confirm-pg.test.mjs)
    const result = action === "confirm"
      ? await confirmRedemption(db, Number(id))
      : await cancelRedemption(db, Number(id));

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    const row = result.row;
    if (result.action === "confirmed") {
      if (row.line_user_id) {
        await pushMessage(row.line_user_id, redemptionConfirmedFlex({ rewardName: row.reward_name, points: row.points_required, balance: result.pointsLeft }));
      }
      return NextResponse.json({ success: true, action: "confirmed", points_left: result.pointsLeft, stock_left: result.stockLeft });
    }

    if (row.line_user_id) {
      await pushMessage(row.line_user_id, redemptionCancelledFlex({ rewardName: row.reward_name, points: row.points_required, requestId: row.id }));
    }
    return NextResponse.json({ success: true, action: "cancelled" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
