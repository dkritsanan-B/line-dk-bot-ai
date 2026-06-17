export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";

export type AdminRole = "super" | "staff" | "viewer";

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

export async function getAdminRole(req: NextRequest): Promise<AdminRole | null> {
  const username = req.headers.get("x-admin-username") ?? "";
  const password = req.headers.get("x-admin-password") ?? "";
  if (!password) return null;

  // Legacy / super admin via env var (backward compat)
  if (!username || username === "admin") {
    if (password === process.env.ADMIN_PASSWORD) return "super";
    if (!username) return null;
  }

  try {
    await ensureTable();
    const rows = await sql`
      SELECT role FROM admin_users
      WHERE username = ${username} AND password = ${password} AND active = TRUE
      LIMIT 1
    `;
    if (rows.length > 0) return rows[0].role as AdminRole;
  } catch { /* table may not exist yet */ }

  return null;
}

// ตรวจว่า role มีสิทธิ์ระดับที่ต้องการไหม
export function hasRole(role: AdminRole | null, required: AdminRole): boolean {
  if (!role) return false;
  const levels: Record<AdminRole, number> = { viewer: 1, staff: 2, super: 3 };
  return levels[role] >= levels[required];
}
