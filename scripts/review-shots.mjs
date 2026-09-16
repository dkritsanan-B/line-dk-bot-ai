// ถ่ายภาพหน้าจอระบบสมาชิกทุกสถานการณ์ ให้ผู้ตรวจดูของจริง (ไม่ใช่อ่านสรุปจากคนสร้าง)
//   node scripts/review-shots.mjs --round r1 [--base http://localhost:3100] [--only liff|rewards]
// ผลลัพธ์: review/<round>/<scenario>/<page>-<mobile|desktop>.png  +  index.json
// ต้องเปิด dev server ไว้ก่อน และ .env.local ต้องมี REVIEW_SECRET
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : dflt; };
const BASE = arg("base", "http://localhost:3100");
const ROUND = arg("round", "r1");
const ONLY = arg("only", "");
const OUT = path.resolve("review", ROUND);

const SECRET = (fs.readFileSync(".env.local", "utf8").match(/^REVIEW_SECRET=(.+)$/m) || [])[1]?.trim();
if (!SECRET) { console.error("❌ ไม่มี REVIEW_SECRET ใน .env.local"); process.exit(1); }

// สถานการณ์ต้องตรงกับ lib/review-mode.ts
const SCENARIOS = ["new", "pending", "unlinked", "waitingBills", "linkedNew", "bronze120", "gold2300", "expiringSmall", "diamond", "inactive", "birthday"];
const PAGES = [
  { key: "liff", path: "/liff", label: "บัตรสมาชิก / สมัครสมาชิก" },
  { key: "rewards", path: "/liff/rewards", label: "ของรางวัล" },
];

// จอมือถือแบบที่ลูกค้าจริงใช้ (Android กลาง ๆ) และเดสก์ท็อป
const VIEWS = [
  { key: "mobile", opts: { ...devices["Pixel 7"], locale: "th-TH", timezoneId: "Asia/Bangkok" } },
  { key: "desktop", opts: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, locale: "th-TH", timezoneId: "Asia/Bangkok" } },
];

const url = (p, scenario) => `${BASE}${p}?review=${encodeURIComponent(SECRET)}&as=${scenario}`;

async function shoot(ctx, page, dest, { full = true } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await page.screenshot({ path: dest, fullPage: full });
  return dest;
}

const index = { round: ROUND, base: BASE, shots: [], errors: [] };
const browser = await chromium.launch();

for (const view of VIEWS) {
  const ctx = await browser.newContext(view.opts);
  for (const scenario of SCENARIOS) {
    for (const pg of PAGES) {
      if (ONLY && pg.key !== ONLY) continue;
      const page = await ctx.newPage();
      const consoleErrors = [];
      page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
      page.on("pageerror", e => consoleErrors.push("pageerror: " + String(e).slice(0, 300)));
      try {
        await page.goto(url(pg.path, scenario), { waitUntil: "networkidle", timeout: 45000 });
        await page.waitForTimeout(700);
        const dest = path.join(OUT, scenario, `${pg.key}-${view.key}.png`);
        await shoot(ctx, page, dest);
        const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400);
        index.shots.push({ scenario, page: pg.key, view: view.key, file: path.relative(process.cwd(), dest), text: bodyText, consoleErrors });

        // ภาพเพิ่มเติม: กดดูประวัติแต้มในหน้าบัตรสมาชิก (สถานะที่ต้องกดถึงจะเห็น)
        if (pg.key === "liff" && scenario !== "new") {
          const btn = page.getByRole("button", { name: /ประวัติแต้ม/ });
          if (await btn.count()) {
            await btn.first().click();
            await page.waitForTimeout(900);
            const d2 = path.join(OUT, scenario, `${pg.key}-${view.key}-history.png`);
            await shoot(ctx, page, d2);
            index.shots.push({ scenario, page: pg.key + ":history", view: view.key, file: path.relative(process.cwd(), d2), text: "", consoleErrors });
          }
        }
        // ภาพเพิ่มเติม: กดแลกของรางวัลชิ้นแรก เพื่อดูข้อความตอบกลับ (สำเร็จ/แต้มไม่พอ/ของหมด)
        if (pg.key === "rewards" && scenario !== "new") {
          const btn = page.getByRole("button", { name: /แลก/ });
          if (await btn.count()) {
            await btn.first().click();
            await page.waitForTimeout(1200);
            const d3 = path.join(OUT, scenario, `${pg.key}-${view.key}-redeem.png`);
            await shoot(ctx, page, d3);
            index.shots.push({ scenario, page: pg.key + ":redeem", view: view.key, file: path.relative(process.cwd(), d3), text: "", consoleErrors });
          }
        }
      } catch (e) {
        index.errors.push({ scenario, page: pg.key, view: view.key, error: String(e).slice(0, 300) });
      } finally {
        await page.close();
      }
    }
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
console.log(`✅ ถ่ายได้ ${index.shots.length} ภาพ · ผิดพลาด ${index.errors.length} · ที่ ${OUT}`);
for (const e of index.errors) console.log("  ❌", e.scenario, e.page, e.view, e.error);
const withConsole = index.shots.filter(s => s.consoleErrors.length);
if (withConsole.length) console.log(`  ⚠️ มี console error ${withConsole.length} หน้า:`, withConsole.slice(0, 5).map(s => `${s.scenario}/${s.page}`).join(", "));
