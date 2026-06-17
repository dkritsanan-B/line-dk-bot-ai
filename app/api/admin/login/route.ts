export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { AdminRole } from "@/lib/admin-auth";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS admin_users (
      id         SERIAL PRIMARY KEY,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'viewer',
      active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) return NextResponse.json({ error: "missing fields" }, { status: 400 });

    await ensureTable();

    // super admin จาก env var
    if ((username === "admin" || username === "") && password === process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ role: "super" as AdminRole, username: "admin" });
    }

    const rows = await sql`
      SELECT role FROM admin_users
      WHERE username = ${username} AND password = ${password} AND active = TRUE
      LIMIT 1
    `;
    if (rows.length > 0) {
      return NextResponse.json({ role: rows[0].role as AdminRole, username });
    }

    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
