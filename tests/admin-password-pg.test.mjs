// รหัสผ่านแอดมิน: เก็บแบบเข้ารหัส · แถวเก่าข้อความตรง ๆ ยังเข้าได้และถูกแปลงอัตโนมัติ — ทดสอบกับ Postgres ในเครื่อง
import { test, eq, ok } from "./_harness.mjs";
import { freshDb } from "./pg.mjs";
import { hashPassword, verifyPassword, isHashed, safeEqual } from "../lib/admin-password.ts";
import { verifyAdmin, ensureAdminTable, clearAdminAuthCache, hasRole } from "../lib/admin-auth.ts";

test("เข้ารหัสแล้วตรวจได้ · รหัสผิดไม่ผ่าน · ค่าแฮชไม่มีตัวรหัสจริง", async () => {
  const h = await hashPassword("963741");
  ok(isHashed(h));
  ok(!h.includes("963741"), "ค่าที่เก็บต้องไม่มีรหัสจริง");
  eq(await verifyPassword("963741", h), true);
  eq(await verifyPassword("963742", h), false);
  eq(await verifyPassword("", h), false);
  ok((await hashPassword("963741")) !== h, "เกลือต้องสุ่มทุกครั้ง");
});

test("ค่าที่เก็บเสียรูป ไม่ทำให้พังและไม่ให้ผ่าน", async () => {
  eq(await verifyPassword("x", "scrypt$broken"), false);
  eq(await verifyPassword("x", "scrypt$16384$8$1$$"), false);
  eq(await verifyPassword("x", null), false);
});

test("safeEqual เทียบถูกทั้งยาวเท่าและไม่เท่า", () => {
  eq(safeEqual("abc", "abc"), true);
  eq(safeEqual("abc", "abd"), false);
  eq(safeEqual("abc", "abcd"), false);
});

test("[pg] บัญชีเก่าที่เก็บรหัสตรง ๆ: เข้าได้ แล้วถูกแปลงเป็นแบบเข้ารหัสทันที · เข้าครั้งต่อไปยังได้", async () => {
  clearAdminAuthCache();
  const { pg, db } = await freshDb();
  await ensureAdminTable(db);
  await db.query(`INSERT INTO admin_users (username, password, role) VALUES ('adminbo', '963741', 'staff')`);

  eq(await verifyAdmin("adminbo", "963741", db), "staff");
  const [row] = await db.query(`SELECT password FROM admin_users WHERE username = 'adminbo'`);
  ok(isHashed(row.password), "ต้องถูกแปลงเป็นแบบเข้ารหัส");
  ok(!row.password.includes("963741"));

  clearAdminAuthCache();
  eq(await verifyAdmin("adminbo", "963741", db), "staff", "หลังแปลงยังเข้าได้ด้วยรหัสเดิม");
  clearAdminAuthCache();
  eq(await verifyAdmin("adminbo", "000000", db), null, "รหัสผิดต้องไม่ผ่าน");
  await pg.close();
});

test("[pg] บัญชีถูกปิด / ไม่มีชื่อนี้ / ไม่ส่งรหัส → ไม่ผ่าน", async () => {
  clearAdminAuthCache();
  const { pg, db } = await freshDb();
  await ensureAdminTable(db);
  await db.query(`INSERT INTO admin_users (username, password, role, active) VALUES ('off', $1, 'staff', FALSE)`, [await hashPassword("secret99")]);
  eq(await verifyAdmin("off", "secret99", db), null);
  eq(await verifyAdmin("nobody", "secret99", db), null);
  eq(await verifyAdmin("off", "", db), null);
  await pg.close();
});

test("ชื่อ admin ใช้ได้เฉพาะรหัสใน env · รหัสใน env ว่างต้องเข้าไม่ได้", async () => {
  clearAdminAuthCache();
  const prev = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = "env-super-pass";
  eq(await verifyAdmin("admin", "env-super-pass"), "super");
  eq(await verifyAdmin("", "env-super-pass"), "super");
  eq(await verifyAdmin("admin", "wrong"), null);
  process.env.ADMIN_PASSWORD = "";
  eq(await verifyAdmin("admin", ""), null);
  eq(await verifyAdmin("", "anything"), null, "env ว่างต้องไม่เปิดประตูให้");
  process.env.ADMIN_PASSWORD = prev;
});

test("ระดับสิทธิ์ที่เก็บผิดรูป ถือเป็น viewer (ต่ำสุด) ไม่ใช่ super", async () => {
  clearAdminAuthCache();
  const { pg, db } = await freshDb();
  await ensureAdminTable(db);
  await db.query(`INSERT INTO admin_users (username, password, role) VALUES ('odd', $1, 'owner')`, [await hashPassword("secret99")]);
  const role = await verifyAdmin("odd", "secret99", db);
  eq(role, "viewer");
  eq(hasRole(role, "staff"), false);
  await pg.close();
});
