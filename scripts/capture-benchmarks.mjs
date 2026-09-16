// แคปหน้าเว็บสมาชิกของร้านคู่แข่ง เก็บเป็นภาพคู่เทียบ (benchmark) สำหรับ blind test
//   node scripts/capture-benchmarks.mjs [--only thaiwatsadu] [--kind tiers]
// ผลลัพธ์: docs/benchmarks/<brand_key>/<page_kind>[-n]-viewport.png และ -full.png + capture-log.json
// หมายเหตุ: แคปเฉพาะหน้าเว็บสาธารณะ ไม่ล็อกอิน ไม่เลี่ยงการบล็อกบอท เว็บไหนบล็อก = ข้ามและบันทึกเหตุผล
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : dflt; };
const ONLY = arg("only", "");
const KIND = arg("kind", "");
const SLUG = arg("slug", "");
const OUT = path.resolve("docs", "benchmarks");
const CAPTURED_AT = "2026-09-16";

const TARGETS = [
  { brand_key: "thaiwatsadu", brand: "ไทวัสดุ", url: "https://www.thaiwatsadu.com/th/page/new-member-get-free-coupon", page_kind: "pitch" },
  { brand_key: "thaiwatsadu", brand: "ไทวัสดุ", url: "https://www.thaiwatsadu.com/th/page/new-register-application-conditions", page_kind: "signup" },
  { brand_key: "thaiwatsadu", brand: "ไทวัสดุ", url: "https://www.thaiwatsadu.com/th/page/members-the1-points-redeem", page_kind: "rewards" },
  { brand_key: "thaiwatsadu", brand: "ไทวัสดุ", url: "https://www.thaiwatsadu.com/th/page/next-purchase-promotion", page_kind: "rewards" },
  { brand_key: "thaiwatsadu", brand: "ไทวัสดุ", url: "https://www.thaiwatsadu.com/th/page/condition_coupon_offline", page_kind: "faq" },
  { brand_key: "thaiwatsadu", brand: "ไทวัสดุ", url: "https://www.thaiwatsadu.com/th/page/affiliate", page_kind: "pitch" },
  { brand_key: "thaiwatsadu", brand: "ไทวัสดุ", url: "https://affiliate.thaiwatsadu.com", page_kind: "signup" },
  { brand_key: "thaiwatsadu", brand: "ไทวัสดุ", url: "https://www.thaiwatsadu.com/th/brochures/CON6-2023", page_kind: "pitch" },
  { brand_key: "thaiwatsadu", brand: "ไทวัสดุ / The 1", url: "https://www.the1.co.th/the1-membership", page_kind: "pitch" },
  { brand_key: "thaiwatsadu", brand: "ไทวัสดุ / The 1", url: "https://www.the1.co.th/the1Exclusive/privileges", page_kind: "tiers" },
  { brand_key: "thaiwatsadu", brand: "ไทวัสดุ / The 1", url: "https://www.the1.co.th/the1app", page_kind: "rewards" },
  { brand_key: "homepro", brand: "HomePro", url: "https://www.homepro.co.th/homecard/", page_kind: "pitch" },
  { brand_key: "homepro", brand: "HomePro / MegaHome", url: "https://www.megahome.co.th/m/homecard/", page_kind: "faq" },
  { brand_key: "homepro", brand: "HomePro / MegaHome", url: "https://www.megahome.co.th/benefit/member.jsp", page_kind: "signup" },
  { brand_key: "homepro", brand: "HomePro / MegaHome", url: "https://www.megahome.co.th/benefit/member-discount.jsp", page_kind: "rewards" },
  { brand_key: "homepro", brand: "HomePro", url: "https://www.homepro.co.th/benefit/member.jsp", page_kind: "signup" },
  { brand_key: "homepro", brand: "HomePro", url: "https://www.homepro.co.th/m/homecard/index.jsp?lang=en", page_kind: "tiers" },
  { brand_key: "homepro", brand: "HomePro", url: "https://static-hp.gumlet.io/campaign/_default/%E0%B8%8A%E0%B9%88%E0%B8%B2%E0%B8%87%E0%B9%83%E0%B8%AB%E0%B8%A1%E0%B9%88%201-30%20%E0%B8%81%E0%B8%A2.png", page_kind: "pitch" },
  { brand_key: "homepro", brand: "HomePro", url: "https://apps.apple.com/th/app/homecard/id1537956163", page_kind: "pitch" },
  { brand_key: "globalhouse", brand: "Global House", url: "https://ecomm.globalhouse.co.th/service/globalclub", page_kind: "tiers" },
  { brand_key: "globalhouse", brand: "Global House", url: "https://campaign.globalhouse.co.th/globalclub/register", page_kind: "signup" },
  { brand_key: "globalhouse", brand: "Global House", url: "https://globalhouse.co.th/articles/globalhouse-pointpay", page_kind: "rewards" },
  { brand_key: "globalhouse", brand: "Global House", url: "https://globalhouse.co.th/globalidea/detail/982", page_kind: "pitch" },
  { brand_key: "globalhouse", brand: "Global House", url: "https://campaign.globalhouse.co.th/reward", page_kind: "faq" },
  { brand_key: "globalhouse", brand: "Global House", url: "https://globalhouse.co.th/globalidea/detail/451", page_kind: "pitch" },
  { brand_key: "globalhouse", brand: "Global House", url: "https://ecomm.globalhouse.co.th/service/faq", page_kind: "faq" },
  { brand_key: "dohome", brand: "Do Home", url: "https://www.dohome.co.th/p/membership-family-services-technician", page_kind: "tiers" },
  { brand_key: "dohome", brand: "Do Home", url: "https://www.dohome.co.th/p/membership-points-condition", page_kind: "rewards" },
  { brand_key: "dohome", brand: "Do Home", url: "https://www.dohome.co.th/p/privilege", page_kind: "pitch" },
  { brand_key: "dohome", brand: "Do Home", url: "https://www.dohome.co.th/p/download-dohome-app", page_kind: "signup" },
  { brand_key: "dohome", brand: "Do Home", url: "https://page.line.me/mfq4602m", page_kind: "signup" },
  { brand_key: "dohome", brand: "Do Home", url: "https://www.dohome.co.th/p/membership-policy", page_kind: "faq" },
  { brand_key: "dohome", brand: "Do Home", url: "https://investor.dohome.co.th/en/updates/activity/270/", page_kind: "pitch" },
  { brand_key: "scghome", brand: "SCG Home", url: "https://scgfamily.com/tiering", page_kind: "tiers" },
  { brand_key: "scghome", brand: "SCG Home", url: "https://scgfamily.com/about-collect-point", page_kind: "pitch" },
  { brand_key: "scghome", brand: "SCG Home", url: "https://scgfamily.com/handbook/1", page_kind: "signup" },
  { brand_key: "scghome", brand: "SCG Home", url: "https://scgfamily.com/handbook/4", page_kind: "rewards" },
  { brand_key: "scghome", brand: "SCG Home", url: "https://scgfamily.com/handbook/3", page_kind: "rewards" },
  { brand_key: "scghome", brand: "SCG Home", url: "https://scgfamily.com/faqs", page_kind: "faq" },
  { brand_key: "scghome", brand: "SCG Home", url: "https://scgfamily.com/term", page_kind: "faq" },
  { brand_key: "scghome", brand: "SCG Home", url: "https://scgfamily.com/promotion", page_kind: "rewards" },
  { brand_key: "scghome", brand: "SCG Home", url: "https://scgfamily.com/store", page_kind: "pitch" },
  { brand_key: "scghome", brand: "SCG Home", url: "https://scgfamily.com/term_cashcard", page_kind: "faq" },
  { brand_key: "scghome", brand: "SCG Home", url: "https://www.scgnewschannel.com/th/scg-news/scg-launches-scg-family-plus-a-major-revamp-of-its-loyalty-program/", page_kind: "pitch" },
];

// brand_key + page_kind ซ้ำกันได้หลาย URL: ตัวแรกใช้ชื่อตรงตามสเปก ตัวถัดไปต่อท้าย -2 -3
const seen = new Map();
for (const t of TARGETS) {
  const key = t.brand_key + "/" + t.page_kind;
  const n = (seen.get(key) || 0) + 1;
  seen.set(key, n);
  t.slug = n === 1 ? t.page_kind : t.page_kind + "-" + n;
}

// มือถือ Android แบบที่ลูกค้าจริง (ช่างรับเหมา) ใช้
const CONTEXT_OPTS = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "th-TH",
  timezoneId: "Asia/Bangkok",
  userAgent: "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
};

// คำบนปุ่มยอมรับคุกกี้/ปิด popup — จับแบบ "มีคำนี้อยู่ในปุ่ม" ไม่ใช่ตรงเป๊ะ
// (dohome ใช้ "ยอมรับคุกกี้", homepro ใช้ "ยอมรับทั้งหมด", บางเว็บ "Accept All Cookies")
const CONSENT_WORDS = ["ยอมรับทั้งหมด", "ยอมรับคุกกี้", "ยอมรับ", "ตกลง", "รับทราบ", "เข้าใจแล้ว", "Accept All Cookies", "Accept All", "Accept", "I agree", "Agree", "Got it", "ปิด"];

async function dismissPopups(page) {
  const clicked = [];
  // แบนเนอร์คุกกี้บางเว็บ (homepro) อยู่ใน iframe ต้องไล่ทุก frame ไม่ใช่แค่หน้าหลัก
  const scopes = [page, ...page.frames()];
  for (const word of CONSENT_WORDS) {
    if (clicked.length >= 3) break;
    const rx = new RegExp("^\\s*" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s!.]*$", "i");
    for (const scope of scopes) {
      try {
        const byRole = scope.getByRole("button", { name: rx });
        if (await byRole.count()) { await byRole.first().click({ timeout: 2500 }); clicked.push(word); await page.waitForTimeout(700); break; }
        const btn = scope.locator("button:visible, a:visible, div[role=button]:visible, span[role=button]:visible").filter({ hasText: rx });
        if (await btn.count()) { await btn.first().click({ timeout: 2500 }); clicked.push(word); await page.waitForTimeout(700); break; }
      } catch { /* ปิดไม่ได้ก็ปล่อยไป จะเห็นเองจากภาพ */ }
    }
  }
  // ปุ่มกากบาทที่ไม่มีข้อความ (popup โฆษณา / modal)
  const closeSel = ['[aria-label*="ปิด"]', '[aria-label*="close" i]', '[aria-label*="dismiss" i]', 'button[class*="close" i]', 'div[class*="modal"] button[class*="close" i]', '.fancybox-close-small', '#onetrust-accept-btn-handler'];
  for (const sel of closeSel) {
    try {
      const el = page.locator(sel + ":visible").first();
      if (await el.count()) { await el.click({ timeout: 2000 }); clicked.push(sel); await page.waitForTimeout(600); }
    } catch { /* ไม่มีก็ข้าม */ }
  }
  try { await page.keyboard.press("Escape"); await page.waitForTimeout(300); } catch { /* ignore */ }
  return clicked;
}

async function capture(ctx, t) {
  const dir = path.join(OUT, t.brand_key);
  fs.mkdirSync(dir, { recursive: true });
  const page = await ctx.newPage();
  const rec = { brand_key: t.brand_key, brand: t.brand, page_kind: t.page_kind, slug: t.slug, url: t.url, files: {}, status: "ok", note: "" };
  try {
    let resp = null;
    try {
      resp = await page.goto(t.url, { waitUntil: "networkidle", timeout: 45000 });
    } catch (e) {
      // networkidle ไม่นิ่ง (analytics/โฆษณายิงตลอด) ลองใหม่แบบ domcontentloaded
      rec.note = "networkidle ไม่นิ่งใน 45 วิ ใช้ domcontentloaded แทน";
      resp = await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    }
    rec.http_status = resp ? resp.status() : null;
    await page.waitForTimeout(2000);
    rec.dismissed = await dismissPopups(page);
    await page.waitForTimeout(800);
    rec.title = (await page.title().catch(() => "")).slice(0, 160);

    const vp = path.join(dir, t.slug + "-viewport.png");
    await page.screenshot({ path: vp, fullPage: false });
    rec.files.viewport = path.relative(process.cwd(), vp).replace(/\\/g, "/");

    // เลื่อนลงให้รูป lazy-load โหลดก่อนแคปทั้งหน้า แล้วกลับขึ้นบนสุด
    try {
      await page.evaluate(async () => {
        const step = window.innerHeight;
        const max = Math.min(document.body ? document.body.scrollHeight : 0, 30000);
        for (let y = 0; y < max; y += step) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 250)); }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1200);
    } catch { /* หน้าที่เป็นรูปเดี่ยวเลื่อนไม่ได้ ข้าม */ }

    const fp = path.join(dir, t.slug + "-full.png");
    await page.screenshot({ path: fp, fullPage: true });
    rec.files.full = path.relative(process.cwd(), fp).replace(/\\/g, "/");

    const text = await page.locator("body").innerText().catch(() => "");
    rec.text_head = text.replace(/\s+/g, " ").trim().slice(0, 400);
    rec.text_length = text.replace(/\s+/g, "").length;
    if (rec.http_status && rec.http_status >= 400) { rec.status = "http_error"; rec.note = (rec.note ? rec.note + " · " : "") + "HTTP " + rec.http_status; }
  } catch (e) {
    rec.status = "failed";
    rec.note = String(e).split("\n")[0].slice(0, 220);
  } finally {
    await page.close().catch(() => {});
  }
  return rec;
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext(CONTEXT_OPTS);
const list = TARGETS.filter(t => (!ONLY || t.brand_key === ONLY) && (!KIND || t.page_kind === KIND) && (!SLUG || t.slug === SLUG));
const results = [];
let i = 0;
for (const t of list) {
  i++;
  const rec = await capture(ctx, t);
  results.push(rec);
  console.log("[" + i + "/" + list.length + "] " + (rec.status === "ok" ? "OK " : "!! ") + rec.brand_key + "/" + rec.slug + "  " + t.url + "  " + (rec.note || ""));
}
await ctx.close();
await browser.close();

const logFile = path.join(OUT, "capture-log.json");
let prev = [];
try { prev = JSON.parse(fs.readFileSync(logFile, "utf8")).results || []; } catch { /* ยังไม่มี log เดิม */ }
const merged = prev.filter(p => !results.some(r => r.url === p.url)).concat(results);
fs.writeFileSync(logFile, JSON.stringify({ captured_at: CAPTURED_AT, viewport: "390x844 @2x Android th-TH", results: merged }, null, 2), "utf8");
console.log("\nเสร็จ " + results.filter(r => r.status === "ok").length + "/" + results.length + " · log: " + logFile);
