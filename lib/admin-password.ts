// รหัสผ่านบัญชีแอดมิน — เก็บแบบเข้ารหัสทางเดียว (scrypt) ไม่เก็บตัวรหัสจริงอีกต่อไป (17 ก.ย. 69)
//
// เดิมตาราง admin_users เก็บรหัสเป็นข้อความตรง ๆ ใครเห็นฐานข้อมูล (หรือไฟล์ backup/log คิวรี) ก็ได้รหัสพนักงานทุกคน
// รูปแบบที่เก็บ: scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>
// แถวเก่าที่ยังเป็นข้อความตรง ๆ ใช้ล็อกอินได้ตามเดิม แล้วถูกแปลงเป็นแบบเข้ารหัสทันทีหลังล็อกอินสำเร็จ (ดู lib/admin-auth.ts)
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash, type ScryptOptions } from "node:crypto";

const N = 16384, R = 8, P = 1, KEYLEN = 32;
export const MIN_ADMIN_PASSWORD = 6;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(password, salt, keylen, opts, (e, key) => (e ? reject(e) : resolve(key))));
}

export function isHashed(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith("scrypt$");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** เทียบแบบใช้เวลาคงที่ — กันการเดารหัสจากเวลาตอบกลับ */
export function safeEqual(a: string, b: string): boolean {
  // ทำให้ยาวเท่ากันก่อนเทียบ (timingSafeEqual ต้องการความยาวเท่ากัน) โดยไม่เผยความยาวจริง
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

/** ตรวจรหัส: รองรับทั้งแบบเข้ารหัสแล้ว และแถวเก่าที่ยังเป็นข้อความตรง ๆ */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!password || !stored) return false;
  if (!isHashed(stored)) return safeEqual(password, stored);
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  if (!expected.length) return false;
  try {
    const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
