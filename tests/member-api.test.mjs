// /api/member ต้องบอกชัดว่า "ตอนนี้ได้แต้มหรือยัง" — ทั้งของจริงและโหมดรีวิว
import { test, eq, ok } from "./_harness.mjs";
import { onQuery, reset, queriesWith } from "./mocks/db.mjs";
import { setUser } from "./mocks/liff-auth.mjs";

// เทสต์ไฟล์อื่นก็เล่นกับ env ตัวเดียวกัน (ทุกไฟล์ถูก import ก่อนแล้วค่อยรัน) → ตั้งค่าตอน "รัน" ไม่ใช่ตอน import
const reviewEnv = () => { process.env.REVIEW_SECRET = "dkreview2569"; delete process.env.VERCEL_ENV; };

const { NextRequest } = await import("next/server");
const { GET } = await import("../app/api/member/route.ts");

const reviewReq = (as) => (reviewEnv(), new NextRequest(`http://localhost:3100/api/member?review=dkreview2569&as=${as}`));
const json = async (res) => await res.json();

test("โหมดรีวิว as=unlinked: สมัครแล้วแต่ไม่มีรหัสเลย → pending + ค้างนาน", async () => {
  const d = await json(await GET(reviewReq("unlinked")));
  eq(d.registered, true);
  eq(d.link_status, "pending");
  eq(d.link.earns_points, false);
  eq(d.link.overdue, true);
  ok(!("suggested_customer_id" in d.link), "ห้ามมีฟิลด์รหัสที่ระบบเดาไว้ในคำตอบถึงลูกค้า");
  ok(d.link.waiting_days >= 5, "ควรรอมาแล้วหลายวัน ได้ " + d.link.waiting_days);
});

test("โหมดรีวิว as=waitingBills: รอยืนยัน แต่ห้ามเผยรหัสหรือบิลของเจ้าของเบอร์ (อาจเป็นคนสวมเบอร์)", async () => {
  const d = await json(await GET(reviewReq("waitingBills")));
  eq(d.link_status, "pending", "ลูกค้าต้องแยกไม่ออกว่าระบบเจอรหัสหรือไม่");
  eq(d.link.earns_points, false);
  const raw = JSON.stringify(d);
  ok(!raw.includes("CUS-00912"), "รหัสลูกค้าของเจ้าของเบอร์หลุด");
  ok(!raw.includes("12450") && !("pending_bills" in d.link), "ยอดบิลของเจ้าของเบอร์หลุด");
  ok(!raw.includes("suggested_customer_id"), "ฟิลด์รหัสที่เดาไว้หลุดใน user หรือ link");
});

test("โหมดรีวิว as=pending (ของเดิม): ยังใช้ได้ และลูกค้าเห็นเป็น pending", async () => {
  const d = await json(await GET(reviewReq("pending")));
  eq(d.registered, true);
  eq(d.link_status, "pending");
  eq(d.link.overdue, false, "เพิ่งสมัครเมื่อกี้ ยังไม่ถือว่าค้างนาน");
});

test("โหมดรีวิว as=linkedNew: ผูกแล้ว ยังไม่มีบิล → linked ไม่มีคำเตือน", async () => {
  const d = await json(await GET(reviewReq("linkedNew")));
  eq(d.link_status, "linked");
  eq(d.link.earns_points, true);
  ok(!("pending_bills" in d.link));
  eq(d.link.customer_id, "CUS-00912", "คนที่ผูกแล้วเห็นรหัสของตัวเองได้");
});

test("โหมดรีวิว as=bronze120 (ของเดิม): สมาชิกปกติต้องเป็น linked และของเดิมยังครบ", async () => {
  const d = await json(await GET(reviewReq("bronze120")));
  eq(d.link_status, "linked");
  eq(d.registered, true);
  ok(d.user && d.user.points === 120, "ข้อมูลสมาชิกเดิมต้องไม่หาย");
  ok(d.expiry !== undefined, "ช่องแต้มใกล้หมดอายุต้องยังอยู่");
});

test("โหมดรีวิว as=new: ยังไม่สมัคร → ไม่มี link และไม่พัง", async () => {
  const d = await json(await GET(reviewReq("new")));
  eq(d.registered, false);
  eq(d.link, null);
  eq(d.link_status, null);
  eq(d.code, "NOT_REGISTERED", "จอสมัครยังต้องขึ้นได้เหมือนเดิม");
});

test("ของจริง: สมาชิกที่ยังไม่ถูกผูกรหัส ต้องได้ link_status=pending + บิลค้าง", async () => {
  reset();
  setUser({ userId: "U_test" });
  onQuery("FROM users WHERE line_user_id", [{ id: 55, phone: "0812345678", points: 0, total_earned: 0, customer_id: null, suggested_customer_id: null, created_at: new Date(Date.now() - 9 * 86400000).toISOString() }]);
  onQuery("FROM hero_pending_bills", [{ count: 2, amount: 9900, estimated_points: 99, first_bill_date: "2569-09-12", last_bill_date: "2569-09-14" }]);
  const d = await json(await GET(new NextRequest("http://localhost:3100/api/member")));
  eq(d.registered, true);
  eq(d.link_status, "pending");
  ok(!("pending_bills" in d.link) && !JSON.stringify(d).includes("9900"), "ยอดบิลค้างต้องไม่ถึงหน้าลูกค้า (ดูได้ในแอดมิน)");
  eq(d.link.overdue, true);
  ok(d.user.id === 55, "ข้อมูลสมาชิกเดิมต้องยังส่งไปเหมือนเดิม");
});

test("ของจริง: สมาชิกที่ผูกรหัสแล้ว → linked และไม่ถามตารางบิลค้าง", async () => {
  reset();
  setUser({ userId: "U_test" });
  onQuery("FROM users WHERE line_user_id", [{ id: 56, phone: "0812345679", points: 300, total_earned: 300, customer_id: "cus-10595", suggested_customer_id: null, created_at: new Date().toISOString() }]);
  const d = await json(await GET(new NextRequest("http://localhost:3100/api/member")));
  eq(d.link_status, "linked");
  eq(d.link.customer_id, "CUS-10595");
  eq(queriesWith("hero_pending_bills").length, 0);
});

test("ของจริง: ตารางบิลค้างล่ม → ยังคืนบัตรสมาชิกได้ (ไม่ 500)", async () => {
  reset();
  setUser({ userId: "U_test" });
  onQuery("FROM users WHERE line_user_id", [{ id: 57, phone: "0812345670", points: 0, total_earned: 0, customer_id: null, suggested_customer_id: "CUS-1", created_at: new Date().toISOString() }]);
  onQuery("FROM hero_pending_bills", new Error("connection terminated"));
  const res = await GET(new NextRequest("http://localhost:3100/api/member"));
  eq(res.status, 200);
  const d = await res.json();
  eq(d.link_status, "pending");
  ok(!JSON.stringify(d).includes("CUS-1"), "รหัสที่เดาไว้ต้องไม่หลุดแม้ตอนตารางบิลค้างล่ม");
});

test("ของจริง: ยังไม่สมัคร → registered:false เหมือนเดิม ไม่มี link", async () => {
  reset();
  setUser({ userId: "U_ไม่มีในระบบ" });
  onQuery("FROM users WHERE line_user_id", []);
  const d = await json(await GET(new NextRequest("http://localhost:3100/api/member")));
  eq(d.registered, false);
  eq(d.code, "NOT_REGISTERED");
});

test("POST สมัครสมาชิก (โหมดรีวิว): ตอบกลับต้องบอกว่ายังไม่ได้แต้ม รอผูกรหัส", async () => {
  reviewEnv();
  const { POST } = await import("../app/api/member/route.ts");
  const req = new NextRequest("http://localhost:3100/api/member?review=dkreview2569&as=new", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: "0898887777", firstName: "วิชัย", lastName: "มั่นคง", birthday: "1985-05-05", consent: true }),
  });
  const d = await (await POST(req)).json();
  eq(d.success, true);
  eq(d.link_status, "pending", "จอถัดจากปุ่มสมัครคือจอรอพนักงานยืนยัน");
  ok(!JSON.stringify(d).includes("suggested_customer_id"), "ห้ามส่งรหัสที่เดาไว้กลับไปตอนสมัคร");
  eq(d.link.earns_points, false);
  eq(d.user.phone, "0898887777");
});

test("POST สมัครสมาชิก (ของจริง): สมาชิกใหม่ยังไม่มีรหัส → link_status=pending", async () => {
  reset();
  setUser({ userId: "U_new" });
  const { POST } = await import("../app/api/member/route.ts");
  onQuery("FROM users WHERE line_user_id", [{ id: 99, phone: "0898887777", points: 0, total_earned: 0, customer_id: null, suggested_customer_id: null, created_at: new Date().toISOString() }]);
  const req = new NextRequest("http://localhost:3100/api/member", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: "0898887777", firstName: "วิชัย", lastName: "มั่นคง", birthday: "1985-05-05", consent: true }),
  });
  const d = await (await POST(req)).json();
  eq(d.success, true);
  eq(d.link_status, "pending");
  eq(d.link.earns_points, false);
  ok(d.link.action && d.link.action.length > 0, "ต้องบอกลูกค้าว่าต้องทำอะไรต่อ");
});
