// วนขัดหน้าสมาชิกอัตโนมัติ: ถ่ายภาพ → Codex ตรวจ (นักออกแบบ / ลูกค้า / เทียบคู่แข่งแบบปิดชื่อ) → Codex แก้ → วนซ้ำ
//   node scripts/polish-loop.mjs [--rounds 6] [--start 1]
// หยุดเมื่อผ่านสองรอบติด หรือครบจำนวนรอบ · ผลอยู่ที่ review/polish/summary.json และ review/polish/loop.log
// ต้องเปิด dev server ที่ http://localhost:3100 ไว้ก่อน · ไม่แตะฐานข้อมูลจริง ไม่ส่ง LINE (ใช้โหมดรีวิวล้วน)
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { chromium } from "playwright";

const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; };
const ROUNDS = Number(arg("rounds", "6"));
const START = Number(arg("start", "1"));
const ROOT = process.cwd();
const OUT = path.join(ROOT, "review", "polish");
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, "loop.log");
const log = (m) => { const line = `[${new Date().toLocaleString("th-TH")}] ${m}`; console.log(line); fs.appendFileSync(LOG, line + "\n"); };

const SECRET = (fs.readFileSync(".env.local", "utf8").match(/^REVIEW_SECRET=(.+)$/m) || [])[1]?.trim();
const BASE = "http://localhost:3100";
const CODEX = (() => {
  const base = "C:/Users/Win11x64/.vscode/extensions";
  const dir = fs.readdirSync(base).filter(d => d.startsWith("openai.chatgpt-")).sort().pop();
  return path.join(base, dir, "bin/windows-x86_64/codex.exe");
})();

// คู่เทียบแบบปิดชื่อ: หน้าของเรา (ถ่ายเฉพาะครึ่งบนที่เห็นทันที ขนาดเดียวกับภาพคู่แข่ง) กับหน้าชนิดเดียวกันของคู่แข่ง
const BLIND = [
  { key: "pitch", ours: { path: "/liff", as: "new" }, rivals: ["homepro/pitch-viewport.png", "dohome/pitch-viewport.png", "globalhouse/pitch-viewport.png", "scghome/pitch-viewport.png"] },
  { key: "rewards", ours: { path: "/liff/rewards", as: "gold2300" }, rivals: ["homepro/rewards-viewport.png", "dohome/rewards-viewport.png", "globalhouse/rewards-viewport.png", "scghome/rewards-viewport.png"] },
];

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024, timeout: 45 * 60 * 1000, shell: false, ...opts });
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || "") };
}

async function viewportShot(page, route, as, dest) {
  await page.goto(`${BASE}${route}?review=${encodeURIComponent(SECRET)}&as=${as}`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: dest, fullPage: false });
}

import { spawn } from "node:child_process";
function codexReview(round, piece, role, shots) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["scripts/codex-review.mjs", "--round", `polish/${round}`, "--piece", piece, "--role", role, "--shots", shots.join(",")], { stdio: "ignore" });
    const done = () => { try { resolve(JSON.parse(fs.readFileSync(path.join(ROOT, "review", "polish", round, "codex", `${piece}-${role}.json`), "utf8")).result); } catch { resolve(null); } };
    p.on("exit", done); p.on("error", done);
  });
}

const summary = fs.existsSync(path.join(OUT, "summary.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "summary.json"), "utf8")) : { rounds: [] };
let streak = 0;

for (let n = START; n < START + ROUNDS; n++) {
  const round = `p${n}`;
  log(`===== รอบ ${round} =====`);

  // 1) ถ่ายภาพทุกสถานการณ์ (ของเดิม) + ภาพครึ่งบนสำหรับเทียบคู่แข่ง + จอแคบ 320px
  const shot = run(process.execPath, ["scripts/review-shots.mjs", "--round", `polish/${round}`, "--as", "new,gold2300,pending,bronze120"]);
  log("ถ่ายภาพ: " + (shot.out.match(/ถ่ายได้[^\n]*/) || ["ไม่ทราบผล"])[0]);
  const dir = path.join(OUT, round);
  const blindDir = path.join(dir, "blind");
  fs.mkdirSync(blindDir, { recursive: true });
  const browser = await chromium.launch();
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, locale: "th-TH" });
  const small = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, locale: "th-TH" });
  const p1 = await phone.newPage(), p2 = await small.newPage();
  for (const b of BLIND) await viewportShot(p1, b.ours.path, b.ours.as, path.join(blindDir, `ours-${b.key}.png`));
  await p2.goto(`${BASE}/liff?review=${encodeURIComponent(SECRET)}&as=gold2300`, { waitUntil: "networkidle" });
  const hist = p2.getByRole("button", { name: /ประวัติแต้ม/ });
  if (await hist.count()) { await hist.first().click(); await p2.waitForTimeout(900); }
  await p2.screenshot({ path: path.join(dir, "narrow-320-history.png"), fullPage: true });
  await p2.goto(`${BASE}/liff/rewards?review=${encodeURIComponent(SECRET)}&as=gold2300`, { waitUntil: "networkidle" });
  await p2.screenshot({ path: path.join(dir, "narrow-320-rewards.png"), fullPage: false });
  await browser.close();

  const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
  const S = (s) => `review/polish/${round}/${s}`;

  // 2) ตรวจ: นักออกแบบ + ลูกค้า
  const designerP = codexReview(round, "D", "designer", [S("gold2300/liff-mobile.png"), S("gold2300/liff-desktop.png"), S("new/liff-mobile.png"), rel(path.join(dir, "narrow-320-history.png"))]);
  const customerP = codexReview(round, "C", "customer", [S("new/liff-mobile.png"), S("gold2300/liff-mobile.png"), S("gold2300/rewards-mobile.png")]);

  // 3) เทียบคู่แข่งแบบปิดชื่อ — ชื่อไฟล์เป็นกลาง สลับซ้ายขวาตามรอบ · หมุนคู่แข่งตามรอบ
  const blindJobs = [];
  for (const [bi, b] of BLIND.entries()) {
    for (let j = 0; j < 2; j++) {
      const rival = b.rivals[(n + j) % b.rivals.length];
      const oursFirst = (n + bi + j) % 2 === 0;
      const x1 = path.join(blindDir, `${b.key}-${j}-x1.png`), x2 = path.join(blindDir, `${b.key}-${j}-x2.png`);
      const oursPng = path.join(blindDir, `ours-${b.key}.png`), rivalPng = path.join(ROOT, "docs/benchmarks", rival);
      fs.copyFileSync(oursFirst ? oursPng : rivalPng, x1);
      fs.copyFileSync(oursFirst ? rivalPng : oursPng, x2);
      const oursLetter = oursFirst ? "A" : "B";
      blindJobs.push(codexReview(round, `B-${b.key}-${j}`, "blind", [rel(x1), rel(x2)]).then(r => {
        const won = r ? String(r.winner || "").trim().toUpperCase().startsWith(oursLetter) : false;
        return { page: b.key, rival: rival.split("/")[0], won, margin: r?.margin ?? null, gap: won ? null : (r?.loser_biggest_gap ?? null), why: r?.why ?? null };
      }));
    }
  }
  const [designer, customer, ...blind] = await Promise.all([designerP, customerP, ...blindJobs]);

  const scores = designer?.scores ? Object.values(designer.scores).map(Number) : [];
  const dMin = scores.length ? Math.min(...scores) : 0;
  const cPass = customer ? [customer.understand_offer, customer.would_sign_up, customer.would_come_back].every(v => v === true) : false;
  const wins = blind.filter(b => b.won).length;
  const passed = dMin >= 8 && cPass && wins >= 3;
  const rec = { round, dMin, designer: designer?.scores ?? null, designerGap: designer?.biggest_gap ?? null, customerPass: cPass, customerHesitation: customer?.hesitation ?? null, blindWins: `${wins}/${blind.length}`, blind, passed };
  summary.rounds.push(rec);
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  log(`ผล: นักออกแบบต่ำสุด ${dMin} · ลูกค้า ${cPass ? "ผ่าน" : "ไม่ผ่าน"} · ชนะคู่แข่ง ${wins}/${blind.length} → ${passed ? "ผ่าน" : "ยังไม่ผ่าน"}`);

  if (passed) { streak++; if (streak >= 2) { log("ผ่านสองรอบติด — จบ"); break; } } else streak = 0;
  if (n === START + ROUNDS - 1) { log("ครบจำนวนรอบ — จบ"); break; }

  // 4) Codex แก้ตามช่องว่าง
  const brief = `คุณกำลังขัดหน้าระบบสมาชิกของร้านวัสดุก่อสร้าง DK Steel and Tools ในโปรเจกต์ ${ROOT} (Next.js, branch member-polish)
ลูกค้าคือช่างรับเหมาชาย 35-50 ปี เปิดใน LINE บนมือถือ Android ยืนหน้าเคาน์เตอร์ มีคนต่อคิว แดดส่อง

กติกาเด็ดขาด:
- แก้ได้เฉพาะ app/liff/** เท่านั้น (รวม app/liff/liff.css) ห้ามแตะไฟล์อื่น
- ห้ามเปลี่ยนตัวเลขกติกาแต้ม/ส่วนลด/ระดับ และห้ามเขียนสิทธิ์ที่ระบบไม่มีจริง (ตัวเลขต้องมาจาก lib/tierRules.ts, lib/points.ts, app/liff/lib/perks.ts)
- ห้ามแสดงรหัสลูกค้า/ยอดบิลของคนที่ยังไม่ยืนยันตัวตน (tests/client-privacy.test.mjs ต้องผ่าน)
- ห้าม git commit/push ห้ามต่อฐานข้อมูลจริง ห้ามส่ง LINE
- ห้ามรื้อสิ่งที่ผู้ตรวจบอกว่าดีอยู่แล้ว

ข้อเท็จจริงของระบบ (เปลี่ยนไม่ได้ แต่ต้องสื่อให้ลูกค้าเข้าใจและรู้สึกว่าง่าย):
- ยืนยันตัวตนทำครั้งเดียว ตอนมาซื้อครั้งแรก บอกเบอร์แคชเชียร์ พนักงานกดยืนยันไม่กี่วินาที (กันคนสวมเบอร์เอาแต้มคนอื่น)
- ไม่เสียแต้มระหว่างรอ: บิลตั้งแต่วันสมัครได้แต้มย้อนหลังอัตโนมัติ (ไม่เกิน 30 วัน) หลังยืนยัน
- ทุกครั้งที่ซื้อ แคชเชียร์ต้องรู้ว่าเป็นใคร (บอกเบอร์ หรือยื่นหน้าบัตรสมาชิกให้ดู) แต้มถึงจะเข้า — ทำให้การ "ยื่นหน้าจอให้แคชเชียร์ดู" ง่ายและชัด
- เงื่อนไขของรางวัลแต่ละชิ้นต้องอ่านเข้าใจก่อนกด (เช่น ขั้นต่ำการใช้)

ผลตรวจรอบ ${round} (ผู้ตรวจดูภาพจริงล้วน ๆ):
[นักออกแบบ] คะแนน ${JSON.stringify(designer?.scores ?? {})}
ช่องว่างใหญ่สุด: ${designer?.biggest_gap ?? "-"} (ตรงไหน: ${designer?.gap_location ?? "-"})
ปัญหารอง: ${(designer?.other_issues ?? []).join(" · ")}
ดีอยู่แล้ว ห้ามรื้อ: ${(designer?.what_works ?? []).join(" · ")}
[ลูกค้า] ลังเลเพราะ: ${customer?.hesitation ?? "-"} · คำที่ไม่เข้าใจ: ${(customer?.confusing_words ?? []).join(", ")} · อยากรู้แต่ไม่บอก: ${(customer?.missing_info ?? []).join(", ")}
[เทียบคู่แข่งแบบปิดชื่อ ${wins}/${blind.length} ชนะ] เหตุที่แพ้:
${blind.filter(b => !b.won).map(b => `- หน้า ${b.page}: ${b.gap ?? b.why ?? "-"}`).join("\n") || "- ไม่มี"}
${n === START ? `
งานค้างที่ต้องแก้ในรอบนี้ด้วย (ผู้ตรวจรอบก่อนพบ):
- จอแคบ 320px (ดู ${rel(path.join(dir, "narrow-320-history.png"))}): ชื่อรายการประวัติแต้มถูกตัดสั้นจนอ่านไม่รู้เรื่อง ให้ใช้พื้นที่ดีขึ้น (เช่น ย่อเลขบิลไปบรรทัดรอง) · แท็บ "หมดอายุ" ห้ามขึ้นบรรทัดกลางคำ
- หัวหน้าของรางวัลบนจอ 390px ถูกตัดเป็น "DK STEEL AND TO..." (ดู ${rel(path.join(dir, "narrow-320-rewards.png"))})` : ""}

วิธีทำ: แก้ช่องว่างใหญ่สุดของนักออกแบบก่อน แล้วเหตุที่แพ้คู่แข่ง แล้วค่อยเรื่องอื่น
ต้องผ่านก่อนจบ: npx.cmd tsc --noEmit · npm.cmd test · node scripts/check-tiers.mjs · node scripts/check-contrast.mjs
ตรวจงานตัวเองด้วย node scripts/review-shots.mjs --round polish/${round}-self แล้วเปิดดูอย่างน้อย 4 ภาพ
สรุปท้ายงานสั้น ๆ เป็นภาษาไทย: แก้อะไร ผลคำสั่งตรวจ`;
  fs.writeFileSync(path.join(dir, "fix-brief.md"), brief);
  log("ส่ง Codex แก้...");
  let fixOut = "";
  try {
    fixOut = execFileSync(CODEX, ["exec", "-C", ROOT, "-s", "workspace-write", "-c", "sandbox_workspace_write.network_access=true", "-c", "model_reasoning_effort=high", "-"],
      { input: brief, encoding: "utf8", maxBuffer: 50 * 1024 * 1024, timeout: 60 * 60 * 1000 });
  } catch (e) { fixOut = String(e.stdout || "") + "\n[ERR] " + String(e.message).slice(0, 300); }
  fs.writeFileSync(path.join(dir, "fix.log"), fixOut);

  // ด่านกันพัง: ถ้า Codex ทำให้เทสต์/ชนิดข้อมูลพัง ให้หยุดทันที ไม่วนต่อบนของที่พัง
  const tsc = run("npx.cmd", ["tsc", "--noEmit"], { shell: true });
  const test = run("npm.cmd", ["test"], { shell: true });
  const touched = run("git", ["status", "--porcelain"]).out.split("\n").filter(l => l.trim() && !/ app\/liff\/| review\/| scripts\/polish-loop\.mjs/.test(l) && !/^\?\? (review|debug)/.test(l));
  log(`หลังแก้: tsc ${tsc.ok ? "ผ่าน" : "พัง"} · test ${test.ok ? "ผ่าน" : "พัง"} · ไฟล์นอกขอบเขต ${touched.length}`);
  if (!tsc.ok || !test.ok) { log("หยุด: หลังแก้ตรวจไม่ผ่าน"); break; }
  if (touched.length) log("เตือน: มีไฟล์นอก app/liff ถูกแก้ → " + touched.join(" | "));
}
log("จบการวน");
