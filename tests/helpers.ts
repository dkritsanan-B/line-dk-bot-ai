// ตัวช่วยเทสต์ฝั่ง TypeScript — ปลอม sql tag ไม่ต่อฐานข้อมูลจริง
// เครื่องนี้ไม่มี DATABASE_URL โดยตั้งใจ (ฐานจริงมีลูกค้าใช้อยู่) ทุกอย่างในนี้จึงเป็นของปลอมล้วน
//
// เทสต์ที่รันผ่าน tests/run.mjs ใช้ของปลอมชุด tests/mocks/ แทน (สลับทั้งโมดูลตั้งแต่ตอน import)
// ไฟล์นี้มีไว้ให้เทสต์ที่อยากฉีด sql เข้าไปเป็นพารามิเตอร์ตรง ๆ เช่น getExpiringSummary(id, pts, db)

export type Rows = Record<string, unknown>[];
/** handler ได้ข้อความคิวรีทั้งก้อน (ช่องว่างยุบแล้ว ค่าที่ผูกแทนด้วย ?) + ค่าที่ผูกเข้ามา — จะคืนแถวหรือ throw ก็ได้ */
export type SqlHandler = (query: string, values: unknown[]) => Rows | Promise<Rows>;

export interface FakeSql {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Rows>;
  /** ทุกคิวรีที่โค้ดจริงยิงออกมา ตามลำดับ */
  calls: { query: string; values: unknown[] }[];
}

export function makeSql(handler: SqlHandler): FakeSql {
  const calls: { query: string; values: unknown[] }[] = [];
  const fn = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<Rows> => {
    const query = strings.join(" ? ").replace(/\s+/g, " ").trim();
    calls.push({ query, values });
    return await handler(query, values);
  };
  (fn as FakeSql).calls = calls;
  return fn as FakeSql;
}

/** อาการที่ neon โยนจริงเวลาต่อฐานข้อมูลไม่ติด */
export const dbDownError = () => Object.assign(new Error("fetch failed"), { name: "TypeError" });
/** อาการคิวรีพัง (ไม่ใช่ปัญหาการเชื่อมต่อ) */
export const sqlSyntaxError = () => new Error('relation "rewards" does not exist');

/** อ่าน body ของ NextResponse — โยน error ที่อ่านรู้เรื่องถ้ามันไม่ใช่ JSON (หน้าเว็บก็ parse ไม่ได้เหมือนกัน) */
export async function readBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`คำตอบไม่ใช่ JSON (หน้าเว็บ parse ไม่ได้): status=${res.status} body=${text.slice(0, 200)}`);
  }
}
