// ตรวจคอนทราสต์ (WCAG 2.1) ของระบบดีไซน์หน้าสมาชิก — อ่านค่าสีจริงจาก app/liff/liff.css และ app/liff/lib/tiers.ts
//   node scripts/check-contrast.mjs            ตรวจของปัจจุบัน (exit 1 ถ้าตก)
//   node scripts/check-contrast.mjs --before   ตรวจ "สภาพก่อนซ่อม" (บัตรไม่มี data-ink → ตัวอักษรตกทอดเป็น --ink)
//
// กติกา: ข้อความปกติ ≥ 4.5:1 · ข้อความใหญ่ (≥ 24px หรือ ≥ 18.66px ตัวหนา) และไอคอน/ส่วนประกอบ ≥ 3:1
// บัตรสมาชิกเป็นไล่สี → คิด "กรณีแย่สุด" ทุกจุดสีของไล่สี และซ้อนชั้นเงาไล่แสง (--card-sheen) ด้วยเสมอ
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const cssArg = (process.argv.find(a => a.startsWith("--css=")) || "").slice(6);
const CSS = fs.readFileSync(cssArg ? path.resolve(cssArg) : path.join(ROOT, "app/liff/liff.css"), "utf8");
const TIERS_TS = fs.readFileSync(path.join(ROOT, "app/liff/lib/tiers.ts"), "utf8");
const BEFORE = process.argv.includes("--before");

/* ── สี ───────────────────────────────────────────────────────────── */
const hex = h => {
  const s = h.replace("#", "").trim();
  const f = s.length === 3 ? s.split("").map(c => c + c).join("") : s;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16), 1];
};
const parseColor = v => {
  v = String(v).trim();
  if (v.startsWith("#")) return hex(v);
  const m = v.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)/i);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  throw new Error("อ่านสีไม่ออก: " + v);
};
/** วางสี fg (อาจโปร่ง) ทับพื้น bg ทึบ → สีทึบที่ตาเห็นจริง */
const over = (fg, bg) => {
  const [r, g, b, a] = fg;
  return [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a), 1];
};
const lum = ([r, g, b]) => {
  const f = c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const fmt = n => n.toFixed(2) + ":1";

/* ── อ่าน token จาก :root ของ liff.css ─────────────────────────── */
function block(selector) {
  const i = CSS.indexOf(selector);
  if (i < 0) throw new Error("ไม่พบบล็อก " + selector + " ใน liff.css");
  const s = CSS.indexOf("{", i), e = CSS.indexOf("}", s);
  return CSS.slice(s + 1, e);
}
function vars(text) {
  const out = {};
  for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim().replace(/\s*\/\*.*?\*\/\s*/g, "").trim();
  return out;
}
const ROOTV = vars(block(":root"));
const INK = {
  light: vars(block('.lf-mcard[data-ink="light"]')),
  dark: vars(block('.lf-mcard[data-ink="dark"]')),
};
/** คลี่ var(--x) ซ้อนกันให้เป็นค่าสีจริง */
function val(name, scope = {}) {
  let v = scope[name] ?? ROOTV[name];
  if (v === undefined) throw new Error("ไม่มีตัวแปร " + name);
  for (let i = 0; i < 6 && v.includes("var("); i++) {
    v = v.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, n) => scope[n] ?? ROOTV[n] ?? "");
  }
  return parseColor(v);
}

/* ── จุดสีของไล่สีบัตร + ชั้นเงาไล่แสง ───────────────────────── */
const SHEEN_MAX = 0.10;   // ค่าสูงสุดของ --card-sheen ที่ยอมให้ (ตรวจกับค่าจริงด้านล่าง)
function gradientStops(css) {
  return [...css.matchAll(/#[0-9A-Fa-f]{6}/g)].map(m => hex(m[0]));
}
const TIER_GRADS = {};
for (const m of TIERS_TS.matchAll(/(\w+):\s*\{\s*emoji:.*?ink:\s*"(light|dark)".*?cardGrad:\s*"([^"]+)"/gs)) {
  TIER_GRADS[m[1]] = { ink: m[2], stops: gradientStops(m[3]) };
}
if (!Object.keys(TIER_GRADS).length) throw new Error("อ่าน TIER_THEME จาก tiers.ts ไม่ได้");

/** พื้นจริงของบัตร = จุดสีของไล่สี + ชั้น sheen ทับ (กรณีแย่สุดคือทั้งมีและไม่มี) */
function cardBackdrops(tier) {
  const { stops, ink } = TIER_GRADS[tier];
  const sheen = INK[ink]["--card-sheen"] ? val("--card-sheen", INK[ink]) : parseColor(`rgba(255,255,255,${SHEEN_MAX})`);
  const out = [];
  for (const s of stops) { out.push(s); out.push(over(sheen, s)); }
  return out;
}

/* ── รายการคู่สีที่ต้องผ่าน ─────────────────────────────────── */
const checks = [];
const add = (where, fg, bg, min = 4.5, note = "") => checks.push({ where, fg, bg, min, note });

/* 1) บัตรสมาชิกทุกระดับ — ตัวอักษร/ตรา/แถบคืบหน้า บนไล่สีทุกจุด */
for (const [tier, { ink }] of Object.entries(TIER_GRADS)) {
  const sc = INK[ink];
  const beds = cardBackdrops(tier);
  // ก่อนซ่อม: MemberCard ไม่ได้ใส่ data-ink → var(--card-ink) ไม่มีค่า → สีตกทอดมาจาก .lf-page (--ink)
  const ink1 = BEFORE ? val("--ink") : val("--card-ink", sc);
  const ink2 = BEFORE ? val("--ink") : val("--card-ink-2", sc);
  const badgeBg = BEFORE ? null : val("--card-badge-bg", sc);
  const badgeInk = BEFORE ? val("--ink") : val("--card-badge-ink", sc);

  for (const bed of beds) {
    add(`บัตร ${tier} · ชื่อ/ป้ายบนบัตร`, ink1, bed, 4.5);
    add(`บัตร ${tier} · ข้อความรองบนบัตร`, ink2, bed, 4.5);
    if (badgeBg) {
      add(`บัตร ${tier} · ตัวอักษรในตราระดับ`, badgeInk, over(badgeBg, bed), 4.5);
      add(`บัตร ${tier} · ตัวตราระดับกับพื้นบัตร`, over(badgeBg, bed), bed, 3, "ส่วนประกอบ");
    } else {
      add(`บัตร ${tier} · ตัวอักษรในตราระดับ`, badgeInk, bed, 4.5);
    }

    // กล่องข้อมูลสำคัญ (well) — โปร่งแสงทับไล่สี
    const wellRaw = BEFORE ? null : val("--card-well", sc);
    if (wellRaw) {
      const well = over(wellRaw, bed);
      add(`บัตร ${tier} · แต้ม/ข้อความในกล่องแต้ม`, ink1, well, 4.5);
      add(`บัตร ${tier} · ข้อความรองในกล่องแต้ม`, ink2, well, 4.5);
      const track = over(val("--card-track", sc), well);
      const fill = over(val("--card-fill", sc), well);
      add(`บัตร ${tier} · แถบคืบหน้า (ส่วนที่ได้แล้ว vs ราง)`, fill, track, 3, "ส่วนประกอบ");
      // รางเป็นสีอ่อน (ให้เห็นชัดว่าเต็มถึงไหน) ขอบเขตรางมาจากเส้นขอบ --card-track-line ที่ต้องผ่าน 3:1
      const trackLine = over(val("--card-track-line", sc), well);
      add(`บัตร ${tier} · ขอบรางแถบคืบหน้ากับกล่องแต้ม`, trackLine, well, 3, "ส่วนประกอบ");
    } else {
      // ก่อนซ่อม: ไม่มี well และ --card-track/--card-fill ไม่มีค่า → แถบโปร่งใสทั้งแถบ
      add(`บัตร ${tier} · แถบคืบหน้า (ส่วนที่ได้แล้ว vs ราง)`, bed, bed, 3, "ส่วนประกอบ — ไม่มีค่าสี แถบหายไปทั้งแถบ");
      add(`บัตร ${tier} · รางแถบคืบหน้ากับกล่องแต้ม`, bed, bed, 3, "ส่วนประกอบ — ไม่มีค่าสี");
    }
  }
}

/* 2) กล่องเตือน / แจ้งเตือน */
const W = n => { try { return val(n); } catch { return null; } };
const addW = (where, fgN, bgN, min = 4.5, note = "") => { const f = W(fgN), b = W(bgN); if (f && b) add(where, f, b, min, note); };
addW("กล่องเตือนแดง (lf-note--danger / lf-alert--err)", "--danger", "--danger-tint");
addW("กล่องเตือนเหลือง (lf-note--warn / lf-alert--warn)", "--warn", "--warn-tint");
addW("กล่องข้อมูลฟ้า (lf-alert--info)", "--dk-blue-strong", "--dk-sky");
// ขอบเขตของกล่องเตือนมาจาก "แถบข้างซ้าย" สีเต็ม (border-left 4px) ส่วนเส้นขอบบาง 1px เป็นแค่การตกแต่ง
addW("แถบข้างกล่องเตือนแดงกับพื้นกล่อง", "--danger", "--danger-tint", 3, "ส่วนประกอบ — แถบข้าง 4px");
addW("แถบข้างกล่องเตือนเหลืองกับพื้นกล่อง", "--warn", "--warn-tint", 3, "ส่วนประกอบ — แถบข้าง 4px");
addW("แถบข้างกล่องข้อมูลฟ้ากับพื้นกล่อง", "--dk-blue-strong", "--dk-sky", 3, "ส่วนประกอบ — แถบข้าง 4px");
addW("เส้นขอบบางของกล่องเตือนแดง", "--danger-line", "--danger-tint", 1.2, "เส้นตกแต่ง");
addW("เส้นขอบบางของกล่องเตือนเหลือง", "--warn-line", "--warn-tint", 1.2, "เส้นตกแต่ง");
addW("ปุ่ม 'ดูรายการ' ในกล่องแดง (lf-link)", "--danger", "--surface");
addW("ปุ่ม 'ดูรายการ' ในกล่องเหลือง (lf-link)", "--warn", "--surface");
addW("ข้อความสำเร็จ (lf-msg.ok)", "--ok", "--ok-tint");

/* 3) ตัวหนังสือทั่วหน้า */
for (const [bgName, bg] of [["พื้นขาว", W("--surface")], ["พื้นเทาอ่อน", W("--surface-2")], ["พื้นหน้า", W("--bg")]]) {
  add(`ข้อความหลักบน${bgName}`, W("--ink"), bg);
  add(`ข้อความรองบน${bgName}`, W("--ink-2"), bg);
  add(`ป้ายกำกับบน${bgName}`, W("--ink-3"), bg);
}
addW("ข้อความบนพื้นฟ้าอ่อน (lf-perk)", "--dk-navy", "--dk-sky");
addW("ข้อความรองบนพื้นฟ้าอ่อน (lf-perk span)", "--ink-2", "--dk-sky");
addW("เส้นคั่นรายการกับพื้นขาว (lf-tx)", "--line", "--surface", 1.2, "เส้นตกแต่ง — ไม่ใช่ขอบส่วนประกอบ จึงไม่ติดเกณฑ์ 3:1");
addW("ขอบช่องกรอก/ปุ่มโปร่งกับพื้นขาว", "--line-strong", "--surface", 3, "ส่วนประกอบ");
addW("ขอบช่องกรอกกับพื้นเทาอ่อน", "--line-strong", "--surface-2", 3, "ส่วนประกอบ");

/* 4) หัวหน้า (ไล่สีน้ำเงิน) — คิดจุดสว่างสุดของไล่สี */
const heroStops = gradientStops(CSS.slice(CSS.indexOf(".lf-hero {"), CSS.indexOf(".lf-hero--short")))
  .concat([val("--dk-blue"), val("--dk-navy")]).concat(W("--dk-blue-light") ? [W("--dk-blue-light")] : []);
for (const s of heroStops) {
  add("ชื่อร้านบนหัวหน้า", W("--on-brand"), s);
  add("คำบรรยายบนหัวหน้า", W("--dk-sky"), s);
}
addW("ปุ่มย้อนกลับบนหัวหน้า", "--dk-blue-strong", "--surface");

/* 5) ปุ่ม */
addW("ปุ่มหลัก", "--on-brand", "--dk-blue");
addW("ปุ่มหลัก (ปลายไล่สี)", "--on-brand", "--dk-blue-strong");
addW("ปุ่มส้ม", "--accent-ink", "--accent");
addW("ปุ่มส้ม (ปลายไล่สี)", "--accent-ink", "--accent-light");
addW("ปุ่มโปร่ง", "--ink-2", "--surface");
addW("ปุ่มลัดสีส้ม · ข้อความรอง", "--accent-ink", "--accent");

/* 6) ประวัติแต้ม / ของรางวัล */
addW("ไอคอนได้แต้ม", "--ok", "--ok-tint", 3, "ส่วนประกอบ");
addW("ไอคอนแลกของ", "--accent-strong", "--accent-tint", 3, "ส่วนประกอบ");
addW("ไอคอนหมดอายุ", "--ink-3", "--surface-2", 3, "ส่วนประกอบ");
addW("ไอคอนทั่วไปในประวัติ", "--dk-blue-strong", "--dk-sky", 3, "ส่วนประกอบ");
addW("ยอดแต้มที่ได้ (ตัวเลขเขียว)", "--ok", "--surface");
addW("ยอดแต้มที่ใช้ (ตัวเลขแดง)", "--danger", "--surface");
addW("ยอดแต้มหมดอายุ (ตัวเลขเทา)", "--ink-3", "--surface");
addW("ป้าย 'แลกได้เลย'", "--on-brand", "--ok");
addW("ป้าย 'หมดชั่วคราว'", "--on-brand", "--ink-2");
addW("ราคาแต้ม (แต้มไม่พอ)", "--warn", "--warn-tint");
addW("ราคาแต้ม (แต้มพอ)", "--ok", "--ok-tint");
addW("เลขข้อในเงื่อนไข", "--on-brand", "--dk-blue");
addW("แท็บที่เลือกอยู่", "--dk-blue", "--surface");
addW("ยอดแต้มคงเหลือหน้าของรางวัล", "--ink", "--surface");
addW("ไอคอนดาวหน้าของรางวัล", "--accent-strong", "--surface", 3, "ส่วนประกอบ");

/* 7) c2 — กล่องใหม่ */
addW("กล่องวันเกิด · หัวข้อ (lf-note--gift)", "--accent-strong", "--accent-tint");
addW("กล่องวันเกิด · ตัวเลขแต้ม", "--ink", "--accent-tint");
addW("แถบข้างกล่องวันเกิดกับพื้นกล่อง", "--accent", "--accent-tint", 1.2, "เส้นตกแต่ง — ขอบเขตกล่องมาจากพื้นส้มอ่อนกับพื้นหน้า + ไอคอน");
addW("กล่องยืนยันแลก · ข้อความรอง (lf-confirm)", "--ink-2", "--accent-tint");
addW("กล่องยืนยันแลก · ตัวเลข", "--ink", "--accent-tint");
addW("ยืนยันตัวตนสำเร็จ · ข้อความ (lf-note--welcome)", "--ink", "--ok-tint");
addW("ตอนนี้คุณได้แล้ว (lf-perknow)", "--ok", "--ok-tint");
addW("ระดับลดชั่วคราว · กล่องฟ้า (lf-note--info)", "--dk-blue-strong", "--dk-sky");
addW("ไอคอนเค้กในสิทธิ์", "--accent-strong", "--surface", 3, "ส่วนประกอบ");
addW("หัวข้อ 'ซื้อของได้ตามปกติ' (lf-meanwhile)", "--ok", "--surface");

/* 8) r5 — คู่สีของงานขัดรอบ 5 */
addW("เบอร์ผิดใต้ช่องกรอก (lf-field-err)", "--danger", "--surface");
addW("ขอบช่องกรอกที่ผิด (lf-input--bad)", "--danger", "--surface", 3, "ส่วนประกอบ");
addW("ป้าย 'รอยืนยัน' บนบัตรย่อจอสมัครสำเร็จ", "--warn", "--warn-tint");
addW("ข้อความรองบนบัตรย่อจอสมัครสำเร็จ", "--ink-2", "--surface");
addW("ป้าย 'ข้อมูลล่าสุดที่บันทึกไว้' บนบัตรที่จำไว้", "--ink", "--surface");
addW("แถบ 'ระดับพักไว้' หน้าของรางวัล · ข้อความ", "--ink-2", "--surface");
addW("แถบ 'ระดับพักไว้' · ขอบเส้นประกับพื้นขาว", "--line-strong", "--surface", 3, "ส่วนประกอบ");
addW("แถบ 'ระดับพักไว้' · ขอบเส้นประกับพื้นหน้า", "--line-strong", "--bg", 3, "ส่วนประกอบ");
addW("ของรางวัลแต้มไม่พอ · ชื่อ (สีเต็ม)", "--ink", "--surface");
addW("ของรางวัลแต้มไม่พอ · ตัวเลขแต้ม/แถบ", "--ink-3", "--surface");
addW("แถบคืบหน้าของรางวัล · สีเทากับราง", "--ink-3", "--line", 3, "ส่วนประกอบ");
addW("ของหมด · ข้อความรอง", "--ink-2", "--surface");
addW("คำขอรอรับของ · ราวอำพันกับพื้นขาว", "--warn", "--surface", 3, "ส่วนประกอบ — ราวซ้าย 4px");
addW("ปุ่มลัดที่รอยืนยัน · ไอคอน", "--ink-3", "--surface", 3, "ส่วนประกอบ");
addW("ปุ่มลัดที่รอยืนยัน · ข้อความรอง", "--ink-2", "--surface");
addW("ปุ่มลองใหม่แบบรอง (lf-problem-retry)", "--dk-blue-strong", "--surface");
addW("ข้อผิดพลาดในกล่องยืนยันแลก (lf-msg.err)", "--danger", "--danger-tint");
// เส้นประบัตรที่จำไว้ ใช้ --card-ink-2 ซึ่งตรวจ ≥ 4.5:1 กับทุกจุดของไล่สีในข้อ 1 แล้ว

/* 9) r6 — บัตรพักระดับ (ม่านจาง) · ป้ายพักระดับ · รอรับของ · ปุ่มลัดล็อก · ของหมด · ชิป */
for (const [tier, { ink }] of Object.entries(TIER_GRADS)) {
  const sc = INK[ink];
  const veil = W(ink === "light" ? "--card-l-rest-veil" : "--card-d-rest-veil");
  if (!veil) continue;
  for (const bed0 of cardBackdrops(tier)) {
    const bed = over(veil, bed0);
    add(`บัตรพักระดับ ${tier} · ตัวอักษรบนม่าน`, val("--card-ink", sc), bed);
    add(`บัตรพักระดับ ${tier} · ข้อความรองบนม่าน`, val("--card-ink-2", sc), bed);
    const well = over(val("--card-well", sc), bed);
    add(`บัตรพักระดับ ${tier} · ข้อความในกล่องแต้ม`, val("--card-ink-2", sc), well);
    add(`บัตรพักระดับ ${tier} · ป้ายพักระดับกับพื้นบัตร`, W("--warn-line"), bed, 1.2, "ขอบตกแต่ง — ป้ายแยกด้วยพื้นอำพันทึบ");
  }
}
addW("ป้าย พักระดับ บนบัตร (อำพัน)", "--warn", "--warn-tint");
if (W("--card-l-edge")) {
  for (const s0 of TIER_GRADS.Welcome ? TIER_GRADS.Welcome.stops : []) add("ขอบจางบัตร Welcome กับพื้นบัตร", over(W("--card-l-edge"), s0), s0, 1.2, "เส้นตกแต่ง — แยกบัตรออกจากหัวน้ำเงิน");
}
addW("ปุ่มลัดล็อก · ชื่อบนพื้นเทาอ่อน", "--ink-2", "--surface-2");
addW("ปุ่มลัดล็อก · ไอคอนบนพื้นเทาอ่อน", "--ink-3", "--surface-2", 3, "ส่วนประกอบ");
addW("ป้าย หมดชั่วคราว / ยืนยันตัวตนก่อนแลก (เทา)", "--ink-2", "--surface-2");
addW("ของรางวัลหมด · ชื่อบนพื้นเทาอ่อน", "--ink-2", "--surface-2");
addW("ของรางวัลหมด · ป้าย หมดชั่วคราว บนพื้น --line", "--ink-2", "--line");
addW("ป้ายกุญแจของรางวัล · ไอคอน", "--ink-2", "--surface-2", 3, "ส่วนประกอบ");
addW("แถบระดับพักไว้หน้าของรางวัล (อำพันทึบ)", "--ink", "--warn-tint");
addW("แถบระดับพักไว้ · ราวซ้าย", "--warn", "--warn-tint", 3, "ส่วนประกอบ — ราวซ้าย 4px");

/* 10) r7 — ป้ายระดับแบบกรอบตอนพักระดับ · ป้ายกุญแจที่มุมไอคอนปุ่มลัด · ปุ่มลัดล็อกพื้นขาว */
for (const [tier, { ink }] of Object.entries(TIER_GRADS)) {
  const sc = INK[ink];
  const veil = W(ink === "light" ? "--card-l-rest-veil" : "--card-d-rest-veil");
  if (!veil) continue;
  for (const bed0 of cardBackdrops(tier)) {
    const bed = over(veil, bed0);
    add(`บัตรพักระดับ ${tier} · ป้ายระดับแบบกรอบ (ตัวอักษร)`, val("--card-ink-2", sc), bed);
    add(`บัตรพักระดับ ${tier} · ป้ายระดับแบบกรอบ (เส้นกรอบ)`, val("--card-ink-2", sc), bed, 3, "ส่วนประกอบ");
  }
}
addW("ปุ่มลัดล็อก · ป้ายกุญแจ (ไอคอนขาวบนวงเข้ม)", "--surface", "--ink", 3, "ส่วนประกอบ");
addW("ปุ่มลัดล็อก · ป้ายกุญแจกับพื้นปุ่ม", "--ink", "--surface", 3, "ส่วนประกอบ");
addW("ปุ่มลัดล็อก · ชื่อบนพื้นขาว", "--ink", "--surface");

/* ── ไฟล์สไตล์แยก app/liff/styles/*.css ──────────────────────────
 * สีดิบ (#hex / rgb()) ต้องประกาศเป็นตัวแปร --lf-* เท่านั้น และตัวแปรที่เป็นพื้นต้องมีคู่ตรวจด้านล่าง
 * ใช้ตัวอื่นที่ไม่รู้จัก → ตก (กันเพิ่มสีใหม่โดยไม่มีใครวัดคอนทราสต์) */
const STYLE_DIR = path.join(ROOT, "app/liff/styles");
const STYLE_VARS = {};
const rawColorFails = [];
for (const f of fs.existsSync(STYLE_DIR) ? fs.readdirSync(STYLE_DIR).filter(n => n.endsWith(".css")) : []) {
  const text = fs.readFileSync(path.join(STYLE_DIR, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const line of text.split(/\r?\n/)) {
    if (!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(line)) continue;
    const m = line.match(/^\s*(--lf-[\w-]+)\s*:\s*([^;]+);/);
    if (m) STYLE_VARS[m[1]] = m[2].trim();
    else rawColorFails.push(f + ": " + line.trim());
  }
}
const KNOWN_STYLE_COLORS = new Set(["--lf-rw-off-bg"]);
for (const k of Object.keys(STYLE_VARS)) if (!KNOWN_STYLE_COLORS.has(k)) rawColorFails.push("ตัวแปรสีใหม่ยังไม่มีคู่ตรวจ: " + k);
if (STYLE_VARS["--lf-rw-off-bg"]) {
  const offBg = parseColor(STYLE_VARS["--lf-rw-off-bg"]);
  const ink2 = W("--ink-2");
  if (ink2) add("ของรางวัลแลกไม่ได้ · ตัวอักษรปุ่ม (lf-rw-off-bg)", ink2, offBg);
}

/* ── สรุป ─────────────────────────────────────────────────────── */
const rows = checks.map(c => ({ ...c, r: ratio(c.fg, c.bg) }));
// ยุบให้เหลือค่าแย่สุดของแต่ละจุด (บัตรมีหลายจุดสี)
const worst = new Map();
for (const r of rows) {
  const k = r.where;
  if (!worst.has(k) || worst.get(k).r > r.r) worst.set(k, r);
}
const list = [...worst.values()];
const fails = list.filter(r => r.r < r.min);

const pad = (s, n) => s + " ".repeat(Math.max(0, n - [...s].length));
console.log(BEFORE ? "— คอนทราสต์ ก่อนซ่อม —" : "— คอนทราสต์ ปัจจุบัน —");
for (const r of list) {
  const ok = r.r >= r.min;
  console.log(`${ok ? "✅" : "❌"} ${pad(r.where, 54)} ${pad(fmt(r.r), 9)} ต้อง ≥ ${r.min}:1 ${r.note}`);
}
console.log(`\nตรวจ ${list.length} จุด · ผ่าน ${list.length - fails.length} · ตก ${fails.length}`);
for (const r of rawColorFails) console.log("❌ สีดิบในไฟล์สไตล์: " + r);
if (!BEFORE && (fails.length || rawColorFails.length)) process.exit(1);
