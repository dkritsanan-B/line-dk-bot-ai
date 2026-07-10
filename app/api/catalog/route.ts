export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSignedImageUrl } from "@/lib/b2";

// GET /api/catalog
// ส่งข้อมูลสินค้า + โปรโมชัน + ช่องทางติดต่อ เป็น JSON
// ให้ระบบ Agency OS (Claude) ดึงไปใช้ทำโฆษณา
export async function GET() {
  try {
    const [products, promotions, contact] = await Promise.all([
      supabase.from("products").select("*").order("category").order("id"),
      supabase.from("promotions").select("*").order("start_date", { ascending: false }),
      supabase.from("contact_info").select("*").limit(1).maybeSingle(),
    ]);

    const firstError = products.error || promotions.error || contact.error;
    if (firstError) {
      return NextResponse.json(
        { error: "ดึงข้อมูลไม่สำเร็จ", detail: firstError.message },
        { status: 500 }
      );
    }

    // แปลง image_url (ที่เก็บเป็น "key") ให้เป็นลิงก์ชั่วคราวสำหรับดูรูป (bucket Private)
    const productsWithUrls = await Promise.all(
      (products.data ?? []).map(async (p) => ({
        ...p,
        image_url: p.image_url ? await getSignedImageUrl(p.image_url) : null,
      }))
    );

    return NextResponse.json({
      products: productsWithUrls,
      promotions: promotions.data ?? [],
      contact: contact.data ?? null,
      count: {
        products: products.data?.length ?? 0,
        promotions: promotions.data?.length ?? 0,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "เชื่อมต่อ Supabase ไม่ได้ — ตรวจ SUPABASE_URL / SUPABASE_SECRET_KEY ใน .env.local", detail: msg },
      { status: 500 }
    );
  }
}
