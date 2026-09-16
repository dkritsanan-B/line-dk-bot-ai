export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { migrateDB } from "@/lib/points";
import { usersWithDueLots, expireUserPoints, EXPIRE_USERS_PER_RUN } from "@/lib/points-ledger";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

async function pushMessage(lineUserId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }] }),
    });
    if (!res.ok) console.error(`[expire-points] ส่ง LINE ไม่ผ่าน ${res.status} ถึง ${lineUserId.slice(0, 6)}…`);
    return res.ok;
  } catch (e) {
    console.error("[expire-points] ส่ง LINE ไม่ผ่าน", e);
    return false;
  }
}

// ตัดแต้มที่ครบ 1 ปี — รันทุกคืน (vercel.json)
//
// 16 ก.ย. 69 เขียนใหม่ทั้งหมด: เดิมหัก "ทั้งก้อน" ของทุกก้อนที่ครบกำหนด โดยไม่ดูว่าลูกค้าแลกของ/ถูกถอนบิลไปแล้ว
// → ลูกค้าเสียแต้มซ้ำสอง · ตอนนี้คิดแบบเข้าก่อนออกก่อน (lib/points-ledger.ts) ทีละคน ในล็อกของคนนั้น
// รันซ้ำ / Vercel ยิงซ้อน / ลูกค้าแลกของระหว่างรัน → ไม่หักเกิน (มีเทสต์กับ Postgres จริงที่ tests/ledger-pg.test.mjs)
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await migrateDB();

  const now = Date.now();
  const userIds = await usersWithDueLots(db, now, EXPIRE_USERS_PER_RUN);

  let totalExpired = 0, applied = 0, skippedRace = 0, failed = 0, notified = 0;
  for (const id of userIds) {
    let r;
    try {
      r = await expireUserPoints(db, id, now);
    } catch (e) {
      failed++;
      console.error(`[expire-points] สมาชิก ${id} ล้มเหลว (รอบหน้าคิดใหม่เอง)`, e);
      continue;
    }
    if (!r.applied) { skippedRace++; continue; }
    applied++;
    totalExpired += r.expired;

    // ทักเฉพาะคนที่เสียแต้มจริง
    if (r.expired > 0 && r.lineUserId) {
      const sent = await pushMessage(
        r.lineUserId,
        `⚠️ แจ้งเตือนจาก DK Steel and Tools\n\nสวัสดีค่ะ ${r.firstName ?? "คุณ"} คะแนนสะสม ${r.expired.toLocaleString()} แต้มของคุณได้หมดอายุแล้วค่ะ\nแต้มคงเหลือตอนนี้ ${(r.balanceAfter ?? 0).toLocaleString()} แต้ม\n\nสะสมแต้มใหม่ได้ทุกการซื้อสินค้า ทุก 100 บาท = 1 แต้ม 🌟`,
      );
      if (sent) notified++;
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: userIds.length,
    capped: userIds.length >= EXPIRE_USERS_PER_RUN,   // true = ยังมีคนเหลือ รอบหน้าทำต่อ
    applied, skippedRace, failed, totalExpired, notified,
  });
}
