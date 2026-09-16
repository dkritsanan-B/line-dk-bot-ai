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
import { addPoints, getUserByPhone, getTierFromPoints, getEffectiveTier, migrateDB } from "@/lib/points";
import { computeBonus, bonusPoints, tierIndex, ruleForLine, RULES, type HeroLine } from "@/lib/tierRules";

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
  // โบนัสตามระดับ/หมวด (ชิ้น C, 13 ก.ย. 69) — เก็บรายละเอียดต่อบรรทัดไว้ตรวจย้อนหลัง
  await sql`ALTER TABLE hero_point_bills ADD COLUMN IF NOT EXISTS bonus_points INT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE hero_point_bills ADD COLUMN IF NOT EXISTS bonus_tier TEXT`;
  await sql`ALTER TABLE hero_point_bills ADD COLUMN IF NOT EXISTS bonus_detail JSONB`;
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

// GET → รายชื่อสมาชิกที่ผูกรหัส Hero แล้ว (codes เดิม + members พร้อมระดับ) และสมาชิกที่ยังไม่ผูก (unlinked มีเบอร์) ให้ watcher บนเครื่องร้าน
//   members[].level = ระดับราคา Hero (CSCUSTOMER.PRICELEVEL) 0=Welcome 1=Bronze … 5=Diamond — ชิ้น B: watcher เขียนลง Hero ให้ (ลูกค้าเครดิตได้ 0)
//   unlinked = ให้ watcher ลองจับคู่เบอร์กับ CSCUSTOMER.TELEPHONE แล้ว PUT กลับมาผูกอัตโนมัติ
//   pending/pending_codes = สมาชิกที่ระบบเดารหัสไว้แล้วแต่พนักงานยังไม่กดยืนยัน — watcher ส่งบิลของรหัสพวกนี้มาได้
//     POST จะ "จดไว้เฉย ๆ" ในตาราง hero_pending_bills (ไม่ให้แต้ม) เพื่อบอกลูกค้า/พนักงานว่าค้างอยู่กี่ใบ (16 ก.ย. 69)
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await migrateDB();
  const rows = await sql`SELECT id, customer_id, suggested_customer_id, phone, total_earned, points, last_purchase_at FROM users`;
  const members = rows.filter((r) => normCode(r.customer_id)).map((r) => {
    const tier = getEffectiveTier(Number(r.total_earned ?? 0), Number(r.points ?? 0), (r.last_purchase_at as string | null) ?? null);
    return { id: r.id as number, code: normCode(r.customer_id), tier: tier.name, level: tierIndex(tier) };
  });
  const codes = [...new Set(members.map((m) => m.code))];
  const unlinked = rows.filter((r) => !normCode(r.customer_id) && !normCode(r.suggested_customer_id) && String(r.phone ?? "").replace(/\D/g, "").length >= 9)
    .map((r) => ({ id: r.id as number, phone: String(r.phone).replace(/\D/g, "") }));
  // pending = สมาชิกที่ยังไม่ถูกผูก แต่ระบบเดารหัสไว้แล้ว (รอพนักงานกดยืนยัน)
  // watcher ส่งบิลของรหัสพวกนี้มาได้เลย → POST จะ "จดไว้เฉย ๆ" (hero_pending_bills) ไม่ให้แต้ม ไม่แตะยอดใคร
  // มีไว้เพื่อบอกลูกค้า/พนักงานว่าค้างอยู่กี่ใบ ไม่ใช่คิวจ่ายแต้มย้อนหลัง
  const pending = rows.filter((r) => !normCode(r.customer_id) && normCode(r.suggested_customer_id))
    .map((r) => ({ id: r.id as number, code: normCode(r.suggested_customer_id) as string }));
  const pending_codes = [...new Set(pending.map((p) => p.code))];
  return NextResponse.json({ codes, members, unlinked, pending, pending_codes }, { headers: { "Cache-Control": "no-store" } });
}

// PUT { links: [{ id, customer_id }] } → "แนะนำ" รหัส Hero ให้สมาชิก (watcher จับคู่เบอร์โทรได้ตัวเดียว) — เก็บใน suggested_customer_id ให้พนักงานกดยืนยันในหน้า /admin
// ไม่ผูกอัตโนมัติ: เบอร์โทรอยู่บนใบเสร็จ/นามบัตร ใครสมัครด้วยเบอร์ลูกค้ารายใหญ่ก็จะได้แต้ม+ส่วนลดของเขาทันที (ตัดสินใจ 14 ก.ย. 69)
export async function PUT(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { links?: { id?: number; customer_id?: string; note?: string }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const links = Array.isArray(body.links) ? body.links.slice(0, 100) : [];
  await migrateDB();
  const results: { id: number; code: string; status: string; message?: string }[] = [];
  for (const l of links) {
    const id = Number(l.id); const code = normCode(l.customer_id);
    if (!Number.isInteger(id) || !code) { results.push({ id, code, status: "error", message: "ข้อมูลไม่ครบ" }); continue; }
    const taken = await sql`SELECT id FROM users WHERE UPPER(TRIM(customer_id)) = ${code} AND id <> ${id} LIMIT 1`;
    if (taken.length) { results.push({ id, code, status: "skip", message: `รหัสผูกกับสมาชิก id ${taken[0].id} แล้ว` }); continue; }
    const cur = await sql`SELECT customer_id FROM users WHERE id = ${id} LIMIT 1`;
    if (!cur.length) { results.push({ id, code, status: "error", message: "ไม่พบสมาชิก" }); continue; }
    if (normCode(cur[0].customer_id)) { results.push({ id, code, status: "skip", message: "ผูกอยู่แล้ว" }); continue; }
    await sql`UPDATE users SET suggested_customer_id = ${code} WHERE id = ${id}`;
    results.push({ id, code, status: "suggested" });
  }
  return NextResponse.json({ results });
}

// DELETE ?bill_no=IV-... → ถอนบิลออกจากทะเบียน (ใช้ตอนทดสอบ/แก้ผิด) — ถอนแต้มด้วย: points/total_earned ลดตามที่บิลนั้นให้ + ลง transaction 'adjust'
export async function DELETE(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const billNo = (req.nextUrl.searchParams.get("bill_no") ?? "").trim();
  if (!billNo) return NextResponse.json({ error: "missing bill_no" }, { status: 400 });
  await ensureTable();
  const rows = await sql`DELETE FROM hero_point_bills WHERE bill_no = ${billNo} RETURNING user_id, points, bonus_points`;
  if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { user_id, points } = rows[0] as { user_id: number; points: number; bonus_points: number };
  const bonus = Number((rows[0] as { bonus_points?: number }).bonus_points ?? 0);
  if (points > 0) {
    await sql`UPDATE users SET points = GREATEST(points - ${points}, 0), total_earned = GREATEST(total_earned - ${points}, 0) WHERE id = ${user_id}`;
    await sql`INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note) VALUES (${user_id}, 0, ${points}, 'adjust', ${"ถอนแต้มบิล " + billNo})`;
  }
  if (bonus > 0) {
    await sql`UPDATE users SET points = GREATEST(points - ${bonus}, 0) WHERE id = ${user_id}`;
    await sql`INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note) VALUES (${user_id}, 0, ${bonus}, 'adjust', ${"ถอนโบนัสบิล " + billNo})`;
  }
  return NextResponse.json({ ok: true, user_id, points_reversed: points, bonus_reversed: bonus });
}

interface BillIn { customer_code?: unknown; bill_no?: unknown; amount?: unknown; date?: unknown; lines?: unknown }

// บรรทัดสินค้าจาก watcher → HeroLine (กันข้อมูลเพี้ยน: ตัดความยาว บังคับตัวเลข)
function parseLines(v: unknown): HeroLine[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 300).map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const num = (k: string) => { const n = Number(o[k]); return Number.isFinite(n) ? n : 0; };
    return {
      code: String(o.code ?? "").slice(0, 40), name: String(o.name ?? "").slice(0, 120),
      category: o.category == null ? null : Number(o.category), unit: String(o.unit ?? "").slice(0, 30),
      qty: num("qty"), unit_price: num("unit_price"), list_price: o.list_price == null ? null : num("list_price"),
      discword: String(o.discword ?? "").slice(0, 50), net: num("net"),
    };
  }).filter((l) => l.code);
}

/**
 * จดบิลที่ "ให้แต้มไม่ได้เพราะยังไม่ผูกรหัส" ไว้ให้เห็น — คืน id สมาชิกที่บิลนี้น่าจะเป็นของเขา (null = ไม่มีใครเกี่ยว)
 *
 * จดเฉพาะบิลที่รหัสลูกค้าตรงกับ suggested_customer_id ของสมาชิกที่ยังไม่ถูกผูกเท่านั้น
 * (ไม่จดบิลของลูกค้าทั่วไปที่ไม่ได้เป็นสมาชิก — ไม่มีประโยชน์ และเป็นข้อมูลการซื้อของคนอื่น)
 * ไม่ให้แต้ม ไม่แตะ users/transactions เด็ดขาด · ล้มเหลวก็แค่ไม่มีตัวเลขให้ดู ห้ามทำให้บิลอื่นพัง
 */
async function notePendingBill(code: string, billNo: string, amount: number, date: string | null): Promise<number | null> {
  try {
    const rows = await sql`
      SELECT id FROM users
      WHERE UPPER(TRIM(suggested_customer_id)) = ${code}
        AND COALESCE(TRIM(customer_id), '') = ''
      LIMIT 1
    `;
    const id = rows[0]?.id as number | undefined;
    if (!id) return null;
    await sql`
      INSERT INTO hero_pending_bills (bill_no, user_id, customer_code, amount, bill_date)
      VALUES (${billNo}, ${id}, ${code}, ${amount}, ${date})
      ON CONFLICT (bill_no) DO NOTHING
    `;
    return id;
  } catch (e) {
    console.error("[hero-points] จดบิลค้างไม่สำเร็จ", billNo, e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { bills?: BillIn[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const bills = Array.isArray(body.bills) ? body.bills.slice(0, 200) : [];
  if (!bills.length) return NextResponse.json({ error: "no bills" }, { status: 400 });

  await migrateDB();
  await ensureTable();

  const results: { bill_no: string; status: string; points?: number; bonus?: number; tier?: string; name?: string; message?: string; warnings?: string[]; pending_for?: number }[] = [];
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

      const users = await sql`SELECT id, phone, line_user_id, first_name, display_name, total_earned, points, last_purchase_at FROM users WHERE UPPER(TRIM(customer_id)) = ${code} LIMIT 1`;
      const u = users[0];
      if (!u) {
        // เดิม: ข้ามเงียบ ๆ ไม่เหลือร่องรอยว่าลูกค้าที่รอผูกรหัสซื้อของไปแล้วกี่ใบ
        // ตอนนี้: ถ้ารหัสนี้ตรงกับ "รหัสที่ระบบเดาไว้" ของสมาชิกคนไหน ให้จดไว้ในตารางบิลค้าง (ไม่ให้แต้ม ไม่แตะ users)
        const noted = await notePendingBill(code, billNo, amount, date);
        results.push({
          bill_no: billNo, status: "skip",
          message: noted ? "ยังไม่ผูกรหัส — จดบิลค้างไว้ให้สมาชิก id " + noted + " (ไม่ให้แต้ม)" : "ไม่มีสมาชิกผูกรหัสนี้",
          ...(noted ? { pending_for: noted } : {}),
        });
        continue;
      }

      const before = getTierFromPoints(Number(u.total_earned ?? 0));
      // ระดับที่ใช้คิดโบนัส = ระดับ ณ ตอนซื้อ (ก่อนแต้มบิลนี้เข้า, คิด hard-drop ถ้าหายไป 12 เดือน)
      const bonusTier = getEffectiveTier(Number(u.total_earned ?? 0), Number(u.points ?? 0), (u.last_purchase_at as string | null) ?? null);
      const lines = parseLines(b.lines);
      const bonus = computeBonus(lines, bonusTier);
      const bonusPts = bonusPoints(bonus.baht);

      const r = await addPoints(u.phone as string, amount, `บิล ${billNo}`);
      const pts = r?.pointsEarned ?? 0;
      if (bonusPts > 0) {
        // โบนัสไม่นับเข้า total_earned (ไม่ดันระดับ) — เป็นมูลค่าส่วนลดที่คืนเป็นแต้ม แลกได้เหมือนแต้มปกติ
        await sql`UPDATE users SET points = points + ${bonusPts} WHERE id = ${u.id as number}`;
        const summary = bonus.lines.filter((l) => l.baht > 0).map((l) => `${l.reason} ${l.rate}${l.rule === "sheet" ? "บ/ม" : "%"}`);
        await sql`
          INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note, expires_at)
          VALUES (${u.id as number}, 0, ${bonusPts}, 'earn', ${`โบนัส ${bonusTier.name} บิล ${billNo} (${[...new Set(summary)].join(", ")})`}, NOW() + INTERVAL '1 year')
        `;
      }
      // บันทึกบิลแม้ได้ 0 แต้ม (ยอดต่ำกว่า 100) — จะได้ไม่ถูกส่งซ้ำทุกรอบ
      await sql`
        INSERT INTO hero_point_bills (bill_no, user_id, customer_code, amount, points, bill_date, bonus_points, bonus_tier, bonus_detail)
        VALUES (${billNo}, ${u.id as number}, ${code}, ${amount}, ${pts}, ${date}, ${bonusPts}, ${bonusTier.name}, ${JSON.stringify({ baht: bonus.baht, lines: bonus.lines })}::jsonb)
        ON CONFLICT (bill_no) DO NOTHING
      `;
      const name = (u.first_name as string) || (u.display_name as string) || (u.phone as string);
      // ชิ้น D: บรรทัดที่แคชเชียร์ต่อราคา (ขาย < ป้าย) แต่คำส่วนลดระดับยังติดอยู่ = ลดซ้ำ 2 ต่อ → ส่งกลับให้ watcher เปิดการ์ดเตือน
      const ti = tierIndex(bonusTier);
      const warnings = lines.filter((l) => l.discword && l.list_price != null && l.list_price > 0 && l.unit_price < l.list_price - 0.005)
        .filter((l) => { const r = RULES[ruleForLine(l).rule]; return r.via === "discount" && (r.byTier[ti] ?? 0) > 0; })
        .map((l) => `${l.name} ${l.qty} ${l.unit} — ขาย ${l.unit_price} (ป้าย ${l.list_price}) แต่ยังลด "${l.discword}"`);
      results.push({ bill_no: billNo, status: "ok", points: pts, bonus: bonusPts, tier: bonusTier.name, name, ...(warnings.length ? { warnings } : {}) });

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
