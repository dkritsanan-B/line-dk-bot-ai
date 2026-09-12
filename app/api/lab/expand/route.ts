export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { expandBrief } from "@/lib/imagegen";

// POST /api/lab/expand  (application/json)
// body: { brief, aspect?, mode?, hasPhoto? }
// "ทีมงาน" ขยาย brief สั้น ๆ → prompt ละเอียด ให้ผู้ใช้ก๊อปไปรันใน ChatGPT เอง
export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-admin-password");
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  try {
    const { brief, aspect, mode, hasPhoto } = await req.json();
    if (!brief || typeof brief !== "string") {
      return NextResponse.json({ error: "พิมพ์ brief (สิ่งที่อยากได้) ก่อน" }, { status: 400 });
    }
    const prompt = await expandBrief({
      brief,
      aspect,
      mode: mode === "poster" ? "poster" : "clean",
      hasPhoto: !!hasPhoto,
    });
    if (!prompt) {
      return NextResponse.json({ error: "ขยาย brief ไม่สำเร็จ — ลองใหม่อีกครั้ง" }, { status: 502 });
    }
    return NextResponse.json({ prompt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "ขยาย brief ไม่สำเร็จ", detail: msg }, { status: 500 });
  }
}
