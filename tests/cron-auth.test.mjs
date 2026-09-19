// สิทธิ์ cron: ไม่มี CRON_SECRET = ปิดตาย (เดิม "Bearer undefined" ผ่านได้) · เทียบแบบ timing-safe
import { test, eq } from "./_harness.mjs";
import { isCronAuthorized } from "../lib/cron-auth.ts";

const S = "a-real-secret-that-is-long-enough-123";
test("ไม่ตั้ง secret / secret สั้น → ปฏิเสธทุกอย่าง แม้ header ตรง", () => {
  eq(isCronAuthorized("Bearer undefined", undefined), false);
  eq(isCronAuthorized("Bearer ", ""), false);
  eq(isCronAuthorized("Bearer short", "short"), false);
});
test("secret ถูกต้อง → ผ่านเฉพาะ header ที่ตรงเป๊ะ", () => {
  eq(isCronAuthorized(`Bearer ${S}`, S), true);
  eq(isCronAuthorized(`Bearer ${S}x`, S), false);
  eq(isCronAuthorized(`bearer ${S}`, S), false);
  eq(isCronAuthorized(S, S), false);
  eq(isCronAuthorized(null, S), false);
});
