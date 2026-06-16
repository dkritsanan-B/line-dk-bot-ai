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
      points_required INT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS description     TEXT`;
  await sql`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS image_url       TEXT`;
  await sql`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS stock           INT`;
  await sql`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS active          BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS sort_order      INT`;
  await sql`UPDATE rewards SET sort_order = id WHERE sort_order IS NULL`;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureTable();
    const rows = await sql`SELECT * FROM rewards ORDER BY sort_order ASC NULLS LAST, id ASC`;
    return NextResponse.json({ rewards: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureTable();
    const { name, description, points_required, image_url, stock } = await req.json();
    if (!name || !points_required) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    const rows = await sql`
      INSERT INTO rewards (name, description, points_required, image_url, stock, active)
      VALUES (${name}, ${description ?? null}, ${points_required}, ${image_url ?? null}, ${stock ?? null}, TRUE)
      RETURNING *
    `;
    return NextResponse.json({ reward: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureTable();
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
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { order } = await req.json() as { order: { id: number; sort_order: number }[] };
    for (const item of order) {
      await sql`UPDATE rewards SET sort_order = ${item.sort_order} WHERE id = ${item.id}`;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await sql`DELETE FROM rewards WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
