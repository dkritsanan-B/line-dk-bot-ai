// Postgres จริงแบบรันในเครื่อง (PGlite) สำหรับพิสูจน์ SQL เรื่องแต้ม — ไม่ต่อฐานข้อมูลของร้านเด็ดขาด
// โครงตารางจำลองตามที่ระบบจริงใช้ (users / transactions ตาม lib/points.ts migrateDB)
import { PGlite } from "@electric-sql/pglite";

export async function freshDb() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY, line_user_id TEXT, phone TEXT, display_name TEXT,
      first_name TEXT, last_name TEXT, points INT NOT NULL DEFAULT 0, total_earned INT NOT NULL DEFAULT 0,
      customer_id TEXT, suggested_customer_id TEXT, last_purchase_at TIMESTAMPTZ,
      notified_inactive_11m BOOLEAN NOT NULL DEFAULT FALSE, company TEXT, birthday DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), backfill_from DATE, backfill_done_at TIMESTAMPTZ
    );
    CREATE TABLE transactions (
      id SERIAL PRIMARY KEY, user_id INT NOT NULL, purchase_amount NUMERIC NOT NULL DEFAULT 0,
      points_earned INT NOT NULL, type TEXT NOT NULL DEFAULT 'earn', note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ,
      expired BOOLEAN NOT NULL DEFAULT FALSE, notified_1m BOOLEAN NOT NULL DEFAULT FALSE,
      cleared BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE TABLE rewards (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, points_required INT NOT NULL,
      image_url TEXT, stock INT, active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE redemption_requests (
      id SERIAL PRIMARY KEY, user_id INT NOT NULL, reward_id INT NOT NULL, points_required INT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), confirmed_at TIMESTAMPTZ
    );
  `);
  const db = {
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    tx: async (stmts) => pg.transaction(async (t) => {
      const out = [];
      for (const s of stmts) out.push((await t.query(s.text, s.params ?? [])).rows);
      return out;
    }),
  };
  return { pg, db };
}
