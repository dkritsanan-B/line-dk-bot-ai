// กันข้อมูลรั่วไปถึงคนที่สวมเบอร์คนอื่นสมัคร (16 ก.ย. 69)
// สถานการณ์: ใครก็สมัครสมาชิกด้วยเบอร์ของลูกค้ารายใหญ่ได้ → บอทเดารหัสลูกค้า Hero จากเบอร์ไว้ (suggested) รอพนักงานยืนยัน
// ห้ามให้คนนั้นเห็น (1) รหัสลูกค้าของเจ้าของเบอร์ (2) บิล/ยอดซื้อของเจ้าของเบอร์ (3) แม้แต่ว่า "เบอร์นี้เป็นลูกค้าร้าน"
import { test, eq, ok } from "./_harness.mjs";
import { buildLinkState, toClientLink, toClientUser } from "../lib/points.ts";

const DAY = 86400000;
const bills = { count: 7, amount: 184500, estimated_points: 1845, first_bill_date: "2026-09-01", last_bill_date: "2026-09-15" };
const createdAt = new Date(Date.now() - 5 * DAY).toISOString();

const suggested = buildLinkState({ id: 1, customer_id: null, suggested_customer_id: "CUS-00912", created_at: createdAt }, { pendingBills: bills });
const pending = buildLinkState({ id: 2, customer_id: null, suggested_customer_id: null, created_at: createdAt }, { pendingBills: bills });

test("ฝั่งแอดมินยังได้ข้อมูลเต็ม (ใช้ตามเดิม ไม่ถูกกรอง)", () => {
  eq(suggested.status, "suggested");
  eq(suggested.suggested_customer_id, "CUS-00912");
  eq(suggested.pending_bills?.amount, 184500);
});

test("ลูกค้าที่ยังไม่ยืนยันตัวตน ไม่เห็นรหัสลูกค้าที่ระบบเดาไว้ ทั้งในฟิลด์และในข้อความ", () => {
  const c = toClientLink(suggested);
  const json = JSON.stringify(c);
  ok(!json.includes("CUS-00912"), "รหัสลูกค้าของเจ้าของเบอร์หลุดออกไป: " + json);
  ok(!("suggested_customer_id" in c), "ต้องไม่มีฟิลด์ suggested_customer_id เลย");
});

test("ลูกค้าที่ยังไม่ยืนยันตัวตน ไม่เห็นบิล ยอดเงิน หรือวันที่ซื้อของเจ้าของเบอร์", () => {
  const json = JSON.stringify(toClientLink(suggested));
  ok(!("pending_bills" in toClientLink(suggested)), "ต้องไม่มีฟิลด์ pending_bills");
  for (const leak of ["184500", "184,500", "1845", "2026-09-01", "2026-09-15", "7 ใบ"]) {
    ok(!json.includes(leak), `ข้อมูลการซื้อหลุด (${leak}): ${json}`);
  }
});

test("แยกไม่ออกว่าระบบเจอรหัสหรือไม่ (กันไล่เดาเบอร์ว่าใครเป็นลูกค้าร้าน)", () => {
  eq(JSON.stringify(toClientLink(suggested)), JSON.stringify(toClientLink(pending)),
    "คำตอบของ suggested กับ pending ต้องเหมือนกันทุกไบต์");
  eq(toClientLink(suggested).status, "pending");
});

test("ยังบอกลูกค้าชัดว่าแต้มยังไม่เข้า และต้องทำอะไรต่อ", () => {
  const c = toClientLink(pending);
  eq(c.earns_points, false);
  ok(c.headline.includes("แต้มยังไม่เข้า"));
  ok(c.action && c.action.length > 10, "ต้องมีขั้นตอนถัดไปให้ลูกค้า");
  eq(c.overdue, true, "สมัคร 5 วันแล้วยังไม่ผูก ต้องติดธงค้างนาน (นับจากวันสมัครของตัวเอง ไม่ใช่ข้อมูลคนอื่น)");
});

test("คนที่ผูกแล้วเห็นรหัสของตัวเองได้ตามปกติ", () => {
  const c = toClientLink(buildLinkState({ id: 3, customer_id: "CUS-00777", suggested_customer_id: null, created_at: createdAt }));
  eq(c.status, "linked");
  eq(c.customer_id, "CUS-00777");
  eq(c.earns_points, true);
});

test("ข้อมูลสมาชิกที่ส่งไปหน้าเว็บ ไม่มีรหัสที่เดาไว้และ LINE user id", () => {
  const u = toClientUser({ id: 9, phone: "0812345678", points: 10, suggested_customer_id: "CUS-00912", line_user_id: "U123", customer_id: null });
  ok(!("suggested_customer_id" in u));
  ok(!("line_user_id" in u));
  eq(u.phone, "0812345678");
  eq(u.points, 10);
});

test("ค่าว่างไม่ทำให้พัง", () => {
  eq(toClientLink(null), null);
  eq(toClientUser(null), null);
});
