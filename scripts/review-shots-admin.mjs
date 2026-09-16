import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const base = arg("base", "http://localhost:3100");
const round = arg("round", "a1");
const out = path.resolve("review", round);
const env = fs.readFileSync(".env.local", "utf8");
const secret = (env.match(/^REVIEW_SECRET=(.+)$/m) || [])[1]?.trim();
if (!secret) throw new Error("ไม่พบ REVIEW_SECRET ใน .env.local");

const views = [
  { key: "mobile", options: { ...devices["Pixel 7"], locale: "th-TH", timezoneId: "Asia/Bangkok" } },
  { key: "desktop", options: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: "th-TH", timezoneId: "Asia/Bangkok" } },
];
const screens = [
  { key: "overview", tab: "ภาพรวม" },
  { key: "members", tab: "สมาชิก" },
  { key: "redemptions", tab: "คำขอแลกของ" },
];
const index = { round, base, shots: [], errors: [] };
const browser = await chromium.launch();

for (const view of views) {
  const context = await browser.newContext(view.options);
  for (const screen of screens) {
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    try {
      await page.goto(`${base}/admin?review=${encodeURIComponent(secret)}`, { waitUntil: "networkidle", timeout: 45_000 });
      await page.getByRole("button", { name: new RegExp(screen.tab) }).click();
      await page.waitForTimeout(500);
      fs.mkdirSync(out, { recursive: true });
      const file = path.join(out, `admin-${screen.key}-${view.key}.png`);
      await page.screenshot({ path: file, fullPage: true });
      index.shots.push({ screen: screen.key, view: view.key, file: path.relative(process.cwd(), file), consoleErrors });
    } catch (error) {
      index.errors.push({ screen: screen.key, view: view.key, error: String(error) });
    } finally { await page.close(); }
  }
  await context.close();
}
await browser.close();
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "admin-index.json"), JSON.stringify(index, null, 2));
console.log(`ถ่ายหน้าแอดมิน ${index.shots.length} ภาพ · ผิดพลาด ${index.errors.length} · ${out}`);
if (index.errors.length) process.exitCode = 1;
