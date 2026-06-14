export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { migrateDB } from "@/lib/points";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("x-admin-password");
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await migrateDB();

  const search = req.nextUrl.searchParams.get("search") ?? "";
  const rows = search
    ? await sql`
        SELECT id, customer_id, first_name, last_name, phone, company, birthday, points, created_at
        FROM users
        WHERE first_name  ILIKE ${"%" + search + "%"}
           OR last_name   ILIKE ${"%" + search + "%"}
           OR phone       ILIKE ${"%" + search + "%"}
           OR company     ILIKE ${"%" + search + "%"}
           OR customer_id ILIKE ${"%" + search + "%"}
        ORDER BY created_at DESC
      `
    : await sql`
        SELECT id, customer_id, first_name, last_name, phone, company, birthday, points, created_at
        FROM users
        ORDER BY created_at DESC
      `;

  return NextResponse.json({ users: rows });
}
