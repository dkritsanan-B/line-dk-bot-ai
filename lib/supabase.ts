import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ตัวเชื่อม Supabase สำหรับฝั่งเซิร์ฟเวอร์ (ใช้ secret key = เข้าถึงได้เต็มสิทธิ์)
// ใช้กับ Agency OS: แคตตาล็อกสินค้า / โปรโมชัน / ช่องทางติดต่อ
// สร้างแบบ lazy — ตอน next build (collect page data) ยังไม่มี env แล้ว createClient จะ throw "supabaseUrl is required" ทำ build ล้ม (เจอ 12 ก.ย. 69)
let _client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  }
  return _client;
}
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_t, prop) => (getSupabase() as unknown as Record<string | symbol, unknown>)[prop],
});
