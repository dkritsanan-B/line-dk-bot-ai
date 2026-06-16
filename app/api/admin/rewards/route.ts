export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

function auth(req: NextRequest) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS rewards (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      description     TEXT,
      points_required INT NOT NULL,
      image_url       TEXT,
      stock           INT,
      active          BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureTable();
    const rows = await sql`SELECT * FROM rewards ORDER BY active DESC, points_required ASC`;
    return NextResponse.json({ rewards: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureTable();
  const { name, description, points_required, image_url, stock } = await req.json();
  if (!name || !points_required) return NextResponse.json({ error: "missing fields" }, { status: 400 });
  const rows = await sql`
    INSERT INTO rewards (name, description, points_required, image_url, stock)
    VALUES (${name}, ${description ?? null}, ${points_required}, ${image_url ?? null}, ${stock ?? null})
    RETURNING *
  `;
  return NextResponse.json({ reward: rows[0] });
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, name, description, points_required, image_url, stock, active } = await req.json();
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const rows = await sql`
    UPDATE rewards SET
      name            = ${name},
      description     = ${description ?? null},
      points_required = ${points_required},
      image_url       = ${image_url ?? null},
      stock           = ${stock ?? null},
      active          = ${active}
    WHERE id = ${id}
    RETURNING *
  `;
  return NextResponse.json({ reward: rows[0] });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await sql`DELETE FROM rewards WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
