// ตัวปลอมของ lib/db.ts — ดัก sql`...` ไว้ทั้งหมด ไม่ต่อฐานข้อมูลจริงแม้แต่ครั้งเดียว
// (เครื่องนี้ไม่มี DATABASE_URL และห้ามต่อฐานข้อมูลจริงเด็ดขาด — ฐานข้อมูลมีลูกค้าใช้งานอยู่)
export const calls = [];          // ทุกคิวรีที่โค้ดจริงยิงออกมา { text, values }
let handlers = [];

/** ตั้งคำตอบของคิวรีที่ "ข้อความตรงกับ match" — match เป็นสตริง (includes) หรือฟังก์ชันก็ได้ */
export function onQuery(match, rows) {
  handlers.push({ match, rows });
}

export function reset() {
  calls.length = 0;
  handlers = [];
}

/** คิวรีที่ยิงออกไปทั้งหมดที่มีข้อความนี้ */
export function queriesWith(text) {
  return calls.filter((c) => c.text.includes(text));
}

const norm = (s) => s.replace(/\s+/g, " ").trim();

export const sql = (strings, ...values) => {
  const text = norm(strings.raw.join(" ? "));
  calls.push({ text, values });
  for (const h of handlers) {
    const hit = typeof h.match === "function" ? h.match(text, values) : text.includes(h.match);
    if (!hit) continue;
    const rows = typeof h.rows === "function" ? h.rows(text, values) : h.rows;
    if (rows instanceof Error) return Promise.reject(rows);
    return Promise.resolve(rows);
  }
  return Promise.resolve([]);     // ค่าตั้งต้น: ไม่เจอแถวไหน
};
