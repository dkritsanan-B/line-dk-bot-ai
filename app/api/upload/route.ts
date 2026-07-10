export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { uploadToB2, getSignedImageUrl } from "@/lib/b2";
import { supabase } from "@/lib/supabase";

// POST /api/upload  (multipart/form-data)
// fields: file (รูป), productId (ไม่บังคับ — ถ้ามีจะบันทึก URL ลงสินค้านั้น)
export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-admin-password");
  if (auth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const productId = form.get("productId");

    if (!file) return NextResponse.json({ error: "ไม่พบไฟล์รูป" }, { status: 400 });
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "อัพโหลดได้เฉพาะไฟล์รูปภาพ" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const key = `products/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;

    // อัพขึ้น B2 แล้วเก็บ "key" (ที่อยู่ไฟล์) ไม่ใช่ URL — เพราะ bucket เป็น Private
    await uploadToB2(key, buf, file.type);

    // ถ้าระบุ productId → บันทึก key ลง image_url ในตารางสินค้า
    if (productId) {
      const { error } = await supabase
        .from("products")
        .update({ image_url: key })
        .eq("id", Number(productId));
      if (error) {
        return NextResponse.json({ key, warning: "อัพรูปได้ แต่บันทึกลงสินค้าไม่สำเร็จ: " + error.message });
      }
    }

    // สร้างลิงก์ชั่วคราวส่งกลับไปให้หน้าเว็บโชว์รูปทันที
    const url = await getSignedImageUrl(key);
    return NextResponse.json({ url, key });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "อัพโหลดไม่สำเร็จ — ตรวจการตั้งค่า B2 ใน .env.local", detail: msg },
      { status: 500 }
    );
  }
}
