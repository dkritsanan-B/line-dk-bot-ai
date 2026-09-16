// เทียบข้อความบนจอของสองรอบถ่ายภาพ ทีละคู่ (scenario + page + view)
//   node scripts/compare-shots.mjs review/r0-baseline review/r1-refactor
// ใช้พิสูจน์ว่างานรื้อโครงไฟล์ไม่ได้ทำให้ข้อความบนจอเปลี่ยน
import fs from "node:fs";
import path from "node:path";

const A = process.argv[2] ?? "review/r0-baseline";
const B = process.argv[3] ?? "review/r1-refactor";
const load = d => JSON.parse(fs.readFileSync(path.join(d, "index.json"), "utf8"));
const key = s => `${s.scenario}|${s.page}|${s.view}`;
const mapOf = idx => new Map(idx.shots.map(s => [key(s), s]));

const a = load(A), b = load(B);
const ma = mapOf(a), mb = mapOf(b);
const diffs = [];

for (const [k, sa] of ma) {
  const sb = mb.get(k);
  if (!sb) { diffs.push(`${k} : หายไปจาก ${B}`); continue; }
  if ((sa.text ?? "") !== (sb.text ?? "")) {
    diffs.push(`${k} : ข้อความต่าง\n  เดิม: ${sa.text}\n  ใหม่: ${sb.text}`);
  }
}
for (const k of mb.keys()) if (!ma.has(k)) diffs.push(`${k} : เป็นภาพใหม่ ไม่มีใน ${A}`);

const errB = (b.errors ?? []).length;
const consoleB = b.shots.filter(s => (s.consoleErrors ?? []).length);

console.log(`เทียบ ${ma.size} คู่ · ต่าง ${diffs.length} จุด · error ตอนถ่าย ${errB} · หน้าที่มี console error ${consoleB.length}`);
for (const d of diffs) console.log("  ❌ " + d);
for (const s of consoleB) console.log("  ⚠️ console " + key(s) + " :: " + s.consoleErrors.join(" | ").slice(0, 300));
if (!diffs.length) console.log("✅ ข้อความบนจอเหมือนเดิมทุกคู่");
process.exit(diffs.length ? 1 : 0);
