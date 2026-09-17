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

// สถานการณ์อ่านตรงจาก lib/review-mode.ts ทุกครั้ง (16 ก.ย. 69) — เดิมพิมพ์รายการเอง ตกหล่น reserved และ fail_* ทั้งหมด
const REVIEW_TS = fs.readFileSync("lib/review-mode.ts", "utf8");
const dataBlock = REVIEW_TS.slice(REVIEW_TS.indexOf("SCENARIO_DATA"));
const SCENARIOS = [...new Set([...dataBlock.matchAll(/^\s*key:\s*"([\w-]+)"/gm)].map(m => m[1]))];
if (SCENARIOS.length < 5) { console.error("❌ อ่านรายการสถานการณ์จาก lib/review-mode.ts ไม่ได้"); process.exit(1); }
const ONLY_AS = arg("as", "");   // --as pending,fail_db,x_offline ถ่ายเฉพาะบางสถานการณ์
const pick = key => !ONLY_AS || ONLY_AS.split(",").includes(key);
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
    if (!pick(scenario)) continue;
    for (const pg of PAGES) {
      if (ONLY && pg.key !== ONLY) continue;
      const page = await ctx.newPage();
      const consoleErrors = [];
      // fail_* ตั้งใจให้ API ตอบ 4xx/5xx — เบราว์เซอร์จะ log "Failed to load resource" เอง ไม่ใช่บั๊กหน้าเว็บ
      const expectHttpFail = scenario.startsWith("fail_");
      page.on("console", m => { if (m.type() === "error" && !(expectHttpFail && m.text().startsWith("Failed to load resource"))) consoleErrors.push(m.text().slice(0, 300)); });
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
          const btn = page.getByRole("button", { name: /^แลก$/ });
          if (await btn.count()) {
            await btn.first().click();
            await page.waitForTimeout(400);
            // กดแลกแล้วต้องมีกล่องยืนยันก่อน — ถ่ายไว้ 1 ภาพ แล้วกดยืนยันเพื่อดูผล
            const cf = page.getByRole("button", { name: /ยืนยันแลก/ });
            if (await cf.count()) {
              const dc = await shoot(ctx, page, path.join(OUT, scenario, `${pg.key}-${view.key}-confirm.png`));
              index.shots.push({ scenario, page: pg.key + ":confirm", view: view.key, file: path.relative(process.cwd(), dc), text: "", consoleErrors });
              await cf.first().click();
            }
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
  // ── ภาพพิเศษที่สถานการณ์จำลองฝั่งเซิร์ฟเวอร์ทำไม่ได้ (ดักคำขอในเบราว์เซอร์) ──
  const extras = [
    // บัตรขึ้นปกติ แต่ประวัติแต้มล้ม → กล่องประวัติต้องบอกว่าโหลดไม่ได้ ไม่ใช่ "ยังไม่มีรายการ"
    {
      key: "x_history_fail", scenario: "bronze120", path: "/liff", route: "**/api/member/transactions**",
      fulfill: { status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "DB_UNAVAILABLE", error: "ระบบสมาชิกขัดข้องชั่วคราว" }) },
      after: async page => { await page.getByRole("button", { name: /ประวัติแต้ม/ }).first().click(); await page.waitForTimeout(900); },
    },
    // เน็ตหลุด (fetch ล้มเอง) → จอเดียวกับระบบล่ม แต่บอกให้เช็คอินเทอร์เน็ต
    { key: "x_offline", scenario: "bronze120", path: "/liff", route: /\/api\/member\?/, abort: true },
    { key: "x_offline", scenario: "bronze120", path: "/liff/rewards", route: "**/api/liff/redeem**", abort: true },
    // หลังกดสมัครเสร็จ ต้องพาไปจอ "รอพนักงานยืนยันตัวตน" ทันที
    {
      key: "x_after_signup", scenario: "new", path: "/liff",
      after: async page => {
        // คนเดียวกับสถานการณ์ pending/linkedNew (ช่างสมชาย) — ผู้ตรวจเดินทั้งเส้นทาง ชื่อต้องต่อกัน
        await page.getByPlaceholder("ชื่อจริง").fill("สมชาย");
        await page.getByPlaceholder("นามสกุล").fill("ใจดี");
        await page.getByPlaceholder("08X XXX XXXX").fill("0812345678");
        const sels = page.locator(".lf-date select");
        if (await sels.count() === 3) {
          for (let i = 0; i < 3; i++) {
            const vals = await sels.nth(i).locator("option").evaluateAll(os => os.map(o => o.value).filter(Boolean));
            if (vals.length) await sels.nth(i).selectOption(vals[Math.min(5, vals.length - 1)]);
          }
        }
        await page.getByRole("button", { name: /สมัครสมาชิกฟรี/ }).click();
        await page.waitForTimeout(1200);
      },
    },
  ];
  for (const x of extras) {
    if (!pick(x.key)) continue;
    const pgKey = x.path.endsWith("rewards") ? "rewards" : "liff";
    if (ONLY && pgKey !== ONLY) continue;
    const page = await ctx.newPage();
    try {
      if (x.route) await page.route(x.route, r => (x.abort ? r.abort("internetdisconnected") : r.fulfill(x.fulfill)));
      await page.goto(url(x.path, x.scenario), { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(700);
      if (x.after) await x.after(page);
      const dest = path.join(OUT, x.key, `${pgKey}-${view.key}.png`);
      await shoot(ctx, page, dest);
      const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400);
      index.shots.push({ scenario: x.key, page: pgKey, view: view.key, file: path.relative(process.cwd(), dest), text: bodyText, consoleErrors: [] });
    } catch (e) {
      index.errors.push({ scenario: x.key, page: pgKey, view: view.key, error: String(e).slice(0, 300) });
    } finally {
      await page.close();
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
