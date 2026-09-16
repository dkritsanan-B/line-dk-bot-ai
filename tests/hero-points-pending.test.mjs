// /api/hero/points — บิลของสมาชิกที่ยังไม่ถูกผูกรหัส ต้อง "ไม่ได้แต้ม" แต่ต้องไม่หายเงียบ
// เรื่องนี้คือเงินของลูกค้า: เทสต์ชุดนี้จึงเช็คด้วยว่า "ไม่มีคิวรีไหนไปบวกแต้ม" ไม่ใช่ดูแค่ข้อความตอบกลับ
import { test, eq, ok } from "./_harness.mjs";
import { onQuery, reset, queriesWith, calls } from "./mocks/db.mjs";

process.env.HERO_POINTS_SECRET = "secret-for-tests-1234567890";

const { NextRequest } = await import("next/server");
const route = await import("../app/api/hero/points/route.ts");

const post = (bills) => new NextRequest("http://localhost:3100/api/hero/points", {
  method: "POST",
  headers: { "content-type": "application/json", "x-hero-secret": process.env.HERO_POINTS_SECRET },
  body: JSON.stringify({ bills }),
});
const get = () => new NextRequest("http://localhost:3100/api/hero/points", { headers: { "x-hero-secret": process.env.HERO_POINTS_SECRET } });

const noPointsWereGiven = () => {
  const touched = calls.filter((c) =>
    c.text.includes("UPDATE users SET") ||
    c.text.includes("INSERT INTO transactions") ||
    c.text.includes("INSERT INTO hero_point_bills"));
  ok(touched.length === 0, "ต้องไม่มีคิวรีที่ให้แต้ม/บันทึกบิลที่ให้แต้มแล้ว แต่เจอ: " + touched.map((t) => t.text.slice(0, 60)).join(" | "));
};

test("บิลของรหัสที่ยังไม่ผูก แต่ตรงกับรหัสที่ระบบเดาไว้ → ไม่ให้แต้ม แต่จดบิลค้างไว้", async () => {
  reset();
  onQuery("TRIM(suggested_customer_id)", [{ id: 42 }]);
  const res = await route.POST(post([{ customer_code: "cus-00912", bill_no: "IV-690500", amount: 4250, date: "2569-09-15" }]));
  const d = await res.json();
  eq(d.results[0].status, "skip");
  eq(d.results[0].pending_for, 42);
  eq(d.results[0].points, undefined, "ต้องไม่มีแต้มติดมากับผลลัพธ์");
  noPointsWereGiven();

  const ins = queriesWith("INSERT INTO hero_pending_bills");
  eq(ins.length, 1, "ต้องจดบิลค้างไว้ 1 แถว");
  ok(ins[0].values.includes("IV-690500") && ins[0].values.includes(42) && ins[0].values.includes("CUS-00912") && ins[0].values.includes(4250),
    "แถวบิลค้างต้องมีเลขบิล/สมาชิก/รหัส/ยอด: " + JSON.stringify(ins[0].values));
});

test("รหัสที่ไม่ใช่ของสมาชิกคนไหนเลย (ลูกค้าทั่วไป) → ข้ามเฉย ๆ ไม่จดข้อมูลการซื้อของคนอื่นไว้", async () => {
  reset();
  onQuery("TRIM(suggested_customer_id)", []);
  const d = await (await route.POST(post([{ customer_code: "CUS-99999", bill_no: "IV-690501", amount: 50000, date: "2569-09-15" }]))).json();
  eq(d.results[0].status, "skip");
  eq(d.results[0].message, "ไม่มีสมาชิกผูกรหัสนี้");
  eq(queriesWith("INSERT INTO hero_pending_bills").length, 0);
  noPointsWereGiven();
});

test("จดบิลค้างล้มเหลว → บิลนั้นยังตอบ skip ตามปกติ ไม่ทำให้ทั้งชุดพัง", async () => {
  reset();
  onQuery("TRIM(suggested_customer_id)", new Error("connection terminated"));
  const d = await (await route.POST(post([
    { customer_code: "CUS-00912", bill_no: "IV-690502", amount: 1000, date: "2569-09-15" },
    { customer_code: "CUS-00912", bill_no: "IV-690503", amount: 2000, date: "2569-09-15" },
  ]))).json();
  eq(d.results.length, 2);
  eq(d.results[0].status, "skip");
  eq(d.results[1].status, "skip");
  eq(d.results[0].message, "ไม่มีสมาชิกผูกรหัสนี้");
  noPointsWereGiven();
});

test("สมาชิกที่ผูกรหัสแล้ว ยังได้แต้มเหมือนเดิม และไม่ไปยุ่งกับตารางบิลค้าง", async () => {
  reset();
  const u = { id: 7, phone: "0812345678", line_user_id: null, first_name: "สมชาย", display_name: null, total_earned: 0, points: 0, last_purchase_at: null };
  onQuery("TRIM(customer_id)", [u]);
  onQuery("FROM users WHERE phone", [u]);
  onQuery("WITH u AS ( UPDATE users SET points = points +", [{ points: 42 }]);   // addPoints (คำสั่งเดียว) คืนยอดหลังบวก
  const d = await (await route.POST(post([{ customer_code: "CUS-00912", bill_no: "IV-690504", amount: 4250, date: "2569-09-15" }]))).json();
  eq(d.results[0].status, "ok");
  eq(d.results[0].points, 42, "4,250 บาท = 42 แต้ม (กติกาเดิม ปัดลง)");
  // migrateDB สร้างตาราง (CREATE TABLE IF NOT EXISTS) ทุกครั้งอยู่แล้ว — ที่ต้องไม่มีคือการอ่าน/เขียนแถว
  eq(queriesWith("INSERT INTO hero_pending_bills").length, 0, "ผูกแล้วไม่ต้องจดบิลค้าง");
  eq(queriesWith("FROM hero_pending_bills").length, 0, "ผูกแล้วไม่ต้องอ่านบิลค้าง");
  eq(queriesWith("UPDATE users SET").length >= 1, true);
});

test("GET: รายชื่อรหัสที่ผูกแล้วต้องไม่เปลี่ยน (บอทที่ร้านใช้กรองบิลอยู่) + เพิ่มรายชื่อที่รอผูก", async () => {
  reset();
  onQuery("FROM users", [
    { id: 1, customer_id: "CUS-1", suggested_customer_id: null, phone: "0811111111", total_earned: 500, points: 500, last_purchase_at: new Date().toISOString() },
    { id: 2, customer_id: null, suggested_customer_id: "cus-2", phone: "0822222222", total_earned: 0, points: 0, last_purchase_at: null },
    { id: 3, customer_id: null, suggested_customer_id: null, phone: "0833333333", total_earned: 0, points: 0, last_purchase_at: null },
  ]);
  const d = await (await route.GET(get())).json();
  eq(d.codes, ["CUS-1"], "codes ต้องมีเฉพาะคนที่ผูกแล้วเท่านั้น ห้ามมีคนที่รอผูกหลุดเข้าไป");
  eq(d.members.length, 1);
  eq(d.pending, [{ id: 2, code: "CUS-2" }]);
  eq(d.pending_codes, ["CUS-2"]);
  eq(d.unlinked, [{ id: 3, phone: "0833333333" }], "คนที่ยังไม่มีรหัสเดา ต้องยังถูกส่งให้บอทลองจับคู่เบอร์เหมือนเดิม");
});

test("ยิงมาโดยไม่มีรหัสลับ → 401 ไม่แตะฐานข้อมูลเลย", async () => {
  reset();
  const res = await route.POST(new NextRequest("http://localhost:3100/api/hero/points", { method: "POST", body: "{}" }));
  eq(res.status, 401);
  eq(calls.length, 0);
});
