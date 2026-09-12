export const runtime = "nodejs";

// ===================================================================
//  /api/hero/points — สะพานจาก Hero ERP → แต้มสมาชิก (ตัดสินใจ 12 ก.ย. 69)
//
//  ลูกค้าสมัครสมาชิกเองใน LINE → พนักงานผูก "รหัสลูกค้า Hero" (users.customer_id = CSCUSTOMER.CODE เช่น CUS-10595)
//  → บอทบนเครื่องร้าน (trello_approve/hero_points_watch.js) อ่านบิลขายใหม่จาก Hero ทุก 1 นาที
//  → ยิงมาที่นี่ → ให้แต้มอัตโนมัติ (100 บาท = 1 แต้ม) ไม่ต้องมีคนคีย์
//
//  GET  → รายชื่อรหัสลูกค้าที่ผูกแล้ว (watcher ใช้กรองบิลก่อนส่ง จะได้ไม่ยิงบิลลูกค้าทั่วไป 900 ใบ/เดือน)
//  POST → { bills: [{ customer_code, bill_no, amount, date }] } ให้แต้มทีละบิล กันซ้ำด้วยตาราง hero_point_bills (bill_no unique)
//
//  ยืนยันตัวด้วย header x-hero-secret = env HERO_POINTS_SECRET (ตั้งทั้ง Vercel และ .env.local ที่เครื่องร้าน)
//  แจ้ง LINE เฉพาะตอน "เลื่อนระดับ" — push ต่อบิลจะกินโควตาฟรี 300 ข้อความ/เดือนหมดในไม่กี่วัน
// ===================================================================
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { addPoints, getUserByPhone, getTierFromPoints, migrateDB } from "@/lib/points";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

function authed(req: NextRequest): boolean {
  const secret = process.env.HERO_POINTS_SECRET ?? "";
  return secret.length >= 16 && req.headers.get("x-hero-secret") === secret;
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS hero_point_bills (
      bill_no       TEXT PRIMARY KEY,
      user_id       INT NOT NULL,
      customer_code TEXT NOT NULL,
      amount        NUMERIC NOT NULL,
      points        INT NOT NULL,
      bill_date     DATE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function pushText(to: string, text: string) {
  try {
    await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
    });
  } catch (e) { console.error("[hero-points] push failed", e); }
}

const normCode = (v: unknown) => String(v ?? "").trim().toUpperCase();

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await sql`SELECT customer_id FROM users WHERE customer_id IS NOT NULL AND customer_id <> ''`;
  const codes = [...new Set(rows.map((r) => normCode(r.customer_id)).filter(Boolean))];
  return NextResponse.json({ codes }, { headers: { "Cache-Control": "no-store" } });
}

interface BillIn { customer_code?: unknown; bill_no?: unknown; amount?: unknown; date?: unknown }

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { bills?: BillIn[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const bills = Array.isArray(body.bills) ? body.bills.slice(0, 200) : [];
  if (!bills.length) return NextResponse.json({ error: "no bills" }, { status: 400 });

  await migrateDB();
  await ensureTable();

  const results: { bill_no: string; status: string; points?: number; name?: string; message?: string }[] = [];
  for (const b of bills) {
    const billNo = String(b.bill_no ?? "").trim();
    const code = normCode(b.customer_code);
    const amount = Number(b.amount);
    const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(b.date) ? b.date.slice(0, 10) : null;
    if (!billNo || !code || !Number.isFinite(amount)) { results.push({ bill_no: billNo, status: "error", message: "ข้อมูลไม่ครบ" }); continue; }
    if (amount <= 0) { results.push({ bill_no: billNo, status: "skip", message: "ยอด ≤ 0" }); continue; }

    try {
      const dup = await sql`SELECT 1 FROM hero_point_bills WHERE bill_no = ${billNo} LIMIT 1`;
      if (dup.length) { results.push({ bill_no: billNo, status: "dup" }); continue; }

      const users = await sql`SELECT id, phone, line_user_id, first_name, display_name, total_earned FROM users WHERE UPPER(TRIM(customer_id)) = ${code} LIMIT 1`;
      const u = users[0];
      if (!u) { results.push({ bill_no: billNo, status: "skip", message: "ไม่มีสมาชิกผูกรหัสนี้" }); continue; }

      const before = getTierFromPoints(Number(u.total_earned ?? 0));
      const r = await addPoints(u.phone as string, amount, `บิล ${billNo}`);
      const pts = r?.pointsEarned ?? 0;
      // บันทึกบิลแม้ได้ 0 แต้ม (ยอดต่ำกว่า 100) — จะได้ไม่ถูกส่งซ้ำทุกรอบ
      await sql`
        INSERT INTO hero_point_bills (bill_no, user_id, customer_code, amount, points, bill_date)
        VALUES (${billNo}, ${u.id as number}, ${code}, ${amount}, ${pts}, ${date})
        ON CONFLICT (bill_no) DO NOTHING
      `;
      const name = (u.first_name as string) || (u.display_name as string) || (u.phone as string);
      results.push({ bill_no: billNo, status: "ok", points: pts, name });

      // เลื่อนระดับ → แจ้งลูกค้า 1 ข้อความ (เกิดไม่บ่อย ไม่กินโควตา)
      if (pts > 0 && u.line_user_id) {
        const after = getTierFromPoints(Number(u.total_earned ?? 0) + pts);
        if (after.name !== before.name && after.min > before.min) {
          const fresh = await getUserByPhone(u.phone as string);
          await pushText(u.line_user_id as string,
            `🎉 ยินดีด้วยค่ะ ${name}!\n\nคุณเลื่อนระดับเป็น ${after.emoji} ${after.name} Member แล้วค่ะ\n` +
            `แต้มสะสมล่าสุด ${(fresh?.points ?? 0).toLocaleString()} แต้ม (บิล ${billNo} +${pts} แต้ม)\n\n` +
            `ดูบัตรสมาชิก/ของรางวัลได้ที่เมนู "สมัครสมาชิก" ด้านล่างค่ะ 🌟`);
        }
      }
    } catch (e) {
      console.error("[hero-points]", billNo, e);
      results.push({ bill_no: billNo, status: "error", message: String(e).slice(0, 120) });
    }
  }
  return NextResponse.json({ results });
}
