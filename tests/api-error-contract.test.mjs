// สัญญาเรื่อง error ของ API สมาชิก — บั๊ก "API ล่มแล้วสมาชิกเก่ากลายเป็นคนใหม่" (16 ก.ย. 69)
//   node tests/run.mjs
//
// หัวใจของทุกเคสในไฟล์นี้คือข้อเดียว:
//   มีคำตอบเดียวเท่านั้นที่แปลว่า "ยังไม่สมัคร" → 200 { registered:false, code:"NOT_REGISTERED" }
//   คำตอบอื่นที่ไม่สำเร็จต้องเป็น JSON { ok:false, code, error } และห้ามมีช่อง registered ติดมา
//   (หน้าเว็บอ่าน data.registered ตรง ๆ โดยไม่เช็ค res.ok — ถ้ามันได้ undefined สมาชิกเก่าจะโดนพาไปจอสมัคร)
import { test, eq, ok } from "./_harness.mjs";
import { onQuery, reset } from "./mocks/db.mjs";
import { setUser } from "./mocks/liff-auth.mjs";

import * as memberRoute from "../app/api/member/route.ts";
import * as txRoute from "../app/api/member/transactions/route.ts";
import * as rewardsRoute from "../app/api/rewards/route.ts";
import * as redeemRoute from "../app/api/liff/redeem/route.ts";
import { API_ERROR_CODES, apiError, classifyThrown } from "../app/api/_lib/api-error.ts";

const MEMBER = {
  id: 42, line_user_id: "U_member_old", phone: "0812345678", display_name: "ช่างสมชาย",
  first_name: "สมชาย", last_name: "ใจดี", company: "หจก. สมชายก่อสร้าง", birthday: "1983-04-01",
  points: 2300, total_earned: 2760, last_purchase_at: new Date().toISOString(),
  created_at: "2024-01-01T00:00:00Z", customer_id: "CUS-00912", suggested_customer_id: null,
};

// อาการที่ neon โยนจริงตอนต่อฐานข้อมูลไม่ติด / ตอนคิวรีพังเฉย ๆ
const DB_DOWN = Object.assign(new Error("fetch failed"), { name: "TypeError" });
const SQL_BROKEN = new Error('relation "rewards" does not exist');

const getReq = (u) => new Request(u, { headers: { Authorization: "Bearer tok" } });
const postReq = (u, body) =>
  new Request(u, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function body(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`คำตอบไม่ใช่ JSON (หน้าเว็บ parse ไม่ได้): status=${res.status} body=${text.slice(0, 160)}`);
  }
}

/** ด่านตรวจมาตรฐานของทุกคำตอบที่ไม่สำเร็จ */
async function expectError(res, code, status) {
  const b = await body(res);
  eq(b.ok, false, `${code}: error ต้องมี ok:false`);
  eq(b.code, code, `${code}: code ไม่ตรง`);
  ok(typeof b.error === "string" && b.error.length > 0, `${code}: ต้องมีข้อความไทยให้ลูกค้าอ่าน`);
  ok(!("registered" in b), `${code}: error ห้ามมีช่อง registered เด็ดขาด (หน้าเว็บจะตีความว่ายังไม่สมัคร)`);
  eq(res.headers.get("cache-control"), "no-store", `${code}: ห้ามให้แคชคำตอบช่วงระบบมีปัญหา`);
  if (status) eq(res.status, status, `${code}: สถานะ HTTP ไม่ตรง`);
  return b;
}

// รหัสโหมดรีวิวใช้ตัวเดียวกับที่ไฟล์เทสต์อื่นตั้งไว้ และห้ามลบทิ้งระหว่างทาง (ทุกไฟล์รันในโปรเซสเดียวกัน)
const SECRET = process.env.REVIEW_SECRET || "dkreview2569";
process.env.REVIEW_SECRET = SECRET;

/** เริ่มเคสใหม่: ไม่มีของค้างจากเคสก่อน · URL ที่ไม่มี ?review= ไม่เข้าโหมดรีวิวอยู่แล้ว */
function fresh(user = { userId: "U_member_old" }) {
  reset();
  setUser(user);
  delete process.env.VERCEL_ENV;
  process.env.LINE_STAFF_GROUP_ID = "";
}

// หมายเหตุ: ไม่มีเคสไหนในไฟล์นี้เดินไปถึงขั้นส่ง LINE (ทุกเคสจบก่อนบันทึกคำขอสำเร็จ)
// จึงไม่ยึด globalThis.fetch ไว้ — ไฟล์เทสต์อื่นรันในโปรเซสเดียวกัน อย่าไปยุ่งกับของกลาง

// ══════════════════════════════════════════════════════════════════════════
// GET /api/member — จุดที่ทำให้สมาชิกเก่ากลายเป็นคนใหม่
// ══════════════════════════════════════════════════════════════════════════
test("GET /api/member · ฐานข้อมูลล่ม → 503 DB_UNAVAILABLE ไม่ใช่ 'ยังไม่สมัคร'", async () => {
  fresh();
  onQuery("FROM users WHERE line_user_id", DB_DOWN);
  const b = await expectError(await memberRoute.GET(getReq("http://t/api/member")), "DB_UNAVAILABLE", 503);
  eq(b.registered, undefined, "ห้ามมี registered");
  eq(b.user, undefined, "ห้ามมี user");
});

test("GET /api/member · คิวรีพังแบบไม่ใช่ปัญหาการเชื่อมต่อ → 500 SERVER_ERROR", async () => {
  fresh();
  onQuery("FROM users WHERE line_user_id", SQL_BROKEN);
  await expectError(await memberRoute.GET(getReq("http://t/api/member")), "SERVER_ERROR", 500);
});

test("GET /api/member · token หมดอายุ → 401 AUTH_REQUIRED (ข้อความเดิมไม่หาย)", async () => {
  fresh({ error: "token หมดอายุ กรุณาเปิดหน้านี้ใหม่", status: 401 });
  const b = await expectError(await memberRoute.GET(getReq("http://t/api/member")), "AUTH_REQUIRED", 401);
  eq(b.error, "token หมดอายุ กรุณาเปิดหน้านี้ใหม่");
});

test("GET /api/member · ติดต่อ LINE ไม่ได้ → 503 LINE_UNAVAILABLE (คนละเรื่องกับ token หมดอายุ)", async () => {
  fresh({ error: "ติดต่อ LINE ไม่ได้ ลองใหม่อีกครั้ง", status: 503 });
  await expectError(await memberRoute.GET(getReq("http://t/api/member")), "LINE_UNAVAILABLE", 503);
});

test("GET /api/member · อ่านได้แต่ไม่เจอคนนี้ → 200 registered:false + NOT_REGISTERED (จอสมัครขึ้นได้เฉพาะตรงนี้)", async () => {
  fresh({ userId: "U_brand_new" });
  const res = await memberRoute.GET(getReq("http://t/api/member"));
  eq(res.status, 200);
  const b = await body(res);
  eq(b.registered, false);
  eq(b.code, "NOT_REGISTERED");
});

test("GET /api/member · สมาชิกปกติ → 200 registered:true พร้อมแต้ม", async () => {
  fresh();
  onQuery("FROM users WHERE line_user_id", [MEMBER]);
  const res = await memberRoute.GET(getReq("http://t/api/member"));
  eq(res.status, 200);
  const b = await body(res);
  eq(b.registered, true);
  eq(b.user.points, 2300);
});

test("GET /api/member · อ่านตัวสมาชิกได้ แต่คิวรีแต้มใกล้หมดอายุล้ม → ยังเป็นสมาชิก + ธง expiryUnavailable", async () => {
  fresh();
  onQuery("FROM users WHERE line_user_id", [MEMBER]);
  onQuery("FROM transactions WHERE user_id = $1 AND cleared = FALSE", DB_DOWN);   // คิวรีอ่านบัญชีแต้ม (lib/points-ledger.ts readLedger)
  const res = await memberRoute.GET(getReq("http://t/api/member"));
  eq(res.status, 200);
  const b = await body(res);
  eq(b.registered, true, "ล้มเรื่องวันหมดอายุ ห้ามลบสถานะสมาชิกทิ้ง");
  eq(b.expiry, null);
  eq(b.expiryUnavailable, true, "ต้องบอกหน้าเว็บว่าดูวันหมดอายุไม่ได้ ไม่ใช่เงียบ");
});

// ══════════════════════════════════════════════════════════════════════════
// POST /api/member — สมัคร / แก้ไขข้อมูล
// ══════════════════════════════════════════════════════════════════════════
const GOOD = { phone: "0812345678", displayName: "ช่างสมชาย", firstName: "สมชาย", lastName: "ใจดี", company: null, birthday: "1983-04-01", consent: true };

test("POST /api/member · body ไม่ใช่ JSON → 400 BAD_REQUEST (เดิม throw เป็น 500 ที่ parse ไม่ได้)", async () => {
  fresh();
  const req = new Request("http://t/api/member", { method: "POST", headers: { Authorization: "Bearer tok" }, body: "not json" });
  await expectError(await memberRoute.POST(req), "BAD_REQUEST", 400);
});

test("POST /api/member · กรอกไม่ครบ → 400 BAD_REQUEST เป็นภาษาไทย (เดิมตอบ 'missing fields')", async () => {
  fresh();
  const b = await expectError(await memberRoute.POST(postReq("http://t/api/member", { phone: "0812345678" })), "BAD_REQUEST", 400);
  ok(/[฀-๿]/.test(b.error), "ข้อความต้องเป็นภาษาไทย ลูกค้าอ่านรู้เรื่อง");
});

test("POST /api/member · เบอร์ผิดรูปแบบ → 400 INVALID_PHONE ข้อความเดิม", async () => {
  fresh();
  const b = await expectError(await memberRoute.POST(postReq("http://t/api/member", { ...GOOD, phone: "081234" })), "INVALID_PHONE", 400);
  eq(b.error, "เบอร์มือถือไม่ถูกต้อง (10 หลัก)");
});

test("POST /api/member · เบอร์เป็นของสมาชิกท่านอื่น → 409 PHONE_TAKEN (ข้อความจาก lib/points.ts)", async () => {
  fresh();
  onQuery("FROM users WHERE phone", [{ ...MEMBER, id: 99, line_user_id: "U_someone_else" }]);
  const b = await expectError(await memberRoute.POST(postReq("http://t/api/member", GOOD)), "PHONE_TAKEN", 409);
  ok(/LINE|สมาชิกท่านอื่น/.test(b.error), "ต้องบอกลูกค้าตรง ๆ ว่าเบอร์ชนกับใคร");
});

test("POST /api/member · ฐานข้อมูลล่มระหว่างสมัคร → 503 DB_UNAVAILABLE ไม่ใช่ 500 ดิบ", async () => {
  fresh();
  onQuery(() => true, DB_DOWN);
  await expectError(await memberRoute.POST(postReq("http://t/api/member", GOOD)), "DB_UNAVAILABLE", 503);
});

test("POST /api/member · สมัครผ่าน → success:true พร้อม user", async () => {
  fresh();
  let inserted = false;
  onQuery("INSERT INTO users", () => { inserted = true; return []; });
  onQuery("FROM users WHERE line_user_id", () => (inserted ? [MEMBER] : []));
  const res = await memberRoute.POST(postReq("http://t/api/member", GOOD));
  eq(res.status, 200);
  const b = await body(res);
  eq(b.success, true);
  eq(b.isNew, true);
  eq(b.user.id, 42);
});

test("POST /api/member · บันทึกแล้วแต่อ่านกลับไม่เจอ → ห้ามคืน success พร้อม user:null", async () => {
  fresh();
  const b = await expectError(await memberRoute.POST(postReq("http://t/api/member", GOOD)), "SERVER_ERROR", 500);
  eq(b.success, undefined, "หน้าเว็บจะเรนเดอร์บัตรเปล่าถ้าเชื่อว่าสำเร็จ");
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/member/transactions — ห้ามโกหกว่า "ไม่มีรายการ"
// ══════════════════════════════════════════════════════════════════════════
test("GET transactions · ฐานข้อมูลล่ม → 503 DB_UNAVAILABLE และห้ามคืน transactions:[]", async () => {
  fresh();
  onQuery("FROM transactions", DB_DOWN);
  const b = await expectError(await txRoute.GET(getReq("http://t/api/member/transactions")), "DB_UNAVAILABLE", 503);
  eq(b.transactions, undefined, "ลิสต์ว่างตอนระบบล่ม = ลูกค้าคิดว่าแต้มหาย");
});

test("GET transactions · ไม่มี token → 401 AUTH_REQUIRED", async () => {
  fresh({ error: "กรุณาเปิดผ่าน LINE (ไม่มี token)", status: 401 });
  await expectError(await txRoute.GET(getReq("http://t/api/member/transactions")), "AUTH_REQUIRED", 401);
});

test("GET transactions · ปกติ → คืนรายการจริง", async () => {
  fresh();
  onQuery("FROM transactions", [{ id: 1, purchase_amount: 18500, points_earned: 185, type: "earn", note: "IV-690402", created_at: "2026-09-13T03:00:00Z" }]);
  const res = await txRoute.GET(getReq("http://t/api/member/transactions"));
  eq(res.status, 200);
  eq((await body(res)).transactions.length, 1);
});

test("GET transactions · สมาชิกที่ยังไม่มีรายการ → 200 transactions:[] (ว่างจริง ไม่ใช่ว่างเพราะพัง)", async () => {
  fresh();
  const res = await txRoute.GET(getReq("http://t/api/member/transactions"));
  eq(res.status, 200);
  eq((await body(res)).transactions, []);
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/rewards — เดิม catch แล้วคืนลิสต์ว่าง
// ══════════════════════════════════════════════════════════════════════════
test("GET /api/rewards · ฐานข้อมูลล่ม → 503 DB_UNAVAILABLE ไม่ใช่ rewards:[]", async () => {
  fresh();
  onQuery("FROM rewards", DB_DOWN);
  const b = await expectError(await rewardsRoute.GET(getReq("http://t/api/rewards")), "DB_UNAVAILABLE", 503);
  eq(b.rewards, undefined, "ลิสต์ว่าง = ลูกค้าเห็น 'ยังไม่มีของรางวัล' ทั้งที่ร้านมีของ");
});

test("GET /api/rewards · ตาราง rewards หาย → 500 SERVER_ERROR (ยังบอกความจริง)", async () => {
  fresh();
  onQuery("FROM rewards", SQL_BROKEN);
  await expectError(await rewardsRoute.GET(getReq("http://t/api/rewards")), "SERVER_ERROR", 500);
});

test("GET /api/rewards · ปกติ → คืนของรางวัล", async () => {
  fresh();
  onQuery("FROM rewards", [{ id: 1, name: "ส่วนลด 100", description: null, points_required: 100, image_url: null, stock: 5 }]);
  const res = await rewardsRoute.GET(getReq("http://t/api/rewards"));
  eq(res.status, 200);
  eq((await body(res)).rewards.length, 1);
});

test("GET /api/rewards · ร้านยังไม่ใส่ของรางวัล → 200 rewards:[]", async () => {
  fresh();
  const res = await rewardsRoute.GET(getReq("http://t/api/rewards"));
  eq(res.status, 200);
  eq((await body(res)).rewards, []);
});

// ══════════════════════════════════════════════════════════════════════════
// POST /api/liff/redeem — เฉพาะสัญญาเรื่อง error (กติกาการแลกอยู่ใน logic.ts + เทสต์ของมันเอง)
// ══════════════════════════════════════════════════════════════════════════
test("POST redeem · ไม่ส่ง body → 400 BAD_REQUEST (เดิม req.json() throw เป็น 500)", async () => {
  fresh();
  const req = new Request("http://t/api/liff/redeem", { method: "POST", headers: { Authorization: "Bearer tok" } });
  await expectError(await redeemRoute.POST(req), "BAD_REQUEST", 400);
});

test("POST redeem · token หมดอายุ → 401 AUTH_REQUIRED (ไม่ใช่ 'ไม่พบสมาชิก')", async () => {
  fresh({ error: "token หมดอายุ กรุณาเปิดหน้านี้ใหม่", status: 401 });
  await expectError(await redeemRoute.POST(postReq("http://t/api/liff/redeem", { rewardId: 101 })), "AUTH_REQUIRED", 401);
});

test("POST redeem · ยังไม่ได้สมัคร → 404 NOT_REGISTERED (คนละ code กับ 'ไม่พบของรางวัล')", async () => {
  fresh();
  await expectError(await redeemRoute.POST(postReq("http://t/api/liff/redeem", { rewardId: 101 })), "NOT_REGISTERED", 404);
});

test("POST redeem · ฐานข้อมูลล่ม → 503 DB_UNAVAILABLE", async () => {
  fresh();
  onQuery(() => true, DB_DOWN);
  await expectError(await redeemRoute.POST(postReq("http://t/api/liff/redeem", { rewardId: 101 })), "DB_UNAVAILABLE", 503);
});

test("GET redeem · ยังไม่ได้สมัคร → 200 registered:false + NOT_REGISTERED (ไม่ใช่ error)", async () => {
  fresh();
  const res = await redeemRoute.GET(getReq("http://t/api/liff/redeem"));
  eq(res.status, 200);
  const b = await body(res);
  eq(b.registered, false);
  eq(b.code, "NOT_REGISTERED");
});

test("GET redeem · ฐานข้อมูลล่ม → 503 DB_UNAVAILABLE (ห้ามบอกว่ายังไม่สมัคร)", async () => {
  fresh();
  onQuery(() => true, DB_DOWN);
  const b = await expectError(await redeemRoute.GET(getReq("http://t/api/liff/redeem")), "DB_UNAVAILABLE", 503);
  eq(b.registered, undefined);
});

// ══════════════════════════════════════════════════════════════════════════
// รูปแบบกลาง
// ══════════════════════════════════════════════════════════════════════════
test("ทุก code ตอบรูปเดียวกัน { ok:false, code, error } และไม่มี registered", async () => {
  for (const code of API_ERROR_CODES) {
    const b = await body(apiError(code));
    eq(b.ok, false, code);
    eq(b.code, code, code);
    ok(typeof b.error === "string" && b.error.length > 0, `${code}: ต้องมีข้อความ`);
    ok(!("registered" in b), `${code}: ห้ามมี registered`);
  }
});

test("ทุก code มีสถานะ HTTP 4xx/5xx และข้อความเป็นภาษาไทย", () => {
  for (const code of API_ERROR_CODES) {
    const res = apiError(code);
    ok(res.status >= 400 && res.status < 600, `${code} → ${res.status}`);
  }
});

test("แยก 'ต่อฐานข้อมูลไม่ติด' ออกจาก 'คิวรีพัง' ได้", () => {
  eq(classifyThrown(new Error("fetch failed")), "DB_UNAVAILABLE");
  eq(classifyThrown(new Error("connect ECONNREFUSED 10.0.0.1:5432")), "DB_UNAVAILABLE");
  eq(classifyThrown(new Error("ยังไม่ได้ตั้ง DATABASE_URL — ต่อฐานข้อมูลไม่ได้")), "DB_UNAVAILABLE");
  eq(classifyThrown(new Error('column "foo" does not exist')), "SERVER_ERROR");
  eq(classifyThrown("unknown boom"), "SERVER_ERROR");
});

test("override ข้อความได้ แต่ code คงเดิม", async () => {
  const b = await body(apiError("PHONE_TAKEN", { message: "เบอร์นี้เป็นของสมาชิกท่านอื่นแล้ว" }));
  eq(b.code, "PHONE_TAKEN");
  eq(b.error, "เบอร์นี้เป็นของสมาชิกท่านอื่นแล้ว");
});

// ══════════════════════════════════════════════════════════════════════════
// โหมดรีวิว — ทีมอื่นใช้อยู่ ห้ามพัง + ต้องจำลองอาการล่มให้ทีมหน้าเว็บทดสอบจอได้
// ══════════════════════════════════════════════════════════════════════════
const rvUrl = (path, as) => `http://t${path}?review=${encodeURIComponent(SECRET)}&as=${as}`;

function reviewOn() {
  reset();
  process.env.REVIEW_SECRET = SECRET;
  delete process.env.VERCEL_ENV;
}

test("โหมดรีวิว · สถานการณ์ปกติยังทำงานเหมือนเดิม (gold2300 = สมาชิก)", async () => {
  reviewOn();
  const b = await body(await memberRoute.GET(new Request(rvUrl("/api/member", "gold2300"))));
  eq(b.registered, true);
  ok(b.user && b.user.points === 2300, "ต้องได้ข้อมูลจำลองเดิม");
});

test("โหมดรีวิว · สถานการณ์ 'ยังไม่สมัคร' ได้ code NOT_REGISTERED ติดมาด้วย", async () => {
  reviewOn();
  const b = await body(await memberRoute.GET(new Request(rvUrl("/api/member", "new"))));
  eq(b.registered, false);
  eq(b.code, "NOT_REGISTERED");
});

test("โหมดรีวิว · as=fail_db → ทุกเส้นตอบ DB_UNAVAILABLE 503 เหมือนกันหมด", async () => {
  reviewOn();
  await expectError(await memberRoute.GET(new Request(rvUrl("/api/member", "fail_db"))), "DB_UNAVAILABLE", 503);
  await expectError(await txRoute.GET(new Request(rvUrl("/api/member/transactions", "fail_db"))), "DB_UNAVAILABLE", 503);
  await expectError(await rewardsRoute.GET(new Request(rvUrl("/api/rewards", "fail_db"))), "DB_UNAVAILABLE", 503);
  await expectError(await redeemRoute.POST(postReq(rvUrl("/api/liff/redeem", "fail_db"), { rewardId: 101 })), "DB_UNAVAILABLE", 503);
});

test("โหมดรีวิว · as=fail_auth → AUTH_REQUIRED 401 · as=fail_line → LINE_UNAVAILABLE 503", async () => {
  reviewOn();
  await expectError(await memberRoute.GET(new Request(rvUrl("/api/member", "fail_auth"))), "AUTH_REQUIRED", 401);
  await expectError(await memberRoute.GET(new Request(rvUrl("/api/member", "fail_line"))), "LINE_UNAVAILABLE", 503);
  await expectError(await memberRoute.GET(new Request(rvUrl("/api/member", "fail_server"))), "SERVER_ERROR", 500);
});

test("โหมดรีวิว · as=fail_expiry → ยังเป็นสมาชิก แต่ติดธง expiryUnavailable", async () => {
  reviewOn();
  const b = await body(await memberRoute.GET(new Request(rvUrl("/api/member", "fail_expiry"))));
  eq(b.registered, true, "ห้ามพาไปจอสมัคร");
  eq(b.expiry, null);
  eq(b.expiryUnavailable, true);
});

test("โหมดรีวิว · รหัสผิด = ไม่เข้าโหมดรีวิว (เดินเส้นทางของจริงตามปกติ)", async () => {
  reviewOn();
  setUser({ userId: "U_brand_new" });
  const b = await body(await memberRoute.GET(new Request("http://t/api/member?review=wrong&as=fail_db")));
  eq(b.registered, false, "รหัสผิดต้องไม่ได้ข้อมูลจำลอง");
  eq(b.code, "NOT_REGISTERED");
});

test("โหมดรีวิว · ปิดตายบน production แม้ใส่รหัสถูก", async () => {
  reviewOn();
  process.env.VERCEL_ENV = "production";
  setUser({ userId: "U_brand_new" });
  const b = await body(await memberRoute.GET(new Request(rvUrl("/api/member", "fail_db"))));
  eq(b.registered, false, "บน production ห้ามคืนข้อมูลจำลองเด็ดขาด");
  delete process.env.VERCEL_ENV;
  process.env.REVIEW_SECRET = SECRET;   // คืนค่าให้ไฟล์เทสต์อื่นที่รันต่อจากนี้
});
