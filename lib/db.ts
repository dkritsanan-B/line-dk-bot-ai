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

type Row = Record<string, unknown>;
type Tag = (s: TemplateStringsArray, ...v: unknown[]) => Promise<Row[]>;

const tag = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  (getClient() as unknown as Tag)(strings, ...values)) as unknown as NeonQueryFunction<false, false>;

// ใช้เหมือนเดิมทุกที่: sql`SELECT ...` · และมี sql.query(text, params) / sql.transaction([...]) ตามของ neon
Object.defineProperties(tag, {
  query: { value: (text: string, params?: unknown[]) => getClient().query(text, params as unknown[]) },
  transaction: { value: (...args: Parameters<NeonQueryFunction<false, false>["transaction"]>) => getClient().transaction(...args) },
  unsafe: { value: (raw: string) => getClient().unsafe(raw) },
});

export const sql = tag;

/** อินเทอร์เฟซเล็ก ๆ ที่โค้ดเรื่องเงิน/แต้มใช้ — สลับเป็น Postgres ในเครื่องตอนเทสต์ได้ (tests/pg.mjs) */
export interface Db {
  query(text: string, params?: unknown[]): Promise<Row[]>;
  /** หลายคำสั่งใน transaction เดียว (ไม่โต้ตอบ) — คืนผลของแต่ละคำสั่งตามลำดับ */
  tx(stmts: { text: string; params?: unknown[] }[]): Promise<Row[][]>;
}

export const db: Db = {
  query: async (text, params = []) => (await getClient().query(text, params)) as Row[],
  tx: async (stmts) => {
    const c = getClient();
    return (await c.transaction(stmts.map(s => c.query(s.text, s.params ?? [])))) as Row[][];
  },
};
