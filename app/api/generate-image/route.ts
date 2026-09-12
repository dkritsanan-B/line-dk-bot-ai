export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { generateProductImage } from "@/lib/gemini";
import { uploadToB2, getSignedImageUrl } from "@/lib/b2";
import { supabase } from "@/lib/supabase";

// POST /api/generate-image  (application/json)
// body: { prompt (บรรยายรูปที่ต้องการ), productId (ไม่บังคับ — ถ้ามีจะบันทึกลงสินค้านั้น) }
// ระบบ Agency OS แผนก Production: ให้ Gemini วาดรูป → อัปขึ้น B2 → บันทึก key ลง Supabase
export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-admin-password");
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  try {
    const { prompt, productId } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "ต้องระบุ prompt (คำบรรยายรูป)" }, { status: 400 });
    }

    // ให้ Gemini สร้างรูป
    const img = await generateProductImage(prompt);
    if (!img) {
      return NextResponse.json(
        { error: "AI สร้างรูปไม่สำเร็จ — ลองปรับ prompt ให้ชัดขึ้น หรือลองใหม่อีกครั้ง" },
        { status: 502 }
      );
    }

    // อัปขึ้น B2 (bucket Private) แล้วเก็บ "key"
    const ext = img.mimeType.includes("jpeg") ? "jpg" : "png";
    const key = `products/ai-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
    await uploadToB2(key, img.buffer, img.mimeType);

    // ถ้าระบุ productId → บันทึก key ลง image_url ของสินค้านั้น
    if (productId) {
      const { error } = await supabase
        .from("products")
        .update({ image_url: key })
        .eq("id", Number(productId));
      if (error) {
        return NextResponse.json({ key, warning: "สร้างรูปได้ แต่บันทึกลงสินค้าไม่สำเร็จ: " + error.message });
      }
    }

    const url = await getSignedImageUrl(key);
    return NextResponse.json({ url, key });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "สร้างรูป AI ไม่สำเร็จ — ตรวจ GEMINI_API_KEY / การตั้งค่า B2 ใน .env.local", detail: msg },
      { status: 500 }
    );
  }
}
