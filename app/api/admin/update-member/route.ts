export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { migrateDB } from "@/lib/points";

export async function PATCH(req: NextRequest) {
  const auth = req.headers.get("x-admin-password");
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, customer_id } = await req.json();
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  await migrateDB();
  await sql`UPDATE users SET customer_id = ${customer_id ?? null} WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
