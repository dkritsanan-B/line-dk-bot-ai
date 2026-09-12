export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { generateImages, availableProviders, type GenRequest } from "@/lib/imagegen";

// GET /api/lab/generate → บอกว่า AI เจ้าไหนพร้อมใช้ (มีคีย์แล้ว)
export async function GET() {
  return NextResponse.json({ providers: availableProviders() });
}

// POST /api/lab/generate  (application/json)
// body: { provider, mode, prompt, baseImage?, n?, aspect? }
// สร้างรูปเทียบกัน — คืนเป็น data URL หลายใบ (ยังไม่เซฟ B2 · เซฟตอนเลือกใบที่ชอบ)
export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-admin-password");
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Partial<GenRequest>;
    if (!body.prompt || typeof body.prompt !== "string") {
      return NextResponse.json({ error: "ต้องพิมพ์ brief (สิ่งที่อยากได้) ก่อน" }, { status: 400 });
    }
    if (body.provider !== "gemini" && body.provider !== "openai") {
      return NextResponse.json({ error: "เลือก AI ไม่ถูกต้อง" }, { status: 400 });
    }

    const images = await generateImages({
      provider: body.provider,
      mode: body.mode === "poster" ? "poster" : "clean",
      prompt: body.prompt,
      baseImage: typeof body.baseImage === "string" ? body.baseImage : undefined,
      n: body.n,
      aspect: body.aspect,
    });

    if (images.length === 0) {
      return NextResponse.json(
        { error: "AI สร้างรูปไม่สำเร็จ — ลองปรับ brief ให้ชัดขึ้น หรือลองใหม่" },
        { status: 502 }
      );
    }
    return NextResponse.json({ images });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "สร้างรูปไม่สำเร็จ", detail: msg }, { status: 500 });
  }
}
