// โครงเทสต์เล็ก ๆ ที่รันด้วย node ตรง ๆ (ไม่ต้องลงเครื่องมือทดสอบเพิ่ม)
//   node tests/run.mjs            ← รันทุกไฟล์ *.test.mjs
//
// ทำ 2 อย่าง:
//   1) ให้ node import ไฟล์ .ts ของโปรเจกต์ได้ (node 24 ถอด type ให้เอง เหลือแค่เรื่องเส้นทางไฟล์ "@/..." กับนามสกุล)
//   2) สลับ lib/db (ตัว sql tag) และ lib/liff-auth เป็นของปลอม — เทสต์ทุกตัวห้ามแตะฐานข้อมูลจริงและห้ามยิง LINE
import { registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const MOCK_DB = pathToFileURL(path.join(ROOT, "tests/mocks/db.mjs")).href;
const MOCK_AUTH = pathToFileURL(path.join(ROOT, "tests/mocks/liff-auth.mjs")).href;

const EXTS = ["", ".ts", ".tsx", ".mjs", ".js"];
function resolveFile(p) {
  for (const ext of EXTS) {
    const full = p + ext;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // ของปลอม — ต้องดักก่อนทุกอย่าง (โค้ดจริงเรียกได้ทั้ง "@/lib/db" และ "./db")
    const isDb = specifier === "@/lib/db" || /(^|\/)(\.\.?\/)*lib\/db$/.test(specifier) || specifier === "./db";
    if (isDb) return { url: MOCK_DB, shortCircuit: true };
    if (specifier === "@/lib/liff-auth" || specifier === "./liff-auth") return { url: MOCK_AUTH, shortCircuit: true };

    // next/server ใน node ต้องมีนามสกุล
    if (specifier === "next/server") return nextResolve("next/server.js", context);

    // ทางลัด "@/..." ของ tsconfig
    if (specifier.startsWith("@/")) {
      const full = resolveFile(path.join(ROOT, specifier.slice(2)));
      if (full) return { url: pathToFileURL(full).href, shortCircuit: true };
    }

    // import แบบสัมพัทธ์ที่ไม่ใส่นามสกุล (สไตล์ TypeScript)
    if (specifier.startsWith(".") && !path.extname(specifier) && context.parentURL?.startsWith("file:")) {
      const full = resolveFile(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
      if (full) return { url: pathToFileURL(full).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});

// ---- ตัวรันเทสต์ ----
const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }

export function eq(actual, expected, what = "") {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what || "ค่าไม่ตรง"}: ได้ ${a} · ควรเป็น ${b}`);
}
export function ok(cond, what = "เงื่อนไขไม่เป็นจริง") {
  if (!cond) throw new Error(what);
}

export async function runAll() {
  let pass = 0;
  const fails = [];
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log(`  ✓ ${t.name}`);
    } catch (e) {
      fails.push({ name: t.name, err: e });
      console.log(`  ✗ ${t.name}\n      ${e && e.message}`);
    }
  }
  console.log(`\n${pass}/${tests.length} ผ่าน`);
  if (fails.length) process.exitCode = 1;
  return fails.length === 0;
}
