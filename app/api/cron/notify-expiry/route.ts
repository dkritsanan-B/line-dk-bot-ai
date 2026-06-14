export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

// การแจ้งเตือนย้ายไปแสดงใน LIFF แล้ว — cron นี้ reserved ไว้ใช้ในอนาคต
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, message: "expiry info is now shown in LIFF" });
}
