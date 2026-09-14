// ===================================================================
//  hero-price-levels.ts — ชิ้น A: คำนวณ "ราคาระดับสมาชิก" (ช่อง 2–6) ให้ทุกสินค้า-หน่วยใน Hero
//
//  โหมด:  npx tsx scripts/hero-price-levels.ts preview   → อ่าน Hero อย่างเดียว ออก Excel + plan.json ให้เจ้าของตรวจ (ค่าเริ่มต้น)
//         npx tsx scripts/hero-price-levels.ts apply     → เขียน Hero ตาม plan.json ล่าสุด (ต้องได้รับอนุญาตก่อนทุกครั้ง · สำรองค่าเดิมก่อน)
//         npx tsx scripts/hero-price-levels.ts rollback  → คืนค่าจากไฟล์สำรองล่าสุด (backup-*.json ของ apply)
//         npx tsx scripts/hero-price-levels.ts sync      → โหมดบอท: เขียนเฉพาะแถวที่ไม่ตรงแผน (Task HeroPriceLevelSync ทุก 10 นาที ผ่าน trello_approve\hero_price_level_sync.js) · log = hero-price-levels/sync.log
//
//  กติกา % อยู่ที่ lib/tierRules.ts ที่เดียว (ตัวเดียวกับที่คิดโบนัสแต้ม) — ห้ามฝังตัวเลขที่นี่
//  โครง Hero: CSPDPRICE 3 แถวต่อสินค้า-หน่วย (TAXTYPE แยกนอก/รวมใน/อัตราศูนย์) ร้านใช้ "รวมใน" (TAXTYPE=1) เท่านั้น → แตะเฉพาะแถวนั้น
//  ระดับ Hero นับจาก 0: PRICELEVEL 1..5 = ช่อง UNITPRICE2..6 / DISCWORD2..6 (Bronze..Diamond) · ช่องที่ 1 = ราคาป้าย ไม่แตะเด็ดขาด
//  พิสูจน์แล้ว 12–13 ก.ย. 69: ช่องราคาระดับ = 0 → ราคาว่างที่ POS (ไม่ถอย) จึงต้องก๊อปราคาป้ายลงทุกช่อง · คำส่วนลดต่อกันไม่รองรับ → รวมเป็นตัวเดียว
//  ต้องรันด้วย DATABASE_URL อะไรก็ได้ (lib/points.ts สร้าง neon client ตอน import) — ไม่ได้ใช้ DB ของบอทจริง
// ===================================================================
import fs from "node:fs";
import path from "node:path";
import { RULES, ruleForLine, TIER_ORDER, type RuleKey } from "../lib/tierRules";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sql = require("C:/Users/Win11x64/Documents/trello_approve/node_modules/mssql");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx");

const DB = { server: "192.168.1.110", port: 1433, database: "DK", user: "sa", password: "", options: { encrypt: false, trustServerCertificate: true, instanceName: "SQLEXPRESS" }, requestTimeout: 120000 };
const OUT_DIR = path.join(process.cwd(), "hero-price-levels");
const LEVELS = TIER_ORDER.slice(1) as readonly string[];   // Bronze..Diamond → ช่อง 2..6
const MODE = process.argv[2] || "preview";

interface Row { ID: number; CODE: string; NAME: string; CATEGORY: number | null; CATNAME: string; UNITID: number; UNIT: string; UNITPRICE1: number; DISCWORD1: string | null; ATDATE: Date; USEFLAG: number;
  UNITPRICE2: number; UNITPRICE3: number; UNITPRICE4: number; UNITPRICE5: number; UNITPRICE6: number; DISCWORD2: string | null; DISCWORD3: string | null; DISCWORD4: string | null; DISCWORD5: string | null; DISCWORD6: string | null }

// อ่านคำส่วนลดปกติ (ช่องที่ 1) — Hero รับได้ 2 แบบ: "8%" (เปอร์เซ็นต์) หรือ "21" (บาทต่อหน่วย)
// คงหน่วยเดิมไว้เสมอ: ปกติเป็นบาท → ช่องระดับก็เป็นบาท (เคยแปลงเป็น % แล้วเลขอ่านไม่รู้เรื่อง + ปัดเศษทำราคาเพี้ยน)
function baseDiscount(word: string | null, listPrice: number): { pct: number; baht: number; kind: "none" | "pct" | "baht" | "unknown" } {
  const w = String(word ?? "").trim();
  if (!w || !/\d/.test(w)) return { pct: 0, baht: 0, kind: "none" };   // ว่าง หรือขยะที่ไม่มีตัวเลข (เจอ "." 1 แถว) = ไม่มีส่วนลด
  const m = /^(\d+(?:\.\d+)?)\s*%$/.exec(w);
  if (m) { const pct = Number(m[1]); return pct > 0 ? { pct, baht: listPrice * pct / 100, kind: "pct" } : { pct: 0, baht: 0, kind: "none" }; }
  const b = /^(\d+(?:\.\d+)?)$/.exec(w);
  if (b) { const baht = Number(b[1]); return baht > 0 ? { pct: listPrice > 0 ? baht / listPrice * 100 : 0, baht, kind: "baht" } : { pct: 0, baht: 0, kind: "none" }; }   // "0" = ไม่มีส่วนลด (เจอของจริงหลังแก้ราคา)
  return { pct: 0, baht: 0, kind: "unknown" };   // เช่น "8%+2%" หรือข้อความแปลก → ไม่แตะ ปล่อยให้คนดู
}

const fmtPct = (p: number) => `${Math.round(p * 100) / 100}%`;
const fmtBaht = (b: number) => String(Math.round(b * 100) / 100);

function plan(r: Row) {
  const list = Number(r.UNITPRICE1) || 0;
  const base = baseDiscount(r.DISCWORD1, list);
  const { rule, reason } = ruleForLine({ code: r.CODE, name: r.NAME, category: r.CATEGORY, unit: r.UNIT, qty: 1, unit_price: list, list_price: list, discword: String(r.DISCWORD1 ?? ""), net: list });
  const R = RULES[rule];
  const words: string[] = []; const prices: number[] = []; const notes: string[] = [];
  for (let i = 0; i < LEVELS.length; i++) {
    const rate = R.byTier[i + 1] ?? 0;                     // byTier[0] = Welcome
    prices.push(list);                                     // ราคาช่องระดับ = ราคาป้ายเสมอ (ถ้าปล่อย 0 ราคาที่ POS จะว่าง) — แม้หมวดที่ไม่ลดก็ต้องก๊อป
    // หมวดที่สิทธิ์ออกทางแต้ม (เหล็ก/เมทัลชีท) — ห้ามใส่ส่วนลดใน Hero เดี๋ยวได้ 2 เด้ง + ลดซ้ำจากราคาที่ต่อแล้ว
    if (R.via !== "discount") { words.push(String(r.DISCWORD1 ?? "").trim()); if (rate > 0) notes.push("สิทธิ์ออกทางแต้ม ไม่ลดหน้าร้าน"); continue; }
    // ไม่มีราคาป้ายใน Hero = แคชเชียร์พิมพ์ราคาเองทุกครั้ง → ส่วนลดจะไปเกาะราคาที่ต่อมาแล้ว จึงไม่ใส่ (ตัดสินใจ 14 ก.ย.)
    if (!(list > 0)) { words.push(String(r.DISCWORD1 ?? "").trim()); if (rate > 0) notes.push("ไม่มีราคาป้าย จึงไม่ใส่ส่วนลดระดับ"); continue; }
    if (base.kind === "unknown") { words.push(String(r.DISCWORD1 ?? "").trim()); notes.push("คำส่วนลดปกติอ่านไม่ออก คงเดิม"); continue; }
    if (rate <= 0) { words.push(base.kind === "none" ? "" : String(r.DISCWORD1 ?? "").trim()); continue; }   // ระดับนี้ไม่ได้ส่วนลดเพิ่ม → คงส่วนลดปกติไว้
    if (R.mode === "pct") {
      if (base.kind === "baht") { words.push(fmtBaht(base.baht + list * rate / 100)); notes.push("ส่วนลดปกติเป็นบาท/หน่วย → ช่องระดับเป็นบาทเหมือนกัน"); }
      else words.push(fmtPct(base.pct + rate));                                     // บวก % ตรง ๆ (ตัดสินใจ 13 ก.ย.)
    } else {
      words.push(fmtBaht(base.baht + rate));                                        // บาท/หน่วย (เมทัลชีท) · ส่วนลดปกติที่เป็น % คิดเป็นบาทไว้ใน base.baht แล้ว
      if (base.kind === "pct") notes.push("เมทัลชีทที่มีส่วนลดปกติเป็น % → รวมเป็นบาท/เมตร");
    }
  }
  const cur = [r.UNITPRICE2, r.UNITPRICE3, r.UNITPRICE4, r.UNITPRICE5, r.UNITPRICE6].map((x) => Number(x) || 0);
  const curW = [r.DISCWORD2, r.DISCWORD3, r.DISCWORD4, r.DISCWORD5, r.DISCWORD6].map((x) => String(x ?? "").trim());
  const changed = prices.some((p, i) => Math.abs(p - cur[i]) > 0.004) || words.some((w, i) => w !== curW[i]);
  return { rule, reason, base, prices, words, changed, notes: [...new Set(notes)].join("; ") };
}

// --code=XXX (โหมด sync) = ทำเฉพาะสินค้าตัวเดียว — ตัวเขียนราคา (hero-po price-set / steel_price_push) เรียกหลังแก้ราคาป้าย ช่องระดับจะได้ตามทันที
const ONLY_CODE = (process.argv.find((a) => a.startsWith("--code=")) || "").slice(7).trim();

async function loadRows(pool: { request: () => { query: (q: string) => Promise<{ recordset: Row[] }> } }): Promise<Row[]> {
  // แถวราคาล่าสุดต่อสินค้า-หน่วย (ATDATE ล่าสุด) เฉพาะ TAXTYPE=1 รวมใน · เฉพาะสินค้าที่ยังใช้งาน
  const onlyCode = ONLY_CODE ? ` AND p.CODE = '${ONLY_CODE.replace(/'/g, "''")}'` : "";
  const q = `
    ;WITH PR AS (
      SELECT pr.*, ROW_NUMBER() OVER (PARTITION BY pr.PRODUCTCODE, pr.UNITID ORDER BY pr.ATDATE DESC, pr.ID DESC) AS rn
      FROM CSPDPRICE pr WHERE pr.TAXTYPE = 1)
    SELECT PR.ID, p.CODE, p.NAME, p.CATEGORY, ISNULL(c.LNAME,'') AS CATNAME, PR.UNITID, ISNULL(u.LNAME,'') AS UNIT, PR.UNITPRICE1, PR.DISCWORD1, PR.ATDATE, p.USEFLAG,
           PR.UNITPRICE2, PR.UNITPRICE3, PR.UNITPRICE4, PR.UNITPRICE5, PR.UNITPRICE6, PR.DISCWORD2, PR.DISCWORD3, PR.DISCWORD4, PR.DISCWORD5, PR.DISCWORD6
      FROM PR JOIN CSPRODUCT p ON p.CODE = PR.PRODUCTCODE LEFT JOIN CSCATEGORY c ON c.ID = p.CATEGORY LEFT JOIN CSUNIT u ON u.ID = PR.UNITID
     WHERE PR.rn = 1 AND p.USEFLAG = 0${onlyCode}
     ORDER BY p.CATEGORY, p.NAME, PR.UNITID`;
  return (await pool.request().query(q)).recordset;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pool = await sql.connect(DB);
  try {
    if (MODE === "preview") {
      const rows = await loadRows(pool);
      const items = rows.map((r) => ({ r, p: plan(r) }));
      const byRule: Record<string, number> = {}; const byCat: Record<string, number> = {}; let noPrice = 0, unknownWord = 0, changed = 0;
      for (const { r, p } of items) { byRule[p.rule] = (byRule[p.rule] || 0) + 1; byCat[r.CATNAME || "(ไม่มีหมวด)"] = (byCat[r.CATNAME || "(ไม่มีหมวด)"] || 0) + 1; if (!(Number(r.UNITPRICE1) > 0)) noPrice++; if (p.base.kind === "unknown") unknownWord++; if (p.changed) changed++; }
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      // plan.json ไว้ให้โหมด apply ใช้ (ไม่คำนวณใหม่ตอนเขียน — เขียนตามที่เจ้าของเห็นในไฟล์นี้เท่านั้น)
      const planRows = items.filter(({ p }) => p.changed).map(({ r, p }) => ({ id: r.ID, code: r.CODE, unit: r.UNIT, prices: p.prices, words: p.words }));
      fs.writeFileSync(path.join(OUT_DIR, "plan.json"), JSON.stringify({ createdAt: new Date().toISOString(), rows: planRows }, null, 0));
      // Excel ให้ตรวจ
      const sheetRows = items.map(({ r, p }) => ({
        "รหัส": r.CODE, "ชื่อสินค้า": String(r.NAME).replace(/^[*\s-]+/, ""), "หมวด Hero": r.CATNAME, "หน่วย": r.UNIT,
        "กลุ่มกติกา": RULES[p.rule].label, "เหตุผล": p.reason, "ราคาป้าย": Number(r.UNITPRICE1) || 0, "ส่วนลดปกติ": String(r.DISCWORD1 ?? "").trim(),
        "Bronze": p.words[0], "Silver": p.words[1], "Gold": p.words[2], "Platinum": p.words[3], "Diamond": p.words[4],
        "หมายเหตุ": p.notes, "เปลี่ยน": p.changed ? "ใช่" : "",
      }));
      const wb = XLSX.utils.book_new();
      const summary = [
        ["สรุปแผนราคาระดับสมาชิก (โหมดดูก่อน — ยังไม่เขียน Hero)", ""], ["สร้างเมื่อ", new Date().toLocaleString("th-TH")],
        ["สินค้า-หน่วยทั้งหมด (แถวรวมใน, ใช้งานอยู่)", items.length], ["ต้องเขียน (ค่าใหม่ต่างจากใน Hero)", changed],
        ["ไม่มีราคาป้าย (จะใส่แค่คำส่วนลด)", noPrice], ["คำส่วนลดปกติอ่านไม่ออก (คงเดิม ต้องดูเอง)", unknownWord], [],
        ["ตามกลุ่มกติกา", ""], ...Object.entries(byRule).map(([k, v]) => [RULES[k as RuleKey].label, v]), [],
        ["ตามหมวด Hero", ""], ...Object.entries(byCat).map(([k, v]) => [k, v]), [],
        ["กติกา", ""], ...(Object.keys(RULES) as RuleKey[]).map((k) => [`${RULES[k].label} — ${RULES[k].via === "discount" ? "ลดหน้าร้าน" : "คืนเป็นแต้ม (ไม่เขียน Hero)"}`, RULES[k].byTier.slice(1).map((x, i) => `${LEVELS[i]} ${x}${RULES[k].mode === "pct" ? "%" : " บ/หน่วย"}`).join(" · ")]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "สรุป");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), "ทุกสินค้า");
      // ชีต "ต้องดู" = แถวที่คนควรเหลือบดู: ไม่มีหมวด / คำส่วนลดอ่านไม่ออก / ส่วนลดปกติเป็นบาท (ถูกแปลงเป็น %) / เมทัลชีทหน่วยไม่ใช่เมตร
      const review = sheetRows.filter((x) => x["เหตุผล"] === "ไม่มีหมวด" || x["หมายเหตุ"] || /^\d+(\.\d+)?$/.test(String(x["ส่วนลดปกติ"])) || x["เหตุผล"] === "เมทัลชีทหน่วยไม่ใช่เมตร");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(review), "ต้องดู");
      const xlsx = path.join(OUT_DIR, `hero-price-levels-preview-${stamp}.xlsx`);
      XLSX.writeFile(wb, xlsx);
      console.log(JSON.stringify({ total: items.length, changed, noPrice, unknownWord, byRule, byCat, xlsx, plan: path.join(OUT_DIR, "plan.json") }, null, 1));
      return;
    }
    if (MODE === "apply") {
      const planFile = path.join(OUT_DIR, "plan.json");
      const { rows, createdAt } = JSON.parse(fs.readFileSync(planFile, "utf8")) as { createdAt: string; rows: { id: number; code: string; unit: string; prices: number[]; words: string[] }[] };
      console.log(`apply plan ${createdAt}: ${rows.length} แถว`);
      // สำรองค่าเดิมของแถวที่จะแตะ
      const ids = rows.map((r) => r.id);
      const backup: unknown[] = [];
      for (let i = 0; i < ids.length; i += 1000) {
        const chunk = ids.slice(i, i + 1000);
        const rs = (await pool.request().query(`SELECT ID, PRODUCTCODE, UNITID, UNITPRICE2, UNITPRICE3, UNITPRICE4, UNITPRICE5, UNITPRICE6, DISCWORD2, DISCWORD3, DISCWORD4, DISCWORD5, DISCWORD6 FROM CSPDPRICE WHERE ID IN (${chunk.join(",")})`)).recordset;
        backup.push(...rs);
      }
      const bk = path.join(OUT_DIR, `backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
      fs.writeFileSync(bk, JSON.stringify(backup));
      console.log("backup:", bk, backup.length, "แถว");
      let done = 0;
      for (const r of rows) {
        const req = pool.request();
        req.input("id", sql.Int, r.id);
        for (let i = 0; i < 5; i++) { req.input(`p${i + 2}`, sql.Decimal(18, 4), r.prices[i]); req.input(`w${i + 2}`, sql.VarChar(50), r.words[i]); }
        await req.query(`UPDATE CSPDPRICE SET UNITPRICE2=@p2, UNITPRICE3=@p3, UNITPRICE4=@p4, UNITPRICE5=@p5, UNITPRICE6=@p6, DISCWORD2=@w2, DISCWORD3=@w3, DISCWORD4=@w4, DISCWORD5=@w5, DISCWORD6=@w6 WHERE ID=@id AND TAXTYPE=1`);
        done++;
        if (done % 1000 === 0) console.log("  เขียนแล้ว", done);
      }
      // ตรวจหลังเขียน: อ่านกลับมาเทียบ
      const again = await loadRows(pool);
      const bad = again.map((r) => ({ r, p: plan(r) })).filter(({ p }) => p.changed).length;
      console.log(`เสร็จ ${done} แถว · ตรวจกลับ: ยังไม่ตรง ${bad} แถว`);
      return;
    }
    if (MODE === "rollback") {
      const files = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith("backup-")).sort();
      const bk = path.join(OUT_DIR, files[files.length - 1]);
      const rows = JSON.parse(fs.readFileSync(bk, "utf8")) as Record<string, unknown>[];
      console.log("rollback from", bk, rows.length, "แถว");
      for (const r of rows) {
        const req = pool.request(); req.input("id", sql.Int, r.ID);
        for (let i = 2; i <= 6; i++) { req.input(`p${i}`, sql.Decimal(18, 4), Number(r[`UNITPRICE${i}`]) || 0); const w = r[`DISCWORD${i}`]; req.input(`w${i}`, sql.VarChar(50), w == null ? null : String(w)); }
        await req.query(`UPDATE CSPDPRICE SET UNITPRICE2=@p2, UNITPRICE3=@p3, UNITPRICE4=@p4, UNITPRICE5=@p5, UNITPRICE6=@p6, DISCWORD2=@w2, DISCWORD3=@w3, DISCWORD4=@w4, DISCWORD5=@w5, DISCWORD6=@w6 WHERE ID=@id`);
      }
      console.log("rollback done");
      return;
    }
    if (MODE === "sync") {
      // โหมดบอท (Task HeroPriceLevelSync ทุก 10 นาที): คำนวณใหม่ทั้งหมด เขียนเฉพาะแถวที่ค่าใน Hero ไม่ตรงแผน
      // ใช้หลัง apply ครั้งแรก 14 ก.ย. 69 — ราคาป้าย/ส่วนลดปกติเปลี่ยน · สินค้าใหม่ · ตั้งราคาจาก 0 → ช่องระดับตามให้เอง
      // เจ้าของอนุญาตให้บอทนี้เขียน Hero ต่อเนื่องแล้ว (14 ก.ย. 69) · lock กันรันซ้อน · hard cap ต่อรอบ · สำรองเฉพาะแถวที่แตะ
      const lockFile = path.join(OUT_DIR, "sync.lock");
      const logFile = path.join(OUT_DIR, "sync.log");
      const tag = ONLY_CODE ? `[${ONLY_CODE}] ` : "";
      const slog = (m: string) => { const line = `[${new Date().toLocaleString("th-TH", { hour12: false })}] ${tag}${m}`; console.log(line); fs.appendFileSync(logFile, line + "\n"); };
      // --code= ไม่ใช้ lock (แค่สินค้าเดียว รันชนรอบใหญ่ได้ ผลลัพธ์เหมือนกัน) — รอบใหญ่ใช้ lock กันซ้อน
      if (!ONLY_CODE) {
        try { const st = fs.statSync(lockFile); if (Date.now() - st.mtimeMs < 20 * 60 * 1000) { slog("ข้าม: มีรอบก่อนรันอยู่ (lock)"); return; } } catch { /* ไม่มี lock */ }
        fs.writeFileSync(lockFile, String(process.pid));
      }
      try {
        const HARD_CAP = 3000;                       // แถว/รอบ — ปกติหลัก 0–50 ถ้าเกินนี้แปลว่ามีอะไรผิด (เช่นกติกาเปลี่ยน) ให้คนดูก่อน
        const rows = await loadRows(pool);
        if (ONLY_CODE && !rows.length) { slog("ไม่พบสินค้า (หรือยกเลิกขาย/ไม่มีแถว TAXTYPE=1)"); return; }
        const todo = rows.map((r) => ({ r, p: plan(r) })).filter(({ p }) => p.changed);
        if (!todo.length) { slog(`ตรวจ ${rows.length} แถว · ตรงหมด`); return; }
        if (todo.length > HARD_CAP) { slog(`!! ต้องเขียน ${todo.length} แถว เกินเพดาน ${HARD_CAP} — ไม่เขียน ให้รัน preview ดูก่อน`); return; }
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
        const backup = todo.map(({ r }) => ({ ID: r.ID, PRODUCTCODE: r.CODE, UNITID: r.UNITID, UNITPRICE2: r.UNITPRICE2, UNITPRICE3: r.UNITPRICE3, UNITPRICE4: r.UNITPRICE4, UNITPRICE5: r.UNITPRICE5, UNITPRICE6: r.UNITPRICE6, DISCWORD2: r.DISCWORD2, DISCWORD3: r.DISCWORD3, DISCWORD4: r.DISCWORD4, DISCWORD5: r.DISCWORD5, DISCWORD6: r.DISCWORD6 }));
        fs.writeFileSync(path.join(OUT_DIR, `backup-sync-${stamp}.json`), JSON.stringify(backup));
        let done = 0;
        for (const { r, p } of todo) {
          const req = pool.request();
          req.input("id", sql.Int, r.ID);
          for (let i = 0; i < 5; i++) { req.input(`p${i + 2}`, sql.Decimal(18, 4), p.prices[i]); req.input(`w${i + 2}`, sql.VarChar(50), p.words[i]); }
          await req.query(`UPDATE CSPDPRICE SET UNITPRICE2=@p2, UNITPRICE3=@p3, UNITPRICE4=@p4, UNITPRICE5=@p5, UNITPRICE6=@p6, DISCWORD2=@w2, DISCWORD3=@w3, DISCWORD4=@w4, DISCWORD5=@w5, DISCWORD6=@w6 WHERE ID=@id AND TAXTYPE=1`);
          done++;
        }
        const sample = todo.slice(0, 5).map(({ r, p }) => `${String(r.NAME).replace(/^[*\s-]+/, "").slice(0, 28)} ${r.UNIT} ${Number(r.UNITPRICE1)} [${p.words.join("|")}]`).join(" · ");
        slog(`เขียน ${done}/${todo.length} แถว (ตรวจ ${rows.length}) · ${sample}${todo.length > 5 ? " …" : ""}`);
        // เก็บ backup-sync ไว้แค่ 30 ไฟล์ล่าสุด
        const bks = fs.readdirSync(OUT_DIR).filter((f) => f.startsWith("backup-sync-")).sort();
        for (const f of bks.slice(0, Math.max(0, bks.length - 30))) fs.unlinkSync(path.join(OUT_DIR, f));
      } finally { if (!ONLY_CODE) { try { fs.unlinkSync(lockFile); } catch { /* ignore */ } } }
      return;
    }
    console.log("unknown mode");
  } finally { await pool.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
