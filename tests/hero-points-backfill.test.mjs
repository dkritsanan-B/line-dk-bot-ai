import { test, eq, ok } from "./_harness.mjs";
import { onQuery, reset, queriesWith } from "./mocks/db.mjs";

process.env.HERO_POINTS_SECRET = "secret-for-tests-1234567890";
const { NextRequest } = await import("next/server");
const route = await import("../app/api/hero/points/route.ts");
const req = (method, body) => new NextRequest("http://localhost:3100/api/hero/points", {
  method, headers: { "content-type": "application/json", "x-hero-secret": process.env.HERO_POINTS_SECRET },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const user = (extra = {}) => ({ id: 9, phone: "0812345678", line_user_id: null, first_name: "เอ", display_name: null,
  total_earned: 0, points: 0, last_purchase_at: null, backfill_from: "2026-09-01", backfill_done_at: null, ...extra });

test("GET คืนคิว backfill เฉพาะคนที่ยังไม่ปิด สูงสุด 50 คน", async () => {
  reset();
  const rows = Array.from({ length: 55 }, (_, i) => ({ ...user({ id: i + 1 }), customer_id: ` cus-${i} `,
    suggested_customer_id: null, backfill_from: "2026-09-01" }));
  rows.push({ ...user({ id: 99, backfill_done_at: new Date().toISOString() }), customer_id: "CUS-DONE", suggested_customer_id: null });
  onQuery("FROM users", rows);
  const d = await (await route.GET(req("GET"))).json();
  eq(d.backfill.length, 50);
  eq(d.backfill[0], { code: "CUS-0", from: "2026-09-01" });
  ok(!d.backfill.some(x => x.code === "CUS-DONE"));
});

test("POST backfill ข้ามบิลก่อนวันสมัคร หลังวันนี้ และคนที่ปิดงานแล้ว", async () => {
  for (const [date, u, message] of [
    ["2026-08-31", user(), "วันที่บิลอยู่นอกช่วงแต้มย้อนหลัง"],
    ["2999-01-01", user(), "วันที่บิลอยู่นอกช่วงแต้มย้อนหลัง"],
    ["2026-09-02", user({ backfill_done_at: "2026-09-10T00:00:00Z" }), "สมาชิกไม่มีคิวย้อนหลังหรือปิดงานแล้ว"],
  ]) {
    reset(); onQuery("TRIM(customer_id)", [u]);
    const d = await (await route.POST(req("POST", { backfill: true, bills: [{ customer_code: "CUS-9", bill_no: `B-${date}`, amount: 1000, date }] }))).json();
    eq(d.results[0].status, "skip"); eq(d.results[0].message, message);
    eq(queriesWith("INSERT INTO hero_point_bills").length, 0);
  }
});

test("POST backfill ใช้ทางเดิมและบิลซ้ำไม่ได้แต้มซ้ำ", async () => {
  reset(); onQuery("TRIM(customer_id)", [user()]); onQuery("SELECT 1 WHERE", [{ ok: 1 }]); onQuery("FROM hero_point_bills", [{ exists: 1 }]);
  const d = await (await route.POST(req("POST", { backfill: true, bills: [{ customer_code: "CUS-9", bill_no: "DUP-1", amount: 1000, date: "2026-09-02" }] }))).json();
  eq(d.results[0].status, "dup");
  eq(queriesWith("INSERT INTO transactions").length, 0);
});

test("POST backfill ที่ผ่านให้แต้มด้วยทางเดิมและเขียน note ว่าแต้มย้อนหลัง", async () => {
  reset();
  onQuery("TRIM(customer_id)", [user()]);
  onQuery("SELECT 1 WHERE", [{ ok: 1 }]);
  onQuery("WITH u AS ( UPDATE users SET points = points +", [{ points: 10 }]);
  const d = await (await route.POST(req("POST", { backfill: true, bills: [{ customer_code: "CUS-9", bill_no: "OLD-1", amount: 1000, date: "2026-09-02" }] }))).json();
  eq(d.results[0].status, "ok"); eq(d.results[0].points, 10);
  const award = queriesWith("WITH u AS ( UPDATE users SET points = points +")[0];
  ok(award.values.some(v => String(v).includes("แต้มย้อนหลัง บิล OLD-1")), "ประวัติต้องระบุว่าเป็นแต้มย้อนหลัง");
});

test("PATCH ปิดคิวและคืนจำนวนแถว", async () => {
  reset(); onQuery("UPDATE users SET backfill_done_at", [{ id: 1 }, { id: 2 }]);
  const d = await (await route.PATCH(req("PATCH", { backfill_done: [" cus-a ", "CUS-B"] }))).json();
  eq(d.updated, 2);
});
