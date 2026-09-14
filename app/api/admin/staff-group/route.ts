export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAdminRole, hasRole } from "@/lib/admin-auth";
import { welcomeFlex, contactFlex, pointsFlex, locationMsg, TIER_COLOR } from "@/lib/line-ui";

// เช็ค/ทดสอบกลุ่มไลน์พนักงาน (env LINE_STAFF_GROUP_ID) — ค่าอยู่บน Vercel เท่านั้น อ่านย้อนจากเครื่องไม่ได้ จึงต้องถามผ่าน API
//   GET            → { set: bool, tail } บอกแค่ว่าตั้งไว้ไหม (ไม่เปิดเผยค่าเต็ม)
//   GET ?test=1    → push ข้อความทดสอบเข้ากลุ่ม 1 ข้อความ (กินโควตา push 1) เพื่อพิสูจน์ว่ากลุ่มยังรับได้
// super เท่านั้น
export async function GET(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "super")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gid = (process.env.LINE_STAFF_GROUP_ID ?? "").trim();
  const info = { set: !!gid, tail: gid ? gid.slice(-4) : null, looksValid: /^C[0-9a-f]{32}$/.test(gid) };
  const mode = req.nextUrl.searchParams.get("test") === "1" ? "test" : req.nextUrl.searchParams.get("preview") === "1" ? "preview" : "";
  if (!mode) return NextResponse.json(info);
  if (!gid) return NextResponse.json({ ...info, pushed: false, error: "ยังไม่ได้ตั้ง LINE_STAFF_GROUP_ID" }, { status: 400 });

  // preview=1 → ส่งการ์ดหน้าตาใหม่ของบอท (ต้อนรับ · ติดต่อ · บัตรแต้มตัวอย่าง) เข้ากลุ่มพนักงานให้เจ้าของดูของจริง (push 1 ครั้ง = โควตา 1)
  const messages = mode === "preview"
    ? [welcomeFlex(), contactFlex(), pointsFlex({ name: "ตัวอย่าง สมาชิก", tierName: "Gold", tierEmoji: "🥇", tierColor: TIER_COLOR.Gold, points: 2350, totalEarned: 2350, tierMin: 2000, next: { name: "Platinum", emoji: "🔱", min: 5000 } }), locationMsg()]
    : [{ type: "text", text: `🔧 ทดสอบระบบแจ้งเตือนแลกของรางวัล — ถ้าเห็นข้อความนี้แปลว่ากลุ่มพร้อมใช้งาน (${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false })})` }];
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ to: gid, messages }),
  });
  const body = await res.text();
  return NextResponse.json({ ...info, pushed: res.ok, status: res.status, body: res.ok ? undefined : body.slice(0, 300) }, { status: res.ok ? 200 : 502 });
}
