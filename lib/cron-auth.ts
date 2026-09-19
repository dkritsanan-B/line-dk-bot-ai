// ตรวจสิทธิ์ cron ของ Vercel (ส่ง Authorization: Bearer <CRON_SECRET>)
// เดิมเทียบ header กับ `Bearer ${process.env.CRON_SECRET}` ตรง ๆ — ถ้า env ไม่ได้ตั้ง จะกลายเป็น "Bearer undefined" ที่ใครก็ยิงได้
// ตอนนี้: ไม่มี secret หรือสั้นเกิน = ปิดตาย · เทียบแบบ timing-safe
import { timingSafeEqual } from "node:crypto";

export const MIN_CRON_SECRET = 16;

export function isCronAuthorized(header: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || secret.length < MIN_CRON_SECRET) return false;
  const got = (header ?? "").startsWith("Bearer ") ? (header as string).slice(7) : "";
  const a = Buffer.from(got), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
