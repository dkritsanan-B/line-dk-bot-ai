// ตัวปลอมของ lib/liff-auth.ts — ไม่ยิงไป LINE จริง
let next = { userId: "U_test_line_id" };
export function setUser(v) { next = v; }
export async function verifyLiffUser() { return next; }
export function isAuthError(r) { return "error" in r; }
