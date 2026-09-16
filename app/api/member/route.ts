export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getUserByLineId, registerUser, migrateDB, RegisterError } from "@/lib/points";
import { sql } from "@/lib/db";
import { verifyLiffUser, isAuthError } from "@/lib/liff-auth";
import { reviewScenarioFrom, REVIEW_ENABLED_NOTE, REVIEW_SCENARIOS } from "@/lib/review-mode";

// ตัวตนมาจาก LIFF access token (Authorization: Bearer) ที่เซิร์ฟเวอร์ตรวจกับ LINE เอง — ไม่เชื่อ lineUserId ที่ client ส่งมาอีกแล้ว (14 ก.ย. 69)
export async function GET(req: NextRequest) {
  // โหมดรีวิว: คืนข้อมูลจำลอง ไม่แตะฐานข้อมูลจริง (ปิดตายบน production — ดู lib/review-mode.ts)
  const rv = reviewScenarioFrom(new URL(req.url));
  if (rv) return NextResponse.json({ review: REVIEW_ENABLED_NOTE, scenario: rv.key, profile: rv.profile, registered: rv.registered, user: rv.member, expiry: rv.expiry });

  const who = await verifyLiffUser(req);
  if (isAuthError(who)) return NextResponse.json({ error: who.error }, { status: who.status });

  const user = await getUserByLineId(who.userId);
  if (!user) return NextResponse.json({ registered: false });

  const expiryRows = await sql`
    SELECT MIN(expires_at) AS earliest_expiry,
           LEAST(SUM(points_earned)::int, ${user.points}::int) AS expiring_points
    FROM transactions
    WHERE user_id = ${user.id} AND type = 'earn' AND expired = FALSE AND cleared = FALSE AND expires_at IS NOT NULL
  `;
  const expiry = expiryRows[0] ?? null;

  return NextResponse.json({ registered: true, user, expiry });
}

export async function POST(req: NextRequest) {
  // โหมดรีวิว: ทำเหมือนสมัครสำเร็จ แต่ไม่เขียนอะไรลงฐานข้อมูล
  const rvPost = reviewScenarioFrom(new URL(req.url));
  if (rvPost) {
    const body = await req.json().catch(() => ({}));
    const tel = String(body.phone ?? "0812345678").replace(/\D/g, "");
    if (!/^0\d{9}$/.test(tel)) return NextResponse.json({ error: "เบอร์มือถือไม่ถูกต้อง (10 หลัก)" }, { status: 400 });
    const base = REVIEW_SCENARIOS.pending.member!;
    return NextResponse.json({
      success: true, isNew: true, review: REVIEW_ENABLED_NOTE,
      user: { ...base, phone: tel, first_name: body.firstName ?? base.first_name, last_name: body.lastName ?? base.last_name, company: body.company ?? null, birthday: body.birthday ?? base.birthday },
    });
  }

  const who = await verifyLiffUser(req);
  if (isAuthError(who)) return NextResponse.json({ error: who.error }, { status: who.status });

  const { phone, displayName, firstName, lastName, company, birthday } = await req.json();
  if (!phone || !firstName || !lastName || !birthday) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const tel = String(phone).replace(/\D/g, "");
  if (!/^0\d{9}$/.test(tel)) return NextResponse.json({ error: "เบอร์มือถือไม่ถูกต้อง (10 หลัก)" }, { status: 400 });

  await migrateDB();
  try {
    const result = await registerUser(who.userId, tel, displayName, firstName, lastName, company, birthday);
    const user = await getUserByLineId(who.userId);
    return NextResponse.json({ success: true, isNew: result.isNew, user });
  } catch (e) {
    if (e instanceof RegisterError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
