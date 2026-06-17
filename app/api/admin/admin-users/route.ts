export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getAdminRole, hasRole } from "@/lib/admin-auth";

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

// GET — รายชื่อ admin ทั้งหมด (super เท่านั้น)
export async function GET(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "super")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureTable();
    const rows = await sql`SELECT id, username, role, active, created_at FROM admin_users ORDER BY id ASC`;
    return NextResponse.json({ users: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — สร้าง admin ใหม่ (super เท่านั้น)
export async function POST(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "super")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureTable();
    const { username, password, adminRole } = await req.json();
    if (!username || !password || !adminRole) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    if (!["staff", "viewer"].includes(adminRole)) return NextResponse.json({ error: "role ไม่ถูกต้อง" }, { status: 400 });
    if (username === "admin") return NextResponse.json({ error: "ชื่อนี้ถูกจองไว้แล้ว" }, { status: 400 });

    await sql`INSERT INTO admin_users (username, password, role) VALUES (${username}, ${password}, ${adminRole})`;
    return NextResponse.json({ success: true });
  } catch (e) {
    if (String(e).includes("unique")) return NextResponse.json({ error: "ชื่อผู้ใช้นี้มีแล้ว" }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH — แก้ไข role หรือ password (super เท่านั้น)
export async function PATCH(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "super")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, adminRole, password, active } = await req.json();
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    if (adminRole !== undefined) {
      await sql`UPDATE admin_users SET role = ${adminRole} WHERE id = ${id}`;
    }
    if (password) {
      await sql`UPDATE admin_users SET password = ${password} WHERE id = ${id}`;
    }
    if (active !== undefined) {
      await sql`UPDATE admin_users SET active = ${active} WHERE id = ${id}`;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE — ลบ admin (super เท่านั้น)
export async function DELETE(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "super")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await req.json();
    await sql`DELETE FROM admin_users WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
