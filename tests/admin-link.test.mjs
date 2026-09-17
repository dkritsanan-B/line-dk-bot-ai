// ฝั่งพนักงาน: หน้าแอดมินต้องเห็นว่าใครค้างรอผูกรหัสนานแค่ไหน และตอนกดผูกต้องเปิดคิวแต้มย้อนหลังโดยยังไม่บวกแต้มทันที
import { test, eq, ok } from "./_harness.mjs";
import { onQuery, reset, queriesWith, calls } from "./mocks/db.mjs";

process.env.ADMIN_PASSWORD = "test-admin-pass";

const { NextRequest } = await import("next/server");
const members = await import("../app/api/admin/members/route.ts");
const updateMember = await import("../app/api/admin/update-member/route.ts");

const adminHeaders = { "x-admin-password": process.env.ADMIN_PASSWORD, "content-type": "application/json" };
const DAY = 86400000;

test("GET /api/admin/members: ติดสถานะการผูก + จำนวนวันที่รอ + สรุปยอดให้พนักงาน", async () => {
  reset();
  onQuery("FROM users ORDER BY created_at DESC", [
    { id: 1, customer_id: "CUS-1", suggested_customer_id: null, phone: "0811111111", created_at: new Date(Date.now() - 40 * DAY).toISOString() },
    { id: 2, customer_id: null, suggested_customer_id: "CUS-2", phone: "0822222222", created_at: new Date(Date.now() - 9 * DAY).toISOString() },
    { id: 3, customer_id: null, suggested_customer_id: null, phone: "0833333333", created_at: new Date(Date.now() - 1 * DAY).toISOString() },
  ]);
  onQuery("FROM hero_pending_bills", [{ user_id: 2, count: 4, amount: 18000, estimated_points: 180, first_bill_date: "2569-09-08", last_bill_date: "2569-09-15" }]);

  const res = await members.GET(new NextRequest("http://localhost:3100/api/admin/members", { headers: adminHeaders }));
  const d = await res.json();
  eq(d.users.map((u) => u.link_status), ["linked", "suggested", "pending"]);
  eq(d.users[1].waiting_days, 9);
  eq(d.users[1].link_overdue, true);
  eq(d.users[1].pending_bills.count, 4);
  eq(d.users[2].link_overdue, false, "เพิ่งสมัครวันเดียว ยังไม่ต้องเร่ง");
  eq(d.link_summary.linked, 1);
  eq(d.link_summary.suggested, 1);
  eq(d.link_summary.pending, 1);
  eq(d.link_summary.overdue, 1);
  eq(d.link_summary.pending_bills, 4);
  ok(d.users[0].phone === "0811111111", "ข้อมูลเดิมของหน้าแอดมินต้องยังอยู่ครบ");
});

test("GET /api/admin/members: อ่านตารางบิลค้างไม่ได้ ก็ยังคืนรายชื่อสมาชิกได้", async () => {
  reset();
  onQuery("FROM users ORDER BY created_at DESC", [{ id: 1, customer_id: null, suggested_customer_id: null, phone: "0811111111", created_at: new Date().toISOString() }]);
  onQuery("FROM hero_pending_bills", new Error('relation "hero_pending_bills" does not exist'));
  const d = await (await members.GET(new NextRequest("http://localhost:3100/api/admin/members", { headers: adminHeaders }))).json();
  eq(d.users.length, 1);
  eq(d.users[0].link_status, "pending");
  eq(d.users[0].pending_bills, null);
});

test("PATCH ผูกรหัสให้สมาชิก: ปิดตัวนับบิลค้างและเปิดคิว แต่ยังห้ามบวกแต้มทันที", async () => {
  reset();
  onQuery("FROM users WHERE id", [{ id: 5, customer_id: null, phone: "0855555555", line_user_id: "U1", first_name: "สมชาย", last_name: "ใจดี" }]);
  onQuery("TRIM(customer_id)", []);   // รหัสนี้ยังไม่มีใครใช้
  onQuery("UPDATE hero_pending_bills", [{ bill_no: "IV-1" }, { bill_no: "IV-2" }]);

  const res = await updateMember.PATCH(new NextRequest("http://localhost:3100/api/admin/update-member", {
    method: "PATCH", headers: adminHeaders, body: JSON.stringify({ id: 5, customer_id: " cus-10595 " }),
  }));
  const d = await res.json();
  eq(d.success, true);
  ok(d.done.some((x) => x.includes("CUS-10595")), "ต้องบันทึกว่าผูกรหัสอะไร: " + JSON.stringify(d.done));
  ok(d.done.some((x) => x.includes("ปิดตัวนับบิลค้าง 2 ใบ")), "ต้องบอกว่าปิดตัวนับบิลค้างกี่ใบ: " + JSON.stringify(d.done));

  const gave = calls.filter((c) => c.text.includes("points = points +") || c.text.includes("INSERT INTO transactions"));
  eq(gave.length, 0, "ห้ามมีแต้มย้อนหลังตอนผูกรหัส");
  const close = queriesWith("UPDATE hero_pending_bills")[0];
  ok(close.text.includes("resolved_at IS NULL") && close.text.includes("SET resolved_at = NOW()"), "ต้องปิดเฉพาะแถวที่ยังไม่ถูกปิด");
});

test("PATCH ล้างรหัสออก (customer_id ว่าง): ไม่ไปปิดบิลค้างของใคร", async () => {
  reset();
  onQuery("FROM users WHERE id", [{ id: 6, customer_id: "CUS-9", phone: "0866666666", line_user_id: null, first_name: "ก", last_name: "ข" }]);
  const d = await (await updateMember.PATCH(new NextRequest("http://localhost:3100/api/admin/update-member", {
    method: "PATCH", headers: adminHeaders, body: JSON.stringify({ id: 6, customer_id: "" }),
  }))).json();
  eq(d.success, true);
  eq(queriesWith("UPDATE hero_pending_bills").length, 0);
});
