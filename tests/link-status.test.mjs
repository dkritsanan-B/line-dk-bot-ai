// สถานะการผูกรหัสลูกค้า Hero — แหล่งความจริงว่า "บัญชีนี้ได้แต้มหรือยัง" (lib/points.ts)
import { test, eq, ok } from "./_harness.mjs";
import { onQuery, reset, queriesWith } from "./mocks/db.mjs";
import {
  linkStatusOf, buildLinkState, waitingDaysSince, normalizeCustomerCode,
  getPendingBillSummary, getLinkState, LINK_OVERDUE_DAYS,
} from "../lib/points.ts";

const DAY = 86400000;

test("ผูกรหัสแล้ว = linked และได้แต้ม", () => {
  const s = buildLinkState({ id: 1, customer_id: "CUS-00912", suggested_customer_id: null, created_at: new Date(Date.now() - 30 * DAY).toISOString() });
  eq(s.status, "linked");
  eq(s.earns_points, true);
  eq(s.customer_id, "CUS-00912");
  eq(s.pending_bills, null);
  eq(s.overdue, false, "ผูกแล้วต้องไม่ติดธงค้างนาน");
});

test("มีรหัสที่ระบบเดาไว้ แต่ยังไม่ผูก = suggested และยังไม่ได้แต้ม", () => {
  const s = buildLinkState({ id: 2, customer_id: null, suggested_customer_id: "cus-00912", created_at: new Date(Date.now() - 1 * DAY).toISOString() });
  eq(s.status, "suggested");
  eq(s.earns_points, false);
  eq(s.suggested_customer_id, "CUS-00912", "รหัสต้องถูกทำให้เป็นตัวพิมพ์ใหญ่แบบเดียวกับที่ /api/hero/points ใช้จับคู่");
  eq(s.waiting_days, 1);
  eq(s.overdue, false);
});

test("ไม่มีรหัสเลย = pending และมีคำแนะนำให้ลูกค้าทำต่อ", () => {
  const s = buildLinkState({ id: 3, customer_id: null, suggested_customer_id: null, created_at: new Date(Date.now() - 10 * DAY).toISOString() });
  eq(s.status, "pending");
  eq(s.earns_points, false);
  eq(s.overdue, true, `ค้าง 10 วัน (เกิน ${LINK_OVERDUE_DAYS}) ต้องติดธงให้พนักงานตาม`);
  ok(s.action && s.action.length > 0, "ต้องบอกลูกค้าว่าต้องทำอะไรต่อ");
  ok(!s.detail.includes("undefined") && !s.detail.includes("null"), "ข้อความต้องไม่มีคำว่า null/undefined");
});

test("ช่องว่าง/ค่าว่างในรหัส ไม่ถือว่าผูกแล้ว (ตรงกับที่ SQL ใช้ TRIM จับคู่)", () => {
  eq(normalizeCustomerCode("   "), null);
  eq(normalizeCustomerCode(" cus-1 "), "CUS-1");
  eq(linkStatusOf({ customer_id: "   ", suggested_customer_id: null }), "pending");
  eq(linkStatusOf({ customer_id: "", suggested_customer_id: "  " }), "pending");
  eq(linkStatusOf({ customer_id: null, suggested_customer_id: undefined }), "pending");
});

test("ผูกแล้วชนะเสมอ ถึงจะมีรหัสที่เดาไว้ค้างอยู่", () => {
  eq(linkStatusOf({ customer_id: "CUS-1", suggested_customer_id: "CUS-2" }), "linked");
  eq(buildLinkState({ customer_id: "CUS-1", suggested_customer_id: "CUS-2" }).suggested_customer_id, null);
});

test("วันสมัครเพี้ยน: ไม่มีวันสมัคร / วันที่พัง / วันในอนาคต", () => {
  eq(waitingDaysSince(null), null);
  eq(waitingDaysSince(undefined), null);
  eq(waitingDaysSince("ไม่ใช่วันที่"), null);
  eq(waitingDaysSince(new Date(Date.now() + 5 * DAY)), 0, "นาฬิกาเหลื่อมต้องไม่ได้ค่าติดลบ");
  eq(waitingDaysSince(new Date(Date.now() - 3.9 * DAY)), 3, "ปัดลงเป็นวันเต็ม");
  const s = buildLinkState({ customer_id: null, suggested_customer_id: null, created_at: null });
  eq(s.waiting_days, null);
  eq(s.overdue, false, "ไม่รู้วันสมัคร ต้องไม่เดาว่าค้างนาน");
});

test("บิลค้างถูกส่งต่อไปในสถานะ และไม่โผล่ตอนผูกแล้ว", () => {
  const bills = { count: 3, amount: 12450, estimated_points: 124, first_bill_date: "2569-09-10", last_bill_date: "2569-09-15" };
  const waiting = buildLinkState({ customer_id: null, suggested_customer_id: "CUS-9", created_at: new Date().toISOString() }, { pendingBills: bills });
  eq(waiting.pending_bills, bills);
  ok(waiting.detail.includes("3"), "ข้อความต้องบอกจำนวนบิลที่ค้าง");
  const linked = buildLinkState({ customer_id: "CUS-9", created_at: new Date().toISOString() }, { pendingBills: bills });
  eq(linked.pending_bills, null, "ผูกแล้วไม่ต้องทวงบิลเก่า (ไม่ให้แต้มย้อนหลัง)");
});

test("getPendingBillSummary: รวมยอด + คิดแต้มด้วยกติกาเดิม (100 บาท = 1 แต้ม ปัดลงต่อบิล)", async () => {
  reset();
  onQuery("FROM hero_pending_bills", [{ count: 3, amount: 12450, estimated_points: 124, first_bill_date: "2569-09-10", last_bill_date: "2569-09-15" }]);
  const s = await getPendingBillSummary(42);
  eq(s, { count: 3, amount: 12450, estimated_points: 124, first_bill_date: "2569-09-10", last_bill_date: "2569-09-15" });
  const q = queriesWith("FROM hero_pending_bills")[0];
  ok(q.text.includes("resolved_at IS NULL"), "ต้องนับเฉพาะบิลที่ยังไม่ถูกปิด");
  ok(q.values.includes(42), "ต้องนับเฉพาะของสมาชิกคนนั้น");
  ok(q.text.split(" ").join("").includes("FLOOR(amount/?") && q.values.includes(100), "ต้องใช้กติกา 100 บาท = 1 แต้ม จากค่าคงที่เดียวกับ addPoints");
});

test("getPendingBillSummary: ไม่มีบิลค้าง / ตารางยังไม่มี → null (บัตรสมาชิกต้องไม่พัง)", async () => {
  reset();
  onQuery("FROM hero_pending_bills", [{ count: 0, amount: 0, estimated_points: 0, first_bill_date: null, last_bill_date: null }]);
  eq(await getPendingBillSummary(42), null);

  reset();
  onQuery("FROM hero_pending_bills", new Error('relation "hero_pending_bills" does not exist'));
  eq(await getPendingBillSummary(42), null, "ตารางยังไม่ถูกสร้าง ต้องไม่ throw");

  reset();
  onQuery("FROM hero_pending_bills", []);
  eq(await getPendingBillSummary(42), null, "ไม่มีแถวคืนมาเลยก็ต้องไม่พัง");
});

test("getLinkState: ผูกแล้วไม่ต้องถามตารางบิลค้างเลย (ประหยัดคิวรีให้บัตรสมาชิก)", async () => {
  reset();
  const s = await getLinkState({ id: 7, customer_id: "CUS-77", suggested_customer_id: null, created_at: new Date().toISOString() });
  eq(s.status, "linked");
  eq(queriesWith("hero_pending_bills").length, 0);
});

test("getLinkState: ยังไม่ผูก → ดึงบิลค้างมาด้วย", async () => {
  reset();
  onQuery("FROM hero_pending_bills", [{ count: 2, amount: 800, estimated_points: 8, first_bill_date: null, last_bill_date: null }]);
  const s = await getLinkState({ id: 8, customer_id: null, suggested_customer_id: "CUS-88", created_at: new Date(Date.now() - 4 * DAY).toISOString() });
  eq(s.status, "suggested");
  eq(s.pending_bills.count, 2);
  eq(s.overdue, true);
});
