// ฐานข้อมูลปลอมในหน่วยความจำ สำหรับเทสต์ระบบแลกของรางวัล
//
// ทำไมต้องมี: เครื่องนี้ไม่มี DATABASE_URL และฐานข้อมูลจริงมีลูกค้าใช้อยู่ ห้ามต่อเด็ดขาด
// ตัวนี้เลียนแบบพฤติกรรมของ Postgres เท่าที่โค้ดเราพึ่งพาจริง ๆ:
//   - คำสั่ง 1 คำสั่ง = 1 transaction (อ่าน+เขียนในคำสั่งเดียวจึงแทรกกลางไม่ได้)
//   - UPDATE … WHERE … RETURNING คืน 0 แถว ถ้าเงื่อนไขไม่ผ่าน
//   - INSERT … SELECT … WHERE คืน 0 แถว ถ้าเงื่อนไขไม่ผ่าน
// ทุก handler จับคู่ด้วยข้อความคิวรีจริง ถ้าคิวรีในโค้ดเปลี่ยนรูปจนจับไม่ได้ เทสต์จะพังทันที (ตั้งใจ)
// ไม่ใช่ Postgres จริง — พิสูจน์ "ตรรกะการตัดสิน" ได้ แต่ไม่ได้พิสูจน์ว่า SQL รันบน Neon แล้วถูก 100%

export interface FakeUser { id: number; line_user_id: string; points: number; first_name?: string | null; last_name?: string | null; display_name?: string | null; phone?: string | null }
export interface FakeReward { id: number; name: string; points_required: number; stock: number | null; active?: boolean }
export interface FakeRequest { id: number; user_id: number; reward_id: number; points_required: number; status: string; confirmed_at: string | null }
export interface FakeTx { user_id: number; purchase_amount: number; points_earned: number; type: string; note: string }

export interface FakeDb {
  users: FakeUser[];
  rewards: FakeReward[];
  requests: FakeRequest[];
  transactions: FakeTx[];
  nextId: number;
  /** ให้เทสต์แทรกเหตุการณ์ "ใบอื่นยิงเข้ามาพอดี" ก่อนคิวรีที่ระบุจะทำงาน */
  hooks?: { beforeQuery?: (text: string, values: unknown[], db: FakeDb) => void };
  /** เก็บคิวรีทั้งหมดที่ถูกยิง ไว้ตรวจว่ามีด่านครบ */
  log: { text: string; values: unknown[] }[];
}

export function makeDb(seed: Partial<FakeDb> & { users: FakeUser[]; rewards: FakeReward[] }): FakeDb {
  return {
    users: seed.users,
    rewards: seed.rewards.map(r => ({ active: true, ...r })),
    requests: seed.requests ?? [],
    transactions: seed.transactions ?? [],
    nextId: seed.nextId ?? 1,
    hooks: seed.hooks,
    log: [],
  };
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const pending = (db: FakeDb) => db.requests.filter(r => r.status === "pending");

export class FakeSqlError extends Error {
  code: string;
  constructor(message: string, code: string) { super(message); this.code = code; }
}

/** สร้าง sql tag ปลอม ใช้แทน lib/db ได้ตรง ๆ */
export function makeSql(db: FakeDb) {
  return async function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]> {
    const text = norm(strings.join(" ? "));
    db.log.push({ text, values });
    db.hooks?.beforeQuery?.(text, values, db);
    const num = (v: unknown) => Number(v);

    // ---- schema
    if (/^CREATE TABLE IF NOT EXISTS redemption_requests/.test(text)) return [];
    if (/^CREATE UNIQUE INDEX/.test(text)) {
      const seen = new Set<string>();
      for (const r of pending(db)) {
        const k = `${r.user_id}:${r.reward_id}`;
        if (seen.has(k)) throw new FakeSqlError("could not create unique index (duplicate key value)", "23505");
        seen.add(k);
      }
      return [];
    }

    // ---- อ่านสมาชิก
    if (/^SELECT id, points, first_name.*FROM users WHERE line_user_id/.test(text)) {
      const u = db.users.find(x => x.line_user_id === values[0]);
      return u ? [{ ...u }] : [];
    }
    if (/^SELECT id, points(, customer_id)? FROM users WHERE line_user_id/.test(text)) {
      const u = db.users.find(x => x.line_user_id === values[0]);
      return u ? [{ id: u.id, points: u.points, customer_id: (u as { customer_id?: string | null }).customer_id ?? null }] : [];
    }

    // ---- อ่านของรางวัล
    if (/^SELECT id, name, points_required, stock FROM rewards WHERE id = \? AND active = TRUE/.test(text)) {
      const r = db.rewards.find(x => x.id === num(values[0]) && x.active !== false);
      return r ? [{ id: r.id, name: r.name, points_required: r.points_required, stock: r.stock }] : [];
    }

    // ---- ตัวเลขที่ใช้ตัดสิน (แต้มที่จองไว้ / ใบซ้ำ / ของที่ถูกจอง)
    if (/AS pending_points/.test(text)) {
      const [v0, v1, v2, v3, v4, v5] = values.map(num);
      if (v0 !== v1 || v0 !== v4 || v2 !== v3 || v2 !== v5) {
        throw new Error("คิวรีนับแต้มจองเปลี่ยนลำดับพารามิเตอร์ — แก้ tests/fake-sql.ts ให้ตรงก่อน");
      }
      const userId = v0, rewardId = v2;
      const p = pending(db);
      return [{
        pending_points: p.filter(r => r.user_id === userId).reduce((s, r) => s + r.points_required, 0),
        same_pending: p.filter(r => r.user_id === userId && r.reward_id === rewardId).length,
        reward_pending: p.filter(r => r.reward_id === rewardId).length,
      }];
    }

    // ---- สร้างคำขอ (คำสั่งเดียว อ่าน+เขียนพร้อมกัน)
    if (/^INSERT INTO redemption_requests \(user_id, reward_id, points_required\) SELECT/.test(text)) {
      const rewardId = num(values[0]);
      const userId = num(values[1]);
      // ด่านที่ SQL จริงบังคับ — ต้องมีครบทั้งสาม ไม่งั้นถือว่าโค้ดถอยหลัง
      if (!/NOT EXISTS/.test(text)) throw new Error("INSERT ขาดด่านกันคำขอซ้ำ");
      if (!/rw\.stock IS NULL OR rw\.stock >/.test(text)) throw new Error("INSERT ขาดด่านเช็คของคงเหลือ");
      if (!/u\.points - COALESCE/.test(text)) throw new Error("INSERT ขาดด่านหักแต้มที่จองไว้");

      const u = db.users.find(x => x.id === userId);
      const rw = db.rewards.find(x => x.id === rewardId && x.active !== false);
      if (!u || !rw) return [];
      const p = pending(db);
      const dup = p.some(r => r.user_id === userId && r.reward_id === rewardId);
      const reserved = p.filter(r => r.reward_id === rewardId).length;
      const heldPoints = p.filter(r => r.user_id === userId).reduce((s, r) => s + r.points_required, 0);
      if (dup) return [];
      if (rw.stock !== null && !(rw.stock > reserved)) return [];
      if (u.points - heldPoints < rw.points_required) return [];
      const row: FakeRequest = {
        id: db.nextId++, user_id: userId, reward_id: rewardId,
        points_required: rw.points_required, status: "pending", confirmed_at: null,
      };
      db.requests.push(row);
      return [{ id: row.id, points_required: row.points_required }];
    }

    // ---- ตรวจซ้ำหลังเขียน (ใครลำดับเกินโควตาต้องถอย)
    if (/AS points_upto/.test(text)) {
      const [r0, r1, rewardIdV, userIdV] = values.map(num);
      if (r0 !== r1) throw new Error("คิวรีตรวจซ้ำเปลี่ยนลำดับพารามิเตอร์ — แก้ tests/fake-sql.ts ให้ตรงก่อน");
      const requestId = r0;
      const u = db.users.find(x => x.id === userIdV);
      const rw = db.rewards.find(x => x.id === rewardIdV);
      if (!u || !rw) return [];
      const p = pending(db);
      return [{
        points: u.points,
        stock: rw.stock,
        points_upto: p.filter(r => r.user_id === u.id && r.id <= requestId).reduce((s, r) => s + r.points_required, 0),
        stock_upto: p.filter(r => r.reward_id === rw.id && r.id <= requestId).length,
      }];
    }

    if (/^DELETE FROM redemption_requests WHERE id = \? AND status = 'pending'/.test(text)) {
      const id = num(values[0]);
      const i = db.requests.findIndex(r => r.id === id && r.status === "pending");
      if (i >= 0) { db.requests.splice(i, 1); return [{ id }]; }
      return [];
    }

    // ---- รายการคำขอที่ยังค้างของสมาชิก
    if (/^SELECT r\.id, r\.reward_id, r\.points_required, r\.created_at/.test(text)) {
      const userId = num(values[0]);
      return pending(db).filter(r => r.user_id === userId).sort((a, b) => a.id - b.id).map(r => ({
        id: r.id, reward_id: r.reward_id, points_required: r.points_required,
        created_at: "2026-09-16T00:00:00Z",
        reward_name: db.rewards.find(x => x.id === r.reward_id)?.name ?? null,
      }));
    }

    if (/^SELECT reward_id, \(COUNT\(\*\)\)::int AS reserved/.test(text)) {
      const by = new Map<number, number>();
      for (const r of pending(db)) by.set(r.reward_id, (by.get(r.reward_id) ?? 0) + 1);
      return [...by.entries()].map(([reward_id, reserved]) => ({ reward_id, reserved }));
    }

    // ---- ฝั่งแอดมิน
    if (/^SELECT r\.id, r\.user_id, r\.reward_id, r\.points_required/.test(text)) {
      const id = num(values[0]);
      const r = db.requests.find(x => x.id === id && x.status === "pending");
      if (!r) return [];
      const u = db.users.find(x => x.id === r.user_id);
      const rw = db.rewards.find(x => x.id === r.reward_id);
      if (!u || !rw) return [];
      return [{
        id: r.id, user_id: r.user_id, reward_id: r.reward_id, points_required: r.points_required,
        line_user_id: u.line_user_id, points: u.points, reward_name: rw.name, stock: rw.stock,
      }];
    }
    if (/^UPDATE redemption_requests SET status = 'confirmed'/.test(text)) {
      const id = num(values[0]);
      const r = db.requests.find(x => x.id === id && x.status === "pending");
      if (!r) return [];
      r.status = "confirmed"; r.confirmed_at = "2026-09-16T00:00:00Z";
      return [{ id }];
    }
    if (/^UPDATE redemption_requests SET status = 'cancelled'/.test(text)) {
      const id = num(values[0]);
      const r = db.requests.find(x => x.id === id && x.status === "pending");
      if (!r) return [];
      r.status = "cancelled";
      return [{ id }];
    }
    if (/^UPDATE redemption_requests SET status = 'pending', confirmed_at = NULL/.test(text)) {
      const id = num(values[0]);
      const r = db.requests.find(x => x.id === id);
      if (!r) return [];
      r.status = "pending"; r.confirmed_at = null;
      return [{ id }];
    }
    if (/^UPDATE rewards SET stock = stock - 1 WHERE id = \? AND stock > 0/.test(text)) {
      const rw = db.rewards.find(x => x.id === num(values[0]));
      if (!rw || rw.stock === null || !(rw.stock > 0)) return [];
      rw.stock -= 1;
      return [{ stock: rw.stock }];
    }
    if (/^UPDATE rewards SET stock = stock \+ 1/.test(text)) {
      const rw = db.rewards.find(x => x.id === num(values[0]));
      if (!rw || rw.stock === null) return [];
      rw.stock += 1;
      return [{ stock: rw.stock }];
    }
    if (/^UPDATE users SET points = points - \? WHERE id = \? AND points >= \?/.test(text)) {
      const cost = num(values[0]), userId = num(values[1]), need = num(values[2]);
      if (cost !== need) throw new Error("คิวรีหักแต้มใช้ค่าไม่ตรงกันระหว่างจำนวนที่หักกับจำนวนที่เช็ค");
      const u = db.users.find(x => x.id === userId);
      if (!u || u.points < need) return [];
      u.points -= cost;
      return [{ points: u.points }];
    }
    // VALUES (${user_id}, 0, ${points_required}, 'redeem', ${note}) — เลข 0 กับ 'redeem' เขียนตรงใน SQL ไม่ใช่พารามิเตอร์
    if (/^INSERT INTO transactions/.test(text)) {
      db.transactions.push({
        user_id: num(values[0]), purchase_amount: 0,
        points_earned: num(values[1]), type: "redeem", note: String(values[2] ?? ""),
      });
      return [];
    }

    throw new Error("คิวรีที่เทสต์ยังไม่รู้จัก: " + text.slice(0, 160));
  };
}
