import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// ต่อฐานข้อมูลตอนใช้จริง ไม่ใช่ตอน import — เดิม neon() ถูกเรียกตอนโหลดโมดูล ทำให้ทั้ง route พังตั้งแต่ยังไม่ทำงาน
// ถ้าเครื่องนั้นไม่มี DATABASE_URL (เช่น เครื่อง dev ที่ใช้แค่โหมดรีวิว) · ตอนนี้จะพังเฉพาะเมื่อมีคนสั่งคิวรีจริงเท่านั้น
let client: NeonQueryFunction<false, false> | null = null;

function getClient(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("ยังไม่ได้ตั้ง DATABASE_URL — ต่อฐานข้อมูลไม่ได้");
    client = neon(url);
  }
  return client;
}

// ใช้เหมือนเดิมทุกที่: sql`SELECT ...`
export const sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  (getClient() as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<Record<string, unknown>[]>)(strings, ...values)) as unknown as NeonQueryFunction<false, false>;
