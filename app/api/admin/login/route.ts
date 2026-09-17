export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";

// ล็อกอินหน้าแอดมิน — ใช้ตัวตรวจตัวเดียวกับทุก API แอดมิน (lib/admin-auth.ts) รหัสเก็บแบบเข้ารหัส
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { username?: string; password?: string } | null;
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  if (!password) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  const role = await verifyAdmin(username, password);
  if (!role) return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  return NextResponse.json({ role, username: username || "admin" });
}
