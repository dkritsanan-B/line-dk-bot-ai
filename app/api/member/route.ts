export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getUserByLineId, registerUser, migrateDB } from "@/lib/points";

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId");
  if (!lineUserId) {
    return NextResponse.json({ error: "missing lineUserId" }, { status: 400 });
  }

  const user = await getUserByLineId(lineUserId);
  if (!user) return NextResponse.json({ registered: false });
  return NextResponse.json({ registered: true, user });
}

export async function POST(req: NextRequest) {
  const { lineUserId, phone, displayName, firstName, lastName, company, birthday } = await req.json();
  if (!lineUserId || !phone || !firstName || !lastName || !birthday) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  await migrateDB();
  const result = await registerUser(lineUserId, phone, displayName, firstName, lastName, company, birthday);
  const user = await getUserByLineId(lineUserId);
  return NextResponse.json({ success: true, isNew: result.isNew, user });
}
