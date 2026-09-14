export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAdminRole, hasRole } from "@/lib/admin-auth";

// เช็ค/ทดสอบกลุ่มไลน์พนักงาน (env LINE_STAFF_GROUP_ID) — ค่าอยู่บน Vercel เท่านั้น อ่านย้อนจากเครื่องไม่ได้ จึงต้องถามผ่าน API
//   GET            → { set: bool, tail } บอกแค่ว่าตั้งไว้ไหม (ไม่เปิดเผยค่าเต็ม)
//   GET ?test=1    → push ข้อความทดสอบเข้ากลุ่ม 1 ข้อความ (กินโควตา push 1) เพื่อพิสูจน์ว่ากลุ่มยังรับได้
// super เท่านั้น
export async function GET(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "super")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gid = (process.env.LINE_STAFF_GROUP_ID ?? "").trim();
  const info = { set: !!gid, tail: gid ? gid.slice(-4) : null, looksValid: /^C[0-9a-f]{32}$/.test(gid) };
  if (req.nextUrl.searchParams.get("test") !== "1") return NextResponse.json(info);
  if (!gid) return NextResponse.json({ ...info, pushed: false, error: "ยังไม่ได้ตั้ง LINE_STAFF_GROUP_ID" }, { status: 400 });

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ to: gid, messages: [{ type: "text", text: `🔧 ทดสอบระบบแจ้งเตือนแลกของรางวัล — ถ้าเห็นข้อความนี้แปลว่ากลุ่มพร้อมใช้งาน (${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false })})` }] }),
  });
  const body = await res.text();
  return NextResponse.json({ ...info, pushed: res.ok, status: res.status, body: res.ok ? undefined : body.slice(0, 300) }, { status: res.ok ? 200 : 502 });
}
