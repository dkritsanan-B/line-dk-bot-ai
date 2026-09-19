export const runtime = "nodejs";
export const maxDuration = 60;

import { pushLine } from "@/lib/line-push";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { migrateDB } from "@/lib/points";
import { usersWithDueLots, expireUserPoints, previewExpiredPoints, EXPIRE_USERS_PER_RUN } from "@/lib/points-ledger";
import { pointsExpiredFlex } from "@/lib/line-ui";


const SEND_EXPIRED_NOTICE = process.env.SEND_EXPIRED_NOTICE === "1";

async function pushMessage(lineUserId: string, message: object): Promise<boolean> {
  // ตัวส่งกลาง: ดูโควตาก่อนส่ง · ความสำคัญ "notice" (ดู lib/line-push.ts)
  return (await pushLine(lineUserId, message, "notice")).sent;
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

  const now = Date.now();
  if (req.nextUrl.searchParams.get("dry") === "1") {
    const preview = await previewExpiredPoints(db, now);
    return NextResponse.json({ ok: true, dryRun: true, ...preview });
  }

  await migrateDB();

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

    // ทักเฉพาะคนที่เสียแต้มจริง — ปิดไว้ตามเจ้าของร้าน (19 ก.ย. 69): แจ้งหลังแต้มหายแล้วลูกค้าทำอะไรไม่ได้
    // และมีเตือนล่วงหน้า (cron/notify-expiry) อยู่แล้ว · เปิดกลับได้ด้วย env SEND_EXPIRED_NOTICE=1
    if (SEND_EXPIRED_NOTICE && r.expired > 0 && r.lineUserId) {
      const sent = await pushMessage(
        r.lineUserId,
        pointsExpiredFlex({ name: r.firstName ?? "คุณ", points: r.expired, balance: r.balanceAfter ?? 0 }),
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
