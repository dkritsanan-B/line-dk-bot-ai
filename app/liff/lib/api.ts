// ตัวเรียก API ของหน้าสมาชิก LINE — แยก "ระบบล่ม" ออกจาก "ยังไม่สมัคร" ให้ขาด (16 ก.ย. 69)
//
// บั๊กเดิม: หน้าเว็บอ่าน data.registered ตรง ๆ โดยไม่ดู res.ok
//   API ล่ม → ได้ { ok:false, code, error } → registered เป็น undefined → สมาชิกเก่าถูกพาไปจอสมัครใหม่
// กติกา (ตรงกับ app/api/_lib/api-error.ts):
//   res.ok + registered:false + code:"NOT_REGISTERED" = ยังไม่สมัคร  ← กรณีเดียวที่ขึ้นจอสมัครได้
//   AUTH_REQUIRED                                      = ต้องปิดแล้วเปิดหน้านี้จาก LINE ใหม่
//   อย่างอื่นที่ไม่ ok (DB/LINE/SERVER/ตอบไม่ใช่ JSON)    = ระบบขัดข้องชั่วคราว
//   fetch โยน error เอง                                 = เน็ตหลุด
//   ok แต่รูปแบบไม่ครบ                                  = ถือเป็นระบบขัดข้อง (ห้ามเดาว่าว่าง)

export type ProblemKind = "auth" | "system" | "offline";

export interface Problem {
  kind: ProblemKind;
  code: string;
  /** ข้อความจากเซิร์ฟเวอร์ (ถ้ามี) — ใช้ประกอบเท่านั้น หัวข้อหลักหน้าเว็บเขียนเอง */
  serverMessage: string | null;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; problem: Problem };

export const SHOP_PHONE = "075-845177";
export const SHOP_TEL = "tel:075845177";
/** ลิงก์เปิดหน้าสมาชิกในแอป LINE — ค่าเดียวกับ SHOP.liffUrl ใน lib/line-ui.ts และ scripts/setup-rich-menu.mjs */
export const SHOP_LIFF_URL = process.env.NEXT_PUBLIC_LIFF_ID
  ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
  : "https://liff.line.me/2010392141-TXmVNdGl";

export function problemOf(code: string | undefined, serverMessage?: string | null): Problem {
  const c = code ?? "SERVER_ERROR";
  return {
    kind: c === "AUTH_REQUIRED" ? "auth" : c === "OFFLINE" ? "offline" : "system",
    code: c,
    serverMessage: serverMessage ?? null,
  };
}

/** ยิง API แล้วคืนผลที่แยกสถานะชัดเจน — ไม่ throw */
export async function callApi<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    return { ok: false, problem: problemOf("OFFLINE") };
  }
  let data: Record<string, unknown> | null = null;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = null;
  }
  if (!res.ok || !data || typeof data !== "object" || data.ok === false) {
    const code = typeof data?.code === "string" ? (data.code as string) : res.status === 401 ? "AUTH_REQUIRED" : "SERVER_ERROR";
    const msg = typeof data?.error === "string" ? (data.error as string) : null;
    return { ok: false, problem: problemOf(code, msg) };
  }
  return { ok: true, data: data as T };
}

/** ข้อความภาษาคนตอนกดแลกของแล้วไม่ผ่าน — ข้อความจากเซิร์ฟเวอร์ของกลุ่มนี้พูดกับลูกค้าได้ตรงกว่า ใช้ก่อนเสมอ */
export function redeemErrorText(problem: Problem): string {
  switch (problem.code) {
    case "NOT_ENOUGH_POINTS":   return problem.serverMessage ?? "แต้มที่ใช้ได้ไม่พอสำหรับของชิ้นนี้ค่ะ";
    case "REWARD_OUT_OF_STOCK": return problem.serverMessage ?? "ของชิ้นนี้หมดหรือถูกจองครบแล้วค่ะ รอรอบของเข้าถัดไปนะคะ";
    case "DUPLICATE_REQUEST":   return problem.serverMessage ?? "คุณมีคำขอแลกของชิ้นนี้รออยู่แล้วค่ะ";
    case "REWARD_NOT_FOUND":    return "ของชิ้นนี้เพิ่งปิดรับแลกค่ะ ลองเลือกชิ้นอื่นนะคะ";
    case "RACE_LOST":           return "มีคำขออื่นตัดหน้าไปพอดีค่ะ ยังไม่ได้ทำรายการให้ กดแลกใหม่อีกครั้งได้เลย";
    case "NOT_REGISTERED":      return "ยังไม่ได้สมัครสมาชิกค่ะ สมัครที่หน้าบัตรสมาชิกก่อนนะคะ";
    case "AUTH_REQUIRED":       return "หมดเวลาใช้งาน กรุณาปิดหน้านี้แล้วเปิดใหม่จาก LINE ค่ะ";
    case "OFFLINE":             return "ส่งคำขอไม่ได้ อินเทอร์เน็ตอาจหลุด เช็คสัญญาณแล้วกดใหม่อีกครั้งค่ะ";
    case "BAD_REQUEST":         return "ส่งคำขอไม่สำเร็จ กรุณากดใหม่อีกครั้งค่ะ";
    default:                    return `ระบบขัดข้องชั่วคราว ยังไม่ได้ทำรายการให้ แต้มของคุณไม่หาย กดใหม่อีกครั้ง หรือโทร ${SHOP_PHONE}`;
  }
}
