export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminRole, hasRole, ensureAdminTable, clearAdminAuthCache } from "@/lib/admin-auth";
import { hashPassword, MIN_ADMIN_PASSWORD } from "@/lib/admin-password";

// จัดการบัญชีแอดมิน (super เท่านั้น) · รหัสผ่านเก็บแบบเข้ารหัสเสมอ และไม่ส่งรหัส/ค่าแฮชออกไปทาง API
const ALLOWED_ROLES = ["staff", "viewer"];

async function guard(req: NextRequest) {
  const role = await getAdminRole(req);
  return hasRole(role, "super");
}

// GET — รายชื่อ admin ทั้งหมด
export async function GET(req: NextRequest) {
  if (!await guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureAdminTable();
    const rows = await db.query(`SELECT id, username, role, active, created_at FROM admin_users ORDER BY id ASC`);
    return NextResponse.json({ users: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — สร้าง admin ใหม่
export async function POST(req: NextRequest) {
  if (!await guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureAdminTable();
    const { username, password, adminRole } = await req.json();
    const name = String(username ?? "").trim();
    if (!name || !password || !adminRole) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    if (!ALLOWED_ROLES.includes(adminRole)) return NextResponse.json({ error: "role ไม่ถูกต้อง" }, { status: 400 });
    if (name === "admin") return NextResponse.json({ error: "ชื่อนี้ถูกจองไว้แล้ว" }, { status: 400 });
    if (String(password).length < MIN_ADMIN_PASSWORD) return NextResponse.json({ error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_ADMIN_PASSWORD} ตัว` }, { status: 400 });

    await db.query(`INSERT INTO admin_users (username, password, role) VALUES ($1, $2, $3)`, [name, await hashPassword(String(password)), adminRole]);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (String(e).toLowerCase().includes("unique")) return NextResponse.json({ error: "ชื่อผู้ใช้นี้มีแล้ว" }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH — แก้ไข role / password / active
export async function PATCH(req: NextRequest) {
  if (!await guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, adminRole, password, active } = await req.json();
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    if (adminRole !== undefined) {
      if (!ALLOWED_ROLES.includes(adminRole)) return NextResponse.json({ error: "role ไม่ถูกต้อง" }, { status: 400 });
      await db.query(`UPDATE admin_users SET role = $1 WHERE id = $2`, [adminRole, id]);
    }
    if (password) {
      if (String(password).length < MIN_ADMIN_PASSWORD) return NextResponse.json({ error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_ADMIN_PASSWORD} ตัว` }, { status: 400 });
      await db.query(`UPDATE admin_users SET password = $1 WHERE id = $2`, [await hashPassword(String(password)), id]);
    }
    if (active !== undefined) {
      await db.query(`UPDATE admin_users SET active = $1 WHERE id = $2`, [Boolean(active), id]);
    }
    clearAdminAuthCache();   // เปลี่ยนสิทธิ์/รหัส/ปิดบัญชี ต้องมีผลทันทีบนเครื่องนี้
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE — ลบ admin
export async function DELETE(req: NextRequest) {
  if (!await guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await req.json();
    await db.query(`DELETE FROM admin_users WHERE id = $1`, [id]);
    clearAdminAuthCache();
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
