// PDPA (18 ก.ย. 69): สมัครสมาชิกต้องติ๊กยอมรับนโยบายความเป็นส่วนตัว และเซิร์ฟเวอร์ต้องบันทึกเวลา + ฉบับนโยบาย
//   - สมัครใหม่ / รับ LINE เข้าเบอร์เดิม โดยไม่มี consent:true → 400 CONSENT_REQUIRED และไม่เขียนอะไรลงฐานข้อมูล
//   - สมาชิกเดิม (รวมคนที่สมัครก่อนมีระบบนี้) แก้ข้อมูลตัวเองได้โดยไม่ต้องติ๊ก
// ส่วน [pg] ใช้ Postgres ในเครื่อง (PGlite) — ไม่ต่อฐานข้อมูลจริงเด็ดขาด
import { test, eq, ok } from "./_harness.mjs";
import { onQuery, reset, queriesWith, calls } from "./mocks/db.mjs";
import { setUser } from "./mocks/liff-auth.mjs";
import { freshDb } from "./pg.mjs";
import { registerUser, ConsentError, migrateDB, toClientUser } from "../lib/points.ts";
import { PDPA_VERSION } from "../lib/pdpa.ts";

const { NextRequest } = await import("next/server");
const { POST } = await import("../app/api/member/route.ts");

const SECRET = process.env.REVIEW_SECRET || "dkreview2569";
const FORM = { phone: "0898887777", displayName: "ช่างวิชัย", firstName: "วิชัย", lastName: "มั่นคง", company: null, birthday: "1985-05-05" };
const post = (body, qs = "") =>
  new NextRequest(`http://localhost:3100/api/member${qs}`, {
    method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer tok" }, body: JSON.stringify(body),
  });
// migrateDB ก็มี "UPDATE users u SET total_earned…" (ย้ายข้อมูลเก่า) — นับเฉพาะคำสั่งเขียนข้อมูลสมาชิก
const writes = () => calls.filter((c) => /^(INSERT INTO users|UPDATE users SET)/.test(c.text));

// ── เส้นทาง API (ฐานข้อมูลปลอม) ──────────────────────────────────────────
test("POST สมัครใหม่โดยไม่ติ๊กยอมรับ → 400 CONSENT_REQUIRED และไม่เขียน users", async () => {
  reset();
  setUser({ userId: "U_new_pdpa" });
  const res = await POST(post(FORM));
  eq(res.status, 400);
  const d = await res.json();
  eq(d.ok, false);
  eq(d.code, "CONSENT_REQUIRED");
  ok(/นโยบายความเป็นส่วนตัว/.test(d.error), "ข้อความต้องบอกลูกค้าว่าต้องติ๊กยอมรับนโยบาย");
  ok(!("registered" in d), "error ห้ามมีช่อง registered");
  eq(writes().length, 0, "ห้ามสร้าง/แก้แถวสมาชิกเมื่อไม่ยอมรับ");
});

test("POST consent ที่ไม่ใช่ true จริง ('true' / 1 / false) → ถูกปฏิเสธทั้งหมด", async () => {
  for (const consent of ["true", 1, false, null]) {
    reset();
    setUser({ userId: "U_new_pdpa" });
    const d = await (await POST(post({ ...FORM, consent }))).json();
    eq(d.code, "CONSENT_REQUIRED", `consent=${JSON.stringify(consent)}`);
    eq(writes().length, 0);
  }
});

test("POST รับ LINE เข้าเบอร์ที่พนักงานสร้างไว้ (ยังไม่ผูก LINE) โดยไม่ติ๊ก → ถูกปฏิเสธเหมือนสมัครใหม่", async () => {
  reset();
  setUser({ userId: "U_claim" });
  onQuery("FROM users WHERE phone", [{ id: 70, phone: "0898887777", line_user_id: null, points: 50 }]);
  const d = await (await POST(post(FORM))).json();
  eq(d.code, "CONSENT_REQUIRED");
  eq(writes().length, 0);
});

test("POST สมัครใหม่พร้อม consent:true → INSERT พร้อมเวลา + ฉบับนโยบาย", async () => {
  reset();
  setUser({ userId: "U_new_pdpa" });
  let inserted = false;
  onQuery("INSERT INTO users", () => { inserted = true; return []; });
  onQuery("FROM users WHERE line_user_id", () => (inserted ? [{ id: 71, phone: "0898887777", points: 0, total_earned: 0, customer_id: null, created_at: new Date().toISOString() }] : []));
  const res = await POST(post({ ...FORM, consent: true }));
  eq(res.status, 200);
  eq((await res.json()).success, true);
  const [ins] = queriesWith("INSERT INTO users");
  ok(ins && ins.text.includes("pdpa_consent_at") && ins.text.includes("NOW()"), "INSERT ต้องตั้ง pdpa_consent_at = NOW()");
  ok(ins.values.includes(PDPA_VERSION), "ต้องบันทึกฉบับนโยบาย " + PDPA_VERSION);
});

test("POST สมาชิกเดิมแก้ข้อมูลตัวเอง ไม่ต้องติ๊ก → สำเร็จ และไม่ทับเวลายอมรับเดิม", async () => {
  reset();
  setUser({ userId: "U_member_old" });
  const old = { id: 42, line_user_id: "U_member_old", phone: "0898887777", points: 300, total_earned: 300, customer_id: "CUS-1", created_at: "2024-01-01T00:00:00Z" };
  onQuery("FROM users WHERE line_user_id", [old]);
  onQuery("FROM users WHERE phone", [old]);
  const res = await POST(post({ ...FORM, firstName: "วิชัยใหม่" }));
  eq(res.status, 200, "สมาชิกเก่าต้องไม่ถูกบล็อก");
  const [upd] = queriesWith("UPDATE users SET phone");
  ok(upd && upd.values.includes(false), "ไม่ติ๊ก = ส่ง false → CASE คงค่าเดิมไว้");
  ok(upd.text.includes("ELSE pdpa_consent_at"), "ต้องคงเวลายอมรับเดิม (หรือ NULL ของสมาชิกเก่า)");
});

test("POST โหมดรีวิว as=new: ไม่ติ๊ก → CONSENT_REQUIRED · ติ๊ก → สำเร็จ · สมาชิก (as=bronze120) แก้ข้อมูลไม่ต้องติ๊ก", async () => {
  process.env.REVIEW_SECRET = SECRET; delete process.env.VERCEL_ENV;
  const qs = (as) => `?review=${SECRET}&as=${as}`;
  eq((await (await POST(post(FORM, qs("new")))).json()).code, "CONSENT_REQUIRED");
  eq((await (await POST(post({ ...FORM, consent: true }, qs("new")))).json()).success, true);
  eq((await (await POST(post(FORM, qs("bronze120")))).json()).success, true);
});

test("migrateDB เพิ่มคอลัมน์ pdpa_consent_at / pdpa_version แบบ IF NOT EXISTS", async () => {
  reset();
  await migrateDB();
  const q = queriesWith("pdpa_");
  ok(q.some((c) => /ADD COLUMN IF NOT EXISTS pdpa_consent_at TIMESTAMPTZ/.test(c.text)), "ต้องมี pdpa_consent_at TIMESTAMPTZ");
  ok(q.some((c) => /ADD COLUMN IF NOT EXISTS pdpa_version TEXT/.test(c.text)), "ต้องมี pdpa_version TEXT");
});

// ── SQL จริง (PGlite) ───────────────────────────────────────────────────
test("[pg] สมัครใหม่ไม่ยอมรับ → ConsentError และไม่มีแถว", async () => {
  const { pg, db } = await freshDb();
  let err = null;
  try { await registerUser("U_a", "0811111111", "A", "เอ", "บี", undefined, "1990-01-01", { database: db }); } catch (e) { err = e; }
  ok(err instanceof ConsentError, "ต้องโยน ConsentError");
  eq((await db.query(`SELECT COUNT(*)::int AS n FROM users`))[0].n, 0);
  await pg.close();
});

test("[pg] สมัครใหม่พร้อมยอมรับ → เก็บ pdpa_consent_at (เวลาปัจจุบัน) + pdpa_version", async () => {
  const { pg, db } = await freshDb();
  const r = await registerUser("U_a", "0811111111", "A", "เอ", "บี", undefined, "1990-01-01", { consent: true, database: db });
  eq(r.isNew, true);
  const [u] = await db.query(`SELECT pdpa_version, pdpa_consent_at IS NOT NULL AS has_at,
    ABS(EXTRACT(EPOCH FROM (NOW() - pdpa_consent_at))) < 60 AS recent, line_user_id, phone, first_name FROM users`);
  eq(u.has_at, true);
  eq(u.recent, true);
  eq(u.pdpa_version, PDPA_VERSION);
  eq([u.line_user_id, u.phone, u.first_name], ["U_a", "0811111111", "เอ"]);
  await pg.close();
});

test("[pg] รับ LINE เข้าเบอร์เดิม: ไม่ยอมรับ → ไม่ผูก · ยอมรับ → ผูก + เก็บเวลา", async () => {
  const { pg, db } = await freshDb();
  await db.query(`INSERT INTO users (phone, points) VALUES ('0822222222', 80)`);
  let threw = false;
  try { await registerUser("U_b", "0822222222", "B", "บี", "ซี", undefined, "1991-02-02", { database: db }); } catch (e) { threw = e instanceof ConsentError; }
  ok(threw);
  eq((await db.query(`SELECT line_user_id FROM users`))[0].line_user_id, null, "ห้ามผูก LINE เมื่อไม่ยอมรับ");
  await registerUser("U_b", "0822222222", "B", "บี", "ซี", undefined, "1991-02-02", { consent: true, database: db });
  const [u] = await db.query(`SELECT line_user_id, points, pdpa_version, pdpa_consent_at IS NOT NULL AS has_at FROM users`);
  eq([u.line_user_id, u.points, u.pdpa_version, u.has_at], ["U_b", 80, PDPA_VERSION, true]);
  await pg.close();
});

test("[pg] สมาชิกเก่า (ไม่เคยยอมรับ) แก้ข้อมูลได้ · เวลายอมรับยังเป็น NULL · คนที่ยอมรับแล้วแก้ข้อมูล เวลาไม่ถูกทับ", async () => {
  const { pg, db } = await freshDb();
  await db.query(`INSERT INTO users (line_user_id, phone, first_name) VALUES ('U_old', '0833333333', 'เก่า')`);
  await registerUser("U_old", "0833333333", "Old", "เก่าแก้แล้ว", "ส", undefined, "1980-03-03", { database: db });
  const [o] = await db.query(`SELECT first_name, pdpa_consent_at, pdpa_version FROM users WHERE line_user_id = 'U_old'`);
  eq([o.first_name, o.pdpa_consent_at, o.pdpa_version], ["เก่าแก้แล้ว", null, null]);

  await registerUser("U_new", "0844444444", "N", "ใหม่", "ส", undefined, "1980-03-03", { consent: true, database: db });
  await db.query(`UPDATE users SET pdpa_consent_at = '2026-09-18T01:00:00Z' WHERE line_user_id = 'U_new'`);
  await registerUser("U_new", "0844444444", "N", "ใหม่แก้", "ส", undefined, "1980-03-03", { database: db });
  const [n] = await db.query(`SELECT first_name, pdpa_consent_at = '2026-09-18T01:00:00Z'::timestamptz AS same FROM users WHERE line_user_id = 'U_new'`);
  eq([n.first_name, n.same], ["ใหม่แก้", true]);
  await pg.close();
});

test("toClientUser ยังซ่อนฟิลด์ภายในเหมือนเดิม (ส่งถึงเจ้าของบัญชีเท่านั้น)", () => {
  const u = toClientUser({ id: 1, line_user_id: "U_x", suggested_customer_id: "CUS-9", pdpa_consent_at: "2026-09-18T00:00:00Z" });
  ok(!("line_user_id" in u) && !("suggested_customer_id" in u));
});
