// ตรวจว่าระดับสมาชิกบน "หน้าจอ" ตรงกับ "กติกาจริง" ใน lib/points.ts ที่เดียว
//   node scripts/check-tiers.mjs
//
// ทำไมต้องมี: เกณฑ์แต้ม (100 / 500 / 2,000 / 5,000 / 10,000) เคยถูกพิมพ์ซ้ำในหน้าเว็บและในแอดมิน
// พอกติกาเปลี่ยน หน้าเว็บจะโกหกลูกค้าเงียบ ๆ สคริปต์นี้ fail ถ้า:
//   1. ชื่อ/ลำดับระดับใน app/liff/lib/tiers.ts ไม่ตรงกับ lib/points.ts
//   2. app/liff/** พิมพ์ตัวเลขเกณฑ์แต้มซ้ำเอง (ต้องอ่านจาก TIERS เท่านั้น)
//   3. ระดับใดไม่มี "หน้าตา" (อีโมจิ / ไล่สี / ชุดสีตัวอักษร) หรือ ink ไม่ใช่ light/dark
//   4. liff.css ไม่มีชุดสีตัวอักษรครบทั้ง light และ dark
//   5. lib/tierRules.ts (TIER_ORDER) ไม่ตรงกับชุดระดับเดียวกัน
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = p => fs.readFileSync(path.join(ROOT, p), "utf8");
const fails = [];
const oks = [];
const fail = m => fails.push(m);
const ok = m => oks.push(m);

/* ── 1. แหล่งจริง: lib/points.ts ───────────────────────────────── */
const POINTS = read("lib/points.ts");
const tiersBlock = POINTS.match(/export const TIERS = \[([\s\S]*?)\] as const;/);
if (!tiersBlock) { console.error("❌ อ่าน TIERS จาก lib/points.ts ไม่ได้"); process.exit(1); }
const RULE_TIERS = [...tiersBlock[1].matchAll(/name:\s*"(\w+)"[^}]*?min:\s*(\d+)/g)].map(m => ({ name: m[1], min: +m[2] }));
if (RULE_TIERS.length < 2) { console.error("❌ อ่านรายการระดับจาก lib/points.ts ไม่ได้"); process.exit(1); }
ok(`lib/points.ts มี ${RULE_TIERS.length} ระดับ: ` + RULE_TIERS.map(t => `${t.name}=${t.min}`).join(" · "));

// เรียงจากสูงไปต่ำเสมอ (getTierFromPoints ใช้ find ตัวแรกที่ points >= min)
for (let i = 1; i < RULE_TIERS.length; i++) {
  if (RULE_TIERS[i].min >= RULE_TIERS[i - 1].min) {
    fail(`lib/points.ts: TIERS ต้องเรียงจากเกณฑ์สูงไปต่ำ แต่ ${RULE_TIERS[i - 1].name}(${RULE_TIERS[i - 1].min}) มาก่อน ${RULE_TIERS[i].name}(${RULE_TIERS[i].min})`);
  }
}

/* ── 2. หน้าตาระดับ: app/liff/lib/tiers.ts ────────────────────── */
const TIERS_TS = read("app/liff/lib/tiers.ts");
if (!/from\s+"@\/lib\/points"/.test(TIERS_TS)) fail("app/liff/lib/tiers.ts ต้อง import TIERS จาก @/lib/points (ห้ามประกาศเกณฑ์เอง)");
else ok("app/liff/lib/tiers.ts ดึงเกณฑ์จาก lib/points.ts");

const THEME = {};
for (const m of TIERS_TS.matchAll(/(\w+):\s*\{\s*emoji:\s*"([^"]+)",\s*ink:\s*"(\w+)",\s*cardGrad:\s*"([^"]+)"(?:,\s*mark:\s*"[^"]+")?\s*\}/g)) {
  THEME[m[1]] = { emoji: m[2], ink: m[3], grad: m[4] };
}
const themeNames = Object.keys(THEME);
if (!themeNames.length) fail("อ่าน TIER_THEME จาก app/liff/lib/tiers.ts ไม่ได้");

for (const t of RULE_TIERS) {
  const th = THEME[t.name];
  if (!th) { fail(`ระดับ "${t.name}" ไม่มีหน้าตาใน TIER_THEME (app/liff/lib/tiers.ts)`); continue; }
  if (!th.emoji) fail(`ระดับ "${t.name}" ไม่มีอีโมจิ`);
  if (th.ink !== "light" && th.ink !== "dark") fail(`ระดับ "${t.name}" ink = "${th.ink}" (ต้องเป็น light หรือ dark)`);
  if (!/linear-gradient\(/.test(th.grad)) fail(`ระดับ "${t.name}" cardGrad ไม่ใช่ไล่สี`);
}
for (const n of themeNames) {
  if (!RULE_TIERS.some(t => t.name === n)) fail(`TIER_THEME มีระดับ "${n}" ที่ไม่มีใน lib/points.ts (ระดับผี)`);
}
if (themeNames.length === RULE_TIERS.length && !fails.length) ok(`หน้าตาครบ ${themeNames.length} ระดับ ตรงชื่อกับกติกา`);

/* ── 3. ห้าม hardcode เกณฑ์แต้มซ้ำใน app/liff ────────────────── */
// นับเป็น "พิมพ์เกณฑ์ซ้ำ" เมื่อ
//   ก. บรรทัดมีตัวเลขเกณฑ์ (ไม่ใช่ 100% / 100vh / ค่าสี) พร้อมคำที่บอกว่ากำลังพูดถึงระดับ
//      (ชื่อระดับ เช่น Gold หรือคำว่า ระดับ / เลื่อนขั้น / tier / min)
//   ข. หรือมีตัวเลขเกณฑ์แบบใส่จุลภาค (2,000 / 5,000 / 10,000) ซึ่งมีที่เดียวคือตอนเอาไปแสดงบนจอ
// "ทุก 100 บาท = 1 แต้ม" ไม่นับ เพราะเป็นอัตราสะสม ไม่ใช่เกณฑ์ระดับ
const thresholds = RULE_TIERS.map(t => t.min).filter(n => n > 0);
// คำที่แปลว่า "บรรทัดนี้กำลังพูดถึงระดับสมาชิก" — ต้องเป็นชื่อระดับจริง หรือคำไทยที่ชี้ชัด
// (ไม่เอาคำกว้าง ๆ อย่าง tier/min เพราะ `Math.min(100, …)` และ `tier.min` เป็นโค้ดที่ถูกต้อง)
const TIER_WORDS = new RegExp("(" + RULE_TIERS.map(t => t.name).join("|") + "|ระดับ|เลื่อนขั้น)");
const bareRe = n => new RegExp("(?<![\\d.,#])" + n + "(?![\\d.,]|%|px|vh|vw|deg|ms)");
// รูปใส่จุลภาคมีเฉพาะตอนเอาไปแสดงบนจอ — ใช้ได้กับเกณฑ์ตั้งแต่หลักพันขึ้นไปเท่านั้น
const groupedRe = n => (n >= 1000 ? new RegExp("(?<![\\d.,])" + n.toLocaleString("en-US") + "(?![\\d.,])") : null);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = dir + "/" + e.name;
    if (e.isDirectory()) walk(rel);
    else if (/\.tsx?$/.test(e.name)) files.push(rel);
  }
})("app/liff");

let hardcoded = 0;
for (const f of files) {
  if (f === "app/liff/lib/tiers.ts") {
    // ไฟล์หน้าตาระดับ — พูดถึงชื่อระดับได้ แต่ต้องไม่มีตัวเลขเกณฑ์อยู่ในไฟล์เลย
    const body = read(f).replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
    for (const n of thresholds) {
      if (bareRe(n).test(body)) { fail(f + " มีตัวเลขเกณฑ์ " + n.toLocaleString() + " อยู่ในไฟล์ — ต้องมาจาก lib/points.ts เท่านั้น"); hardcoded++; }
    }
    continue;
  }
  read(f).split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;               // คอมเมนต์อธิบายได้
    for (const n of thresholds) {
      const g = groupedRe(n);
      if ((g && g.test(line)) || (bareRe(n).test(line) && TIER_WORDS.test(line))) {
        fail(f + ":" + (i + 1) + " พิมพ์เกณฑ์ระดับ " + n.toLocaleString() + " ซ้ำเอง — ต้องอ่านจาก TIERS (lib/points.ts)\n      " + line.trim().slice(0, 110));
        hardcoded++;
      }
    }
  });
}
if (!hardcoded) ok(`ไม่มีไฟล์ใน app/liff พิมพ์เกณฑ์แต้มซ้ำ (ตรวจ ${files.length} ไฟล์)`);

/* ── 4. liff.css ต้องมีชุดสีตัวอักษรของบัตรครบทั้ง 2 แบบ ────── */
const CSS = read("app/liff/liff.css");
const needVars = ["--card-ink", "--card-ink-2", "--card-badge-bg", "--card-badge-ink", "--card-well", "--card-track", "--card-fill"];
for (const ink of ["light", "dark"]) {
  const m = CSS.match(new RegExp(`\\.lf-mcard\\[data-ink="${ink}"\\]\\s*\\{([\\s\\S]*?)\\}`));
  if (!m) { fail(`liff.css ไม่มีชุดสีตัวอักษรบัตรแบบ "${ink}"`); continue; }
  for (const v of needVars) if (!m[1].includes(v + ":")) fail(`liff.css: .lf-mcard[data-ink="${ink}"] ขาด ${v}`);
}
// ทุกระดับที่ tiers.ts ใช้ ต้องมีชุดสีรองรับใน css
const usedInks = [...new Set(Object.values(THEME).map(t => t.ink))];
for (const ink of usedInks) {
  if (!CSS.includes(`[data-ink="${ink}"]`)) fail(`tiers.ts ใช้ ink="${ink}" แต่ liff.css ไม่มีชุดสีนี้`);
}
if (!fails.some(m => m.includes("liff.css"))) ok(`liff.css มีชุดสีตัวอักษรบัตรครบ (${usedInks.join(", ")})`);

/* ── 5. บัตรใน MemberCard ต้องประกาศ data-ink จริง ──────────── */
const CARD = read("app/liff/components/MemberCard.tsx");
if (!/data-ink=\{\s*tier\.ink\s*\}/.test(CARD)) fail('app/liff/components/MemberCard.tsx ไม่ได้ใส่ data-ink={tier.ink} บน .lf-mcard → ตัวอักษรบนบัตรจะไม่มีสี (คอนทราสต์พัง)');
else ok("MemberCard ใส่ data-ink={tier.ink} ให้บัตรแล้ว");

/* ── 6. lib/tierRules.ts ต้องใช้ชุดระดับเดียวกัน ─────────────── */
const RULES_TS = read("lib/tierRules.ts");
const order = (RULES_TS.match(/export const TIER_ORDER = \[([^\]]+)\]/) || [])[1];
if (!order) fail("อ่าน TIER_ORDER จาก lib/tierRules.ts ไม่ได้");
else {
  const names = [...order.matchAll(/"(\w+)"/g)].map(m => m[1]);
  const expect = [...RULE_TIERS].reverse().map(t => t.name);   // TIER_ORDER เรียงจากต่ำไปสูง
  if (names.join(",") !== expect.join(","))
    fail(`lib/tierRules.ts TIER_ORDER = [${names}] ไม่ตรงกับ lib/points.ts (ควรเป็น [${expect}])`);
  else ok("lib/tierRules.ts TIER_ORDER ตรงกับ lib/points.ts");
}


/* ── 7. ตัวเลขที่หน้าเว็บต้องพูดตรงกับเซิร์ฟเวอร์ (อัตราสะสม / คูปองวันเกิด) ── */
const PERKS_TS = read("app/liff/lib/perks.ts");
const ppb = (POINTS.match(/const POINTS_PER_BAHT = (\d+)/) || [])[1];
const bpp = (PERKS_TS.match(/export const BAHT_PER_POINT = (\d+)/) || [])[1];
if (!ppb || !bpp) fail("อ่าน POINTS_PER_BAHT (lib/points.ts) หรือ BAHT_PER_POINT (app/liff/lib/perks.ts) ไม่ได้");
else if (ppb !== bpp) fail(`app/liff/lib/perks.ts BAHT_PER_POINT=${bpp} ไม่ตรงกับ lib/points.ts POINTS_PER_BAHT=${ppb}`);
else ok(`อัตราสะสมบนหน้าเว็บตรงกับเซิร์ฟเวอร์ (${ppb} บาท = 1 แต้ม)`);
const bdSrv = (read("app/api/cron/birthday/route.ts").match(/const BIRTHDAY_POINTS = \[([^\]]+)\]/) || [])[1];
const bdWeb = (PERKS_TS.match(/export const BIRTHDAY_POINTS = \[([^\]]+)\]/) || [])[1];
const norm = s => (s || "").replace(/\s/g, "");
if (!bdSrv || !bdWeb) fail("อ่าน BIRTHDAY_POINTS จาก cron วันเกิด หรือ app/liff/lib/perks.ts ไม่ได้");
else if (norm(bdSrv) !== norm(bdWeb)) fail(`คูปองวันเกิดบนหน้าเว็บ [${norm(bdWeb)}] ไม่ตรงกับ cron [${norm(bdSrv)}]`);
else ok(`คูปองวันเกิดบนหน้าเว็บตรงกับ cron (${norm(bdSrv)})`);

/* ── สรุป ─────────────────────────────────────────────────────── */
for (const m of oks) console.log("✅ " + m);
for (const m of fails) console.log("❌ " + m);
console.log(`\nผ่าน ${oks.length} · ตก ${fails.length}`);
if (fails.length) process.exit(1);
