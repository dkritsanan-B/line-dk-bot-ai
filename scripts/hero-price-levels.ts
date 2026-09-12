// ===================================================================
//  hero-price-levels.ts — ชิ้น A: คำนวณ "ราคาระดับสมาชิก" (ช่อง 2–6) ให้ทุกสินค้า-หน่วยใน Hero
//
//  โหมด:  npx tsx scripts/hero-price-levels.ts preview   → อ่าน Hero อย่างเดียว ออก Excel + plan.json ให้เจ้าของตรวจ (ค่าเริ่มต้น)
//         npx tsx scripts/hero-price-levels.ts apply     → เขียน Hero ตาม plan.json ล่าสุด (ต้องได้รับอนุญาตก่อนทุกครั้ง · สำรองค่าเดิมก่อน)
//         npx tsx scripts/hero-price-levels.ts rollback  → คืนค่าจากไฟล์สำรองล่าสุด
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

// แปลงคำส่วนลดปกติ (ช่องที่ 1) เป็น % ของราคาป้าย — รับทั้ง "8%" และ "21" (บาทต่อหน่วย)
function baseDiscountPct(word: string | null, listPrice: number): { pct: number; kind: "none" | "pct" | "baht" | "unknown" } {
  const w = String(word ?? "").trim();
  if (!w) return { pct: 0, kind: "none" };
  const m = /^(\d+(?:\.\d+)?)\s*%$/.exec(w);
  if (m) return { pct: Number(m[1]), kind: "pct" };
  const b = /^(\d+(?:\.\d+)?)$/.exec(w);
  if (b) { const baht = Number(b[1]); return listPrice > 0 ? { pct: Math.round(baht / listPrice * 10000) / 100, kind: "baht" } : { pct: 0, kind: "unknown" }; }
  return { pct: 0, kind: "unknown" };   // เช่น "8%+2%" หรือข้อความแปลก → ไม่แตะ ปล่อยให้คนดู
}

const fmtPct = (p: number) => `${Math.round(p * 100) / 100}%`.replace(/\.0+%$/, "%");

function plan(r: Row) {
  const list = Number(r.UNITPRICE1) || 0;
  const base = baseDiscountPct(r.DISCWORD1, list);
  const { rule, reason } = ruleForLine({ code: r.CODE, name: r.NAME, category: r.CATEGORY, unit: r.UNIT, qty: 1, unit_price: list, list_price: list, discword: String(r.DISCWORD1 ?? ""), net: list });
  const R = RULES[rule];
  const words: string[] = []; const prices: number[] = []; const notes: string[] = [];
  for (let i = 0; i < LEVELS.length; i++) {
    const rate = R.byTier[i + 1] ?? 0;                     // byTier[0] = Welcome
    prices.push(list);                                     // ราคาช่องระดับ = ราคาป้ายเสมอ (0 ก็ 0 — POS ให้พิมพ์ราคาเอง ส่วนลดยังติด)
    if (base.kind === "unknown") { words.push(String(r.DISCWORD1 ?? "").trim()); notes.push("คำส่วนลดปกติอ่านไม่ออก คงเดิม"); continue; }
    if (rate <= 0) { words.push(String(r.DISCWORD1 ?? "").trim()); continue; }      // ระดับนี้ไม่ได้ → คงส่วนลดปกติ
    if (R.mode === "pct") words.push(fmtPct(base.pct + rate));                       // บวก % ตรง ๆ (ตัดสินใจ 13 ก.ย.)
    else words.push(base.kind === "none" ? String(rate) : fmtPct(base.pct + (list > 0 ? rate / list * 100 : 0)));   // บาท/หน่วย (เมทัลชีท) · ถ้ามีส่วนลดปกติเป็น % ให้แปลงบาทเป็น % รวม
  }
  const cur = [r.UNITPRICE2, r.UNITPRICE3, r.UNITPRICE4, r.UNITPRICE5, r.UNITPRICE6].map((x) => Number(x) || 0);
  const curW = [r.DISCWORD2, r.DISCWORD3, r.DISCWORD4, r.DISCWORD5, r.DISCWORD6].map((x) => String(x ?? "").trim());
  const changed = prices.some((p, i) => Math.abs(p - cur[i]) > 0.004) || words.some((w, i) => w !== curW[i]);
  return { rule, reason, base, prices, words, changed, notes: [...new Set(notes)].join("; ") };
}

async function loadRows(pool: { request: () => { query: (q: string) => Promise<{ recordset: Row[] }> } }): Promise<Row[]> {
  // แถวราคาล่าสุดต่อสินค้า-หน่วย (ATDATE ล่าสุด) เฉพาะ TAXTYPE=1 รวมใน · เฉพาะสินค้าที่ยังใช้งาน
  const q = `
    ;WITH PR AS (
      SELECT pr.*, ROW_NUMBER() OVER (PARTITION BY pr.PRODUCTCODE, pr.UNITID ORDER BY pr.ATDATE DESC, pr.ID DESC) AS rn
      FROM CSPDPRICE pr WHERE pr.TAXTYPE = 1)
    SELECT PR.ID, p.CODE, p.NAME, p.CATEGORY, ISNULL(c.LNAME,'') AS CATNAME, PR.UNITID, ISNULL(u.LNAME,'') AS UNIT, PR.UNITPRICE1, PR.DISCWORD1, PR.ATDATE, p.USEFLAG,
           PR.UNITPRICE2, PR.UNITPRICE3, PR.UNITPRICE4, PR.UNITPRICE5, PR.UNITPRICE6, PR.DISCWORD2, PR.DISCWORD3, PR.DISCWORD4, PR.DISCWORD5, PR.DISCWORD6
      FROM PR JOIN CSPRODUCT p ON p.CODE = PR.PRODUCTCODE LEFT JOIN CSCATEGORY c ON c.ID = p.CATEGORY LEFT JOIN CSUNIT u ON u.ID = PR.UNITID
     WHERE PR.rn = 1 AND p.USEFLAG = 0
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
        ["กติกา", ""], ...(Object.keys(RULES) as RuleKey[]).map((k) => [RULES[k].label, RULES[k].byTier.slice(1).map((x, i) => `${LEVELS[i]} ${x}${RULES[k].mode === "pct" ? "%" : " บ/หน่วย"}`).join(" · ")]),
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
    console.log("unknown mode");
  } finally { await pool.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
