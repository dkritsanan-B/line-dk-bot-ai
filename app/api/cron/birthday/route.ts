export const runtime = "nodejs";

import { pushLine } from "@/lib/line-push";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getEffectiveTier, migrateDB } from "@/lib/points";
import { tierIndex } from "@/lib/tierRules";
import { birthdayGiftFlex } from "@/lib/line-ui";

// คูปองวันเกิด (ตารางสิทธิ์ 13 ก.ย. 69): Bronze 100 · Silver 200 · Gold 500 · Platinum 800 · Diamond 1,000 — Welcome ไม่ได้
// ให้เป็น "แต้มโบนัส" (1 แต้ม = มูลค่า 1 บาท เหมือนโบนัสตามหมวด) ไม่นับ total_earned ไม่ดันระดับ · หมดอายุ 1 ปี · ปีละครั้ง
// Vercel cron ทุกวัน 01:00 UTC = 08:00 ไทย · push LINE แจ้งเจ้าของวันเกิด 1 ข้อความ (วันเกิดมีไม่กี่คน/วัน ไม่กินโควตา)
const BIRTHDAY_POINTS = [0, 100, 200, 500, 800, 1000];   // index = tierIndex (Welcome..Diamond)

async function push(to: string, message: object): Promise<boolean> {
  // ตัวส่งกลาง: ดูโควตาก่อนส่ง · ความสำคัญ "courtesy" (ดู lib/line-push.ts)
  return (await pushLine(to, message, "courtesy")).sent;
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await migrateDB();

  // วันนี้ตามเวลาไทย
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const mm = now.getUTCMonth() + 1, dd = now.getUTCDate(), yyyy = now.getUTCFullYear();
  const tag = `วันเกิด ${yyyy}`;
  const users = await sql`
    SELECT id, first_name, display_name, phone, line_user_id, total_earned, points, last_purchase_at
    FROM users
    WHERE birthday IS NOT NULL
      AND EXTRACT(MONTH FROM birthday) = ${mm} AND EXTRACT(DAY FROM birthday) = ${dd}
      AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = users.id AND t.note LIKE ${tag + "%"})
  `;
  const out: { id: number; name: string; tier: string; points: number; pushed: boolean }[] = [];
  for (const u of users) {
    const tier = getEffectiveTier(Number(u.total_earned ?? 0), Number(u.points ?? 0), (u.last_purchase_at as string | null) ?? null);
    const pts = BIRTHDAY_POINTS[tierIndex(tier)] ?? 0;
    const name = (u.first_name as string) || (u.display_name as string) || (u.phone as string);
    if (pts <= 0) { out.push({ id: u.id as number, name, tier: tier.name, points: 0, pushed: false }); continue; }
    await sql`UPDATE users SET points = points + ${pts} WHERE id = ${u.id as number}`;
    await sql`
      INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note, expires_at)
      VALUES (${u.id as number}, 0, ${pts}, 'earn', ${`${tag} — คูปองวันเกิดระดับ ${tier.name}`}, NOW() + INTERVAL '1 year')
    `;
    const pushed = u.line_user_id
      ? await push(u.line_user_id as string, birthdayGiftFlex({ name, tierName: tier.name, tierEmoji: tier.emoji, points: pts }))
      : false;
    out.push({ id: u.id as number, name, tier: tier.name, points: pts, pushed });
  }
  return NextResponse.json({ date: `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`, count: out.length, given: out });
}
