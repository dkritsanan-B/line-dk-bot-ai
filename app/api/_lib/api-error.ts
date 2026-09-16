// รูปแบบ error กลางของ API ฝั่งสมาชิก (16 ก.ย. 69)
//
// ที่มา: หน้าเว็บ /liff ไม่เช็ค res.ok — มันอ่าน data.registered ตรง ๆ
// เวลา API ล่ม (throw ออกไปเป็นหน้า error ของ Next ที่ไม่ใช่ JSON หรือคืน {error} เฉย ๆ)
// data.registered จะเป็น undefined → หน้าเว็บตีความว่า "ยังไม่สมัคร" → สมาชิกเก่าโดนพาไปจอสมัครใหม่
//
// กติกาที่ตกลงกันฝั่งเซิร์ฟเวอร์:
//   1) ทุก response ที่ไม่สำเร็จ ต้องเป็น JSON รูปเดียวกันเสมอ: { ok:false, code, error }
//      - code  = ป้ายคงที่ (ภาษาอังกฤษ) ให้หน้าเว็บใช้ตัดสินใจว่าจะโชว์จออะไร
//      - error = ข้อความไทยสำหรับลูกค้า (ของเดิมมีอยู่แล้ว — คงไว้เพื่อไม่ให้หน้าเว็บเดิมพัง)
//   2) "ยังไม่สมัคร" เป็น response สำเร็จ (200) ที่มี registered:false + code:"NOT_REGISTERED" เท่านั้น
//      ห้ามมี response อื่นใดที่หน้าเว็บอาจตีความว่ายังไม่สมัครได้
//   3) ห้ามกลืน error แล้วคืนลิสต์ว่าง — ลูกค้าต้องไม่เห็น "ไม่มีรายการ/ไม่มีของรางวัล" ตอนระบบล่ม
import { NextResponse } from "next/server";

export const API_ERROR_CODES = [
  "NOT_REGISTERED",      // LINE นี้ยังไม่เคยสมัคร (ใช้กับ 200 ของ /api/member และ 404 ของ redeem)
  "AUTH_REQUIRED",       // ไม่มี token / token หมดอายุ / token ไม่ใช่ของแอปนี้ → ต้องเปิดใหม่จาก LINE
  "LINE_UNAVAILABLE",    // เราติดต่อ LINE ไม่ได้ (ไม่ใช่ความผิดลูกค้า)
  "DB_UNAVAILABLE",      // ต่อฐานข้อมูลไม่ได้ / คิวรีล้ม
  "SERVER_ERROR",        // พังอย่างอื่นที่ยังไม่รู้สาเหตุ
  "BAD_REQUEST",         // ข้อมูลที่ส่งมาไม่ครบ/ไม่ใช่ JSON
  "INVALID_PHONE",       // เบอร์มือถือผิดรูปแบบ
  "PHONE_TAKEN",         // เบอร์นี้เป็นของสมาชิกท่านอื่น / ผูก LINE อื่นอยู่
  "REWARD_NOT_FOUND",    // ไม่พบของรางวัล (ถูกปิด/ลบไปแล้ว)
  "REWARD_OUT_OF_STOCK", // ของรางวัลหมดชั่วคราว
  "NOT_ENOUGH_POINTS",   // แต้มไม่พอ
  "DUPLICATE_REQUEST",   // มีคำขอแลกรางวัลนี้ค้างอยู่แล้ว
  "RACE_LOST",           // มีคำขออื่นยิงตัดหน้าไปพอดี (แต้ม/ของถูกจองไปก่อน) — กดใหม่ได้เลย
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

const STATUS: Record<ApiErrorCode, number> = {
  NOT_REGISTERED: 404,
  AUTH_REQUIRED: 401,
  LINE_UNAVAILABLE: 503,
  DB_UNAVAILABLE: 503,
  SERVER_ERROR: 500,
  BAD_REQUEST: 400,
  INVALID_PHONE: 400,
  PHONE_TAKEN: 409,
  REWARD_NOT_FOUND: 404,
  REWARD_OUT_OF_STOCK: 400,
  NOT_ENOUGH_POINTS: 400,
  DUPLICATE_REQUEST: 400,
  RACE_LOST: 409,
};

// ข้อความพูดกับลูกค้า (ช่างรับเหมา) — สั้น ตรง บอกว่าต้องทำอะไรต่อ ไม่โทษลูกค้า
const MESSAGE: Record<ApiErrorCode, string> = {
  NOT_REGISTERED: "ยังไม่ได้สมัครสมาชิก",
  AUTH_REQUIRED: "หมดเวลาใช้งาน กรุณาปิดหน้านี้แล้วเปิดใหม่จาก LINE",
  LINE_UNAVAILABLE: "ติดต่อ LINE ไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง",
  DB_UNAVAILABLE: "ระบบสมาชิกขัดข้องชั่วคราว แต้มของคุณยังอยู่ครบ กรุณาลองใหม่อีกครั้ง",
  SERVER_ERROR: "ระบบขัดข้องชั่วคราว แต้มของคุณยังอยู่ครบ กรุณาลองใหม่อีกครั้ง",
  BAD_REQUEST: "ข้อมูลที่ส่งมาไม่ครบ กรุณาลองใหม่",
  INVALID_PHONE: "เบอร์มือถือไม่ถูกต้อง (10 หลัก)",
  PHONE_TAKEN: "เบอร์นี้เป็นของสมาชิกท่านอื่นแล้ว กรุณาติดต่อพนักงานที่ร้านค่ะ",
  REWARD_NOT_FOUND: "ไม่พบของรางวัล",
  REWARD_OUT_OF_STOCK: "ของรางวัลหมดชั่วคราว",
  NOT_ENOUGH_POINTS: "แต้มไม่พอ",
  DUPLICATE_REQUEST: "คุณมีคำขอแลกรางวัลนี้รออยู่แล้ว",
  RACE_LOST: "มีคำขออื่นตัดหน้าไปพอดีค่ะ ยังไม่ได้ทำรายการให้ กรุณากดใหม่อีกครั้ง",
};

const NO_STORE = { "Cache-Control": "no-store" };

/** ตอบ error ตามมาตรฐาน — ข้อความ/สถานะ override ได้ เพื่อคงข้อความเดิมที่ลูกค้าคุ้นอยู่แล้ว */
export function apiError(
  code: ApiErrorCode,
  opts: { message?: string; status?: number; extra?: Record<string, unknown> } = {},
): NextResponse {
  return NextResponse.json(
    { ok: false, code, error: opts.message ?? MESSAGE[code], ...(opts.extra ?? {}) },
    { status: opts.status ?? STATUS[code], headers: NO_STORE },
  );
}

/** ตอบสำเร็จ — ใส่ no-store ให้เหมือนกันทุกเส้น กันเบราว์เซอร์/CDN แคชคำตอบช่วงระบบมีปัญหา */
export function apiOk(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** แยก "ต่อฐานข้อมูลไม่ได้" ออกจาก "พังเพราะอย่างอื่น" — ทั้งคู่แปลว่าระบบมีปัญหา แต่ code ต่างกันเพื่อให้ไล่ปัญหาได้ */
export function classifyThrown(e: unknown): ApiErrorCode {
  const msg = (e instanceof Error ? `${e.name} ${e.message}` : String(e)).toLowerCase();
  const connIssue =
    /database_url|econnrefused|enotfound|etimedout|eai_again|epipe|econnreset|timeout|timed out|fetch failed|failed to fetch|network|socket|connection|connect error|terminating connection|too many connections|server closed/.test(
      msg,
    );
  return connIssue ? "DB_UNAVAILABLE" : "SERVER_ERROR";
}

/** ใช้ใน catch รอบงานฐานข้อมูล — log ไว้ที่เซิร์ฟเวอร์เสมอ (ของเดิมกลืนเงียบจนไม่รู้ว่าล่ม) แล้วตอบแบบมี code */
export function dbError(e: unknown, where: string): NextResponse {
  console.error(`[api] ${where} ล้มเหลว:`, e);
  return apiError(classifyThrown(e));
}

/** แปลงผลตรวจ token ของ lib/liff-auth ให้เป็นรูปแบบมาตรฐาน (คงข้อความ + สถานะเดิมไว้ทุกตัว) */
export function authError(who: { error: string; status: number }): NextResponse {
  const code: ApiErrorCode = who.status === 503 ? "LINE_UNAVAILABLE" : "AUTH_REQUIRED";
  return apiError(code, { message: who.error, status: who.status });
}

/**
 * โหมดรีวิว: จำลองอาการล่มให้ฝั่งหน้าเว็บทดสอบจอแจ้งเตือนได้จริง โดยไม่ต้องรอระบบล่มจริง
 * (ดูสถานการณ์ fail_* ใน lib/review-mode.ts) — คืน null ถ้าสถานการณ์นั้นไม่ได้จำลองอาการล่ม
 */
export function reviewFaultResponse(fault?: string | null): NextResponse | null {
  const map: Record<string, ApiErrorCode> = {
    auth: "AUTH_REQUIRED",
    line: "LINE_UNAVAILABLE",
    db: "DB_UNAVAILABLE",
    server: "SERVER_ERROR",
  };
  const code = fault ? map[fault] : undefined;
  return code ? apiError(code, { extra: { review: true } }) : null;
}
