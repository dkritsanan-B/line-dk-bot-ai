export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyLiffUser, isAuthError } from "@/lib/liff-auth";
import { reviewScenarioFrom, REVIEW_REWARDS, REVIEW_REWARD_RESERVED } from "@/lib/review-mode";
import { apiError, apiOk, authError, dbError, reviewFaultResponse, type ApiErrorCode } from "@/app/api/_lib/api-error";
import {
  createRedemptionRequest, decideRedemption, readPendingSummary,
  type RedeemErrorCode, type SqlTag,
} from "./logic";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const STAFF_GROUP_ID = process.env.LINE_STAFF_GROUP_ID ?? "";

// ตรรกะทั้งหมดอยู่ใน ./logic.ts (ทดสอบได้โดยไม่ต่อฐานข้อมูล — tests/redeem-guard.test.ts)
// route นี้ทำแค่ 3 อย่าง: ตรวจตัวตน → เรียกตรรกะ → ส่ง LINE เมื่อสำเร็จจริงเท่านั้น
const db = sql as unknown as SqlTag;

/** RedeemErrorCode → code กลางของ API (app/api/_lib/api-error.ts) */
const CODE_MAP: Record<RedeemErrorCode, ApiErrorCode> = {
  NOT_REGISTERED: "NOT_REGISTERED",
  REWARD_NOT_FOUND: "REWARD_NOT_FOUND",
  REWARD_OUT_OF_STOCK: "REWARD_OUT_OF_STOCK",
  NOT_ENOUGH_POINTS: "NOT_ENOUGH_POINTS",
  DUPLICATE_REQUEST: "DUPLICATE_REQUEST",
  RACE_LOST: "RACE_LOST",
};

async function pushMessage(to: string, messages: object[]) {
  await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ to, messages }),
  });
}

/**
 * GET — แต้มที่ "ใช้ได้จริง" + คำขอที่ยังรอรับของ
 * มีไว้ให้หน้าเว็บบอกลูกค้าล่วงหน้าได้ว่าแต้มถูกจองไว้เท่าไหร่ แทนที่จะให้กดแล้วค่อยเด้ง error
 */
export async function GET(req: NextRequest) {
  const rv = reviewScenarioFrom(new URL(req.url));
  if (rv) {
    const fault = reviewFaultResponse(rv.fault);
    if (fault) return fault;
    if (!rv.member) return apiOk({ registered: false, code: "NOT_REGISTERED" });
    const pending = rv.pendingRedemptions ?? [];
    const pendingPoints = pending.reduce((s, p) => s + p.points_required, 0);
    return apiOk({
      review: true,
      points: rv.member.points,
      pending_points: pendingPoints,
      available_points: rv.member.points - pendingPoints,
      pending: pending.map((p, i) => ({
        id: 9000 + i, reward_id: p.reward_id, points_required: p.points_required,
        reward_name: REVIEW_REWARDS.find(r => r.id === p.reward_id)?.name ?? null,
        created_at: new Date().toISOString(),
      })),
      reserved_by_reward: REVIEW_REWARDS.reduce<Record<string, number>>((acc, r) => {
        const c = (REVIEW_REWARD_RESERVED[r.id] ?? 0) + pending.filter(p => p.reward_id === r.id).length;
        if (c > 0) acc[String(r.id)] = c;
        return acc;
      }, {}),
    });
  }

  const who = await verifyLiffUser(req);
  if (isAuthError(who)) return authError(who);
  try {
    const summary = await readPendingSummary(db, who.userId);
    if (!summary) return apiOk({ registered: false, code: "NOT_REGISTERED" });
    return apiOk({ ...summary });
  } catch (e) {
    return dbError(e, "GET /api/liff/redeem");
  }
}

export async function POST(req: NextRequest) {
  // โหมดรีวิว: ตัดสินด้วยกติกาตัวเดียวกับของจริง (decideRedemption) แต่ป้อนข้อมูลจำลอง
  // ไม่แตะฐานข้อมูลและไม่ส่ง LINE แม้แต่ข้อความเดียว (โควตา push มีจำกัด)
  const rv = reviewScenarioFrom(new URL(req.url));
  if (rv) {
    const fault = reviewFaultResponse(rv.fault);
    if (fault) return fault;
    const body = await req.json().catch(() => ({}));
    const rewardId = Number((body as { rewardId?: unknown })?.rewardId ?? 0);
    const rw = REVIEW_REWARDS.find(x => x.id === rewardId) ?? null;
    const pending = rv.pendingRedemptions ?? [];
    const decision = decideRedemption({
      user: rv.member ? { id: rv.member.id, points: rv.member.points } : null,
      reward: rw,
      pendingPoints: pending.reduce((s, p) => s + p.points_required, 0),
      samePending: pending.filter(p => p.reward_id === rewardId).length,
      // ของที่ถูกจอง = คำขอของสมาชิกคนนี้ + คำขอจำลองของสมาชิกท่านอื่น
      rewardPending: pending.filter(p => p.reward_id === rewardId).length + (REVIEW_REWARD_RESERVED[rewardId] ?? 0),
    });
    if (!decision.ok) return apiError(CODE_MAP[decision.code], { message: decision.error });
    return apiOk({
      success: true, review: true, requestId: 9000 + rewardId,
      available_points: decision.availableAfter, stock_left: decision.stockLeft,
    });
  }

  // ตัวตน = เจ้าของ LIFF token (ตรวจกับ LINE ฝั่งเซิร์ฟเวอร์) — ไม่รับ lineUserId จาก client แล้ว กันคนอื่นกดแลกของแทน
  const who = await verifyLiffUser(req);
  if (isAuthError(who)) return authError(who);
  const lineUserId = who.userId;

  const body = await req.json().catch(() => null);
  const rewardId = Number((body as { rewardId?: unknown } | null)?.rewardId ?? 0);
  if (!Number.isInteger(rewardId) || rewardId <= 0) return apiError("BAD_REQUEST");

  let result;
  try {
    result = await createRedemptionRequest(db, lineUserId, rewardId);
  } catch (e) {
    return dbError(e, "POST /api/liff/redeem");
  }
  if (!result.ok) return apiError(CODE_MAP[result.code], { message: result.error });

  const { requestId, user, reward, decision } = result;
  const name = (user.first_name as string) ? `${user.first_name} ${user.last_name}` : (user.display_name as string) ?? "ลูกค้า";
  const rewardName = String(reward.name ?? "ของรางวัล");
  const cost = Number(reward.points_required ?? 0);

  // ส่ง LINE ได้ก็ต่อเมื่อคำขอถูกบันทึกจริงและผ่านด่านจองแต้ม/จองของครบแล้วเท่านั้น
  // (บั๊กเดิมส่ง "มารับที่ร้านได้เลยค่ะ" ให้ทุกใบ รวมใบที่แต้มไม่พอจริง)
  try {
    if (STAFF_GROUP_ID) {
      await pushMessage(STAFF_GROUP_ID, [{
        type: "text",
        text: `🎁 มีคำขอแลกของรางวัล!\n\n👤 ${name}\n📱 ${user.phone as string}\n🎁 ${rewardName}\n⭐ ${cost.toLocaleString()} แต้ม\n\n🔗 ยืนยันที่ Admin Panel\n#REQ-${requestId}`,
      }]);
    }
    await pushMessage(lineUserId, [{
      type: "text",
      text: `✅ ส่งคำขอแลกของรางวัลแล้วค่ะ!\n\n🎁 ${rewardName}\n⭐ ${cost.toLocaleString()} แต้ม\n\n📋 หมายเลขคำขอ: #REQ-${requestId}\n\nแต้มนี้ถูกจองไว้ให้แล้ว เหลือแต้มใช้ได้อีก ${decision.availableAfter.toLocaleString()} แต้ม\nมารับของที่ร้านได้เลยค่ะ พนักงานจะยืนยันและหักแต้มตอนรับของ 😊`,
    }]);
  } catch (e) {
    // คำขอบันทึกแล้ว ส่ง LINE ไม่ผ่านไม่ใช่เหตุให้บอกลูกค้าว่าล้มเหลว (จะกดซ้ำแล้วเจอ "มีคำขอค้างอยู่")
    console.error("[redeem] ส่ง LINE ไม่สำเร็จ แต่คำขอถูกบันทึกแล้ว #REQ-" + requestId, e);
  }

  return apiOk({
    success: true, requestId,
    available_points: decision.availableAfter,
    stock_left: decision.stockLeft,
  });
}
