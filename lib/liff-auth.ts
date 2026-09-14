// ยืนยันตัวตนสมาชิกจาก LIFF ฝั่งเซิร์ฟเวอร์ — เดิม API รับ lineUserId จาก client ตรง ๆ ใครรู้ U-id คนอื่นก็ดูแต้ม/กดแลกของแทนได้
// ตอนนี้ client ส่ง LIFF access token มาใน Authorization: Bearer … → เซิร์ฟเวอร์ถาม LINE เองว่า token นี้เป็นของใคร
// ใช้ access token (scope profile) ไม่ใช้ id token เพราะ id token ต้องเปิด scope openid ใน LIFF console ถ้าลืมเปิดสมาชิกจะใช้ไม่ได้ทั้งร้าน
import { NextRequest } from "next/server";

// channel id ของ LINE Login ที่ LIFF app สังกัด — LIFF ID มีรูปแบบ "<channelId>-<suffix>"
const CHANNEL_ID = (process.env.LINE_LOGIN_CHANNEL_ID || (process.env.NEXT_PUBLIC_LIFF_ID ?? "").split("-")[0] || "").trim();

export async function verifyLiffUser(req: NextRequest): Promise<{ userId: string } | { error: string; status: number }> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { error: "กรุณาเปิดผ่าน LINE (ไม่มี token)", status: 401 };
  try {
    // 1) token นี้ออกให้ channel ของเราจริงไหม (กัน token จากแอปอื่น)
    const v = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!v.ok) return { error: "token หมดอายุ กรุณาเปิดหน้านี้ใหม่", status: 401 };
    const vj = (await v.json()) as { client_id?: string; expires_in?: number };
    if (CHANNEL_ID && String(vj.client_id) !== CHANNEL_ID) return { error: "token ไม่ใช่ของแอปนี้", status: 401 };
    // 2) เจ้าของ token คือใคร
    const p = await fetch("https://api.line.me/v2/profile", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!p.ok) return { error: "อ่านโปรไฟล์ไม่ได้", status: 401 };
    const pj = (await p.json()) as { userId?: string };
    if (!pj.userId) return { error: "ไม่พบ userId", status: 401 };
    return { userId: pj.userId };
  } catch {
    return { error: "ติดต่อ LINE ไม่ได้ ลองใหม่อีกครั้ง", status: 503 };
  }
}

export function isAuthError(r: { userId: string } | { error: string; status: number }): r is { error: string; status: number } {
  return "error" in r;
}
