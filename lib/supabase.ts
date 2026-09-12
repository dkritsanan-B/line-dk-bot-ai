import { createClient } from "@supabase/supabase-js";

// ตัวเชื่อม Supabase สำหรับฝั่งเซิร์ฟเวอร์ (ใช้ secret key = เข้าถึงได้เต็มสิทธิ์)
// ใช้กับ Agency OS: แคตตาล็อกสินค้า / โปรโมชัน / ช่องทางติดต่อ
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } }
);
