import { test, eq, ok } from "./_harness.mjs";
import { reset, calls } from "./mocks/db.mjs";

const { NextRequest } = await import("next/server");
const members = await import("../app/api/admin/members/route.ts");
const updateMember = await import("../app/api/admin/update-member/route.ts");
const redemptions = await import("../app/api/admin/redemptions/route.ts");

const originalEnv = process.env.VERCEL_ENV;
const originalSecret = process.env.REVIEW_SECRET;

test("admin review mode เปิดไม่ได้เด็ดขาดเมื่อ VERCEL_ENV=production", async () => {
  reset();
  process.env.VERCEL_ENV = "production";
  process.env.REVIEW_SECRET = "review-secret-123";
  const res = await members.GET(new NextRequest("http://localhost:3100/api/admin/members?review=review-secret-123"));
  eq(res.status, 401);
  eq(calls.length, 0, "คำขอที่ไม่มีสิทธิ์ต้องไม่แตะฐานข้อมูล");
});

test("admin review mode คืนข้อมูลและจำลองปุ่มโดยไม่แตะฐานข้อมูล", async () => {
  reset();
  process.env.VERCEL_ENV = "preview";
  process.env.REVIEW_SECRET = "review-secret-123";
  const req = new NextRequest("http://localhost:3100/api/admin/members?review=review-secret-123&search=678");
  const data = await (await members.GET(req)).json();
  eq(data.review, true);
  eq(data.users.length, 1);
  ok(data.users[0].phone.endsWith("678"), "ค้นหาเบอร์ท้าย 3 ตัวได้");

  const patch = await updateMember.PATCH(new NextRequest("http://localhost:3100/api/admin/update-member?review=review-secret-123", { method: "PATCH", body: "{}" }));
  const redeem = await redemptions.POST(new NextRequest("http://localhost:3100/api/admin/redemptions?review=review-secret-123", { method: "POST", body: JSON.stringify({ id: 5042, action: "confirm" }) }));
  eq((await patch.json()).review, true);
  eq((await redeem.json()).review, true);
  eq(calls.length, 0, "review mode ห้ามอ่านหรือเขียนฐานข้อมูล");

  process.env.VERCEL_ENV = originalEnv;
  process.env.REVIEW_SECRET = originalSecret;
});
