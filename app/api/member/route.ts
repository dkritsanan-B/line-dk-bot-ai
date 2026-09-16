export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getUserByLineId, registerUser, migrateDB, RegisterError, getExpiringSummary, buildLinkState, getLinkState, toClientLink, toClientUser } from "@/lib/points";
import { verifyLiffUser, isAuthError } from "@/lib/liff-auth";
import { reviewScenarioFrom, REVIEW_ENABLED_NOTE, REVIEW_SCENARIOS } from "@/lib/review-mode";
import { apiError, apiOk, authError, dbError, reviewFaultResponse } from "@/app/api/_lib/api-error";

// ตัวตนมาจาก LIFF access token (Authorization: Bearer) ที่เซิร์ฟเวอร์ตรวจกับ LINE เอง — ไม่เชื่อ lineUserId ที่ client ส่งมาอีกแล้ว (14 ก.ย. 69)
//
// รูปแบบคำตอบ (16 ก.ย. 69) — ดู app/api/_lib/api-error.ts
//   200 { registered:true,  user, expiry, link_status, link }   = สมาชิก (link_status = linked | pending)
//   user และ link ผ่าน toClientUser/toClientLink เสมอ — ห้ามส่งรหัสที่ระบบเดาไว้หรือบิลค้างของเจ้าของเบอร์ให้คนที่ยังไม่ยืนยันตัวตน
//   200 { registered:false, code:"NOT_REGISTERED" }             = LINE นี้ยังไม่เคยสมัคร  ← จอสมัครขึ้นได้เฉพาะกรณีนี้เท่านั้น
//   4xx/5xx { ok:false, code, error }                           = มีปัญหา ห้ามตีความว่ายังไม่สมัคร
export async function GET(req: NextRequest) {
  // โหมดรีวิว: คืนข้อมูลจำลอง ไม่แตะฐานข้อมูลจริง (ปิดตายบน production — ดู lib/review-mode.ts)
  const rv = reviewScenarioFrom(new URL(req.url));
  if (rv) {
    const fault = reviewFaultResponse(rv.fault);
    if (fault) return fault;
    // สถานะการผูกรหัสลูกค้า Hero คิดด้วยฟังก์ชันตัวเดียวกับของจริง ผู้ตรวจจะได้เห็นพฤติกรรมจริง ไม่ใช่ข้อความที่แต่งไว้
    const link = toClientLink(rv.member ? buildLinkState(rv.member, { pendingBills: rv.pendingBills ?? null }) : null);
    return apiOk({
      review: REVIEW_ENABLED_NOTE, scenario: rv.key, profile: rv.profile,
      registered: rv.registered, user: toClientUser(rv.member as unknown as Record<string, unknown>),
      link_status: link?.status ?? null, link,
      expiry: rv.fault === "expiry" ? null : rv.expiry,
      ...(rv.fault === "expiry" ? { expiryUnavailable: true } : {}),
      ...(rv.registered ? {} : { code: "NOT_REGISTERED" }),
    });
  }

  const who = await verifyLiffUser(req);
  if (isAuthError(who)) return authError(who);

  // แยกให้ชัด: ถามฐานข้อมูลไม่ได้ ≠ ถามได้แล้วไม่เจอ — เดิมพังตรงนี้แล้ว throw ออกเป็นหน้า error ของ Next
  // หน้าเว็บอ่าน data.registered ได้ undefined → พาสมาชิกเก่าไปจอสมัครใหม่
  let user;
  try {
    user = await getUserByLineId(who.userId);
  } catch (e) {
    return dbError(e, "GET /api/member → getUserByLineId");
  }
  if (!user) return apiOk({ registered: false, code: "NOT_REGISTERED" });

  // นับเฉพาะก้อนที่จะหมดอายุ "ในช่วงที่เตือน" เท่านั้น (กติกาเดียวกับ cron แจ้งเตือน — อยู่ที่ lib/points.ts ที่เดียว)
  // ถ้าคิวรีนี้ล้มแต่รู้แล้วว่าเป็นสมาชิก → ยังคืนบัตรสมาชิกให้ดูได้ แต่ติดธง expiryUnavailable ไว้
  // (โชว์บัตรแบบไม่มีกล่องวันหมดอายุ ดีกว่าพาสมาชิกไปจอสมัคร แต่ต้องไม่เงียบ — หน้าเว็บต้องบอกว่าดูวันหมดอายุไม่ได้ตอนนี้)
  // แต้มเข้าอัตโนมัติเฉพาะคนที่พนักงานผูกรหัสลูกค้า Hero ให้แล้วเท่านั้น (/api/hero/points จับบิลจาก users.customer_id)
  // คนที่ยังไม่ถูกผูกต้องรู้ตัวว่า "ยังไม่ได้แต้ม" ไม่ใช่รอเงียบ ๆ ทั้งที่จอสมัครเขียนว่าแต้มเข้าอัตโนมัติ (16 ก.ย. 69)
  // getLinkState กลืน error ของตารางบิลค้างไว้เองแล้ว (อ่านไม่ได้ = ถือว่าไม่มีบิลค้าง) บัตรสมาชิกจึงไม่พังเพราะเรื่องนี้
  // ห้ามมี await ตัวไหนใน route นี้หลุดออกไปโดยไม่มี try — throw หนึ่งครั้ง = สมาชิกเก่าเห็นจอสมัคร
  // ชนิดเป็น ClientLinkState เท่านั้น — ถ้าเผลอใส่ LinkState เต็ม (มีรหัสที่เดาไว้/บิลค้างของเจ้าของเบอร์) tsc จะไม่ยอม
  let link: ReturnType<typeof toClientLink> = null;
  try {
    link = toClientLink(await getLinkState(user));
  } catch (e) {
    console.error("[api] GET /api/member → getLinkState ล้มเหลว:", e);
  }

  try {
    const expiry = await getExpiringSummary(user.id, user.points);
    return apiOk({ registered: true, user: toClientUser(user as unknown as Record<string, unknown>), expiry, link_status: link?.status ?? null, link });
  } catch (e) {
    console.error("[api] GET /api/member → getExpiringSummary ล้มเหลว:", e);
    return apiOk({ registered: true, user: toClientUser(user as unknown as Record<string, unknown>), expiry: null, expiryUnavailable: true, link_status: link?.status ?? null, link });
  }
}

export async function POST(req: NextRequest) {
  // โหมดรีวิว: ทำเหมือนสมัครสำเร็จ แต่ไม่เขียนอะไรลงฐานข้อมูล
  const rvPost = reviewScenarioFrom(new URL(req.url));
  if (rvPost) {
    const fault = reviewFaultResponse(rvPost.fault);
    if (fault) return fault;
    const body = await req.json().catch(() => ({}));
    const tel = String(body.phone ?? "0812345678").replace(/\D/g, "");
    if (!/^0\d{9}$/.test(tel)) return apiError("INVALID_PHONE");
    const base = REVIEW_SCENARIOS.pending.member!;
    // สมัครเสร็จยังไม่ได้แต้ม จนกว่าพนักงานจะผูกรหัสลูกค้า Hero ให้ — ส่งสถานะไปด้วย หน้าเว็บจะได้ขึ้นจอ "รอผูกรหัส" ต่อได้เลย
    const fresh = { ...base, phone: tel, first_name: body.firstName ?? base.first_name, last_name: body.lastName ?? base.last_name, company: body.company ?? null, birthday: body.birthday ?? base.birthday };
    const link = toClientLink(buildLinkState(fresh))!;
    return apiOk({ success: true, isNew: true, review: REVIEW_ENABLED_NOTE, user: toClientUser(fresh as unknown as Record<string, unknown>), link_status: link.status, link });
  }

  const who = await verifyLiffUser(req);
  if (isAuthError(who)) return authError(who);

  // body ที่ไม่ใช่ JSON เคยทำให้ทั้ง route throw เป็น 500 ที่หน้าเว็บ parse ไม่ได้
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("BAD_REQUEST", { message: "ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาลองใหม่" });
  const { phone, displayName, firstName, lastName, company, birthday } = body as Record<string, string | null | undefined>;
  if (!phone || !firstName || !lastName || !birthday) {
    return apiError("BAD_REQUEST", { message: "กรอกข้อมูลไม่ครบ กรุณาใส่ชื่อ นามสกุล เบอร์มือถือ และวันเกิด" });
  }
  const tel = String(phone).replace(/\D/g, "");
  if (!/^0\d{9}$/.test(tel)) return apiError("INVALID_PHONE");

  try {
    await migrateDB();
    const result = await registerUser(who.userId, tel, displayName ?? undefined, firstName, lastName, company ?? undefined, birthday);
    const user = await getUserByLineId(who.userId);
    // สมัครผ่านแล้วแต่อ่านกลับไม่เจอ = ผิดปกติ อย่าคืน success พร้อม user:null (หน้าเว็บจะเรนเดอร์บัตรเปล่า)
    if (!user) return apiError("SERVER_ERROR", { message: "บันทึกข้อมูลแล้ว แต่โหลดบัตรสมาชิกไม่ได้ กรุณาเปิดหน้านี้ใหม่อีกครั้ง" });
    // เหมือนกับ GET: หน้าเว็บต้องรู้ตั้งแต่จอแรกหลังสมัครว่าแต้มยังไม่เข้าจนกว่าพนักงานจะผูกรหัสให้
    let link: ReturnType<typeof toClientLink> = null;
    try { link = toClientLink(await getLinkState(user)); } catch (e) { console.error("[api] POST /api/member → getLinkState ล้มเหลว:", e); }
    return apiOk({ success: true, isNew: result.isNew, user: toClientUser(user as unknown as Record<string, unknown>), link_status: link?.status ?? null, link });
  } catch (e) {
    // เบอร์ชนกับสมาชิกท่านอื่น / เบอร์ผูก LINE อื่นอยู่ — ข้อความเดิมจาก lib/points.ts พูดกับลูกค้าได้ตรงกว่า
    if (e instanceof RegisterError) return apiError("PHONE_TAKEN", { message: e.message });
    return dbError(e, "POST /api/member → registerUser");
  }
}
