// ให้ Codex (โมเดลคนละตัว ใช้โควตา ChatGPT) เป็นผู้ตรวจอิสระ — ดูภาพหน้าจอจริงแล้วให้คะแนน
//   node scripts/codex-review.mjs --round r1 --piece P3 --shots review/r1/gold2300/liff-mobile.png,review/r1/gold2300/liff-desktop.png --role designer
//   node scripts/codex-review.mjs --round r1 --piece P1 --shots ... --role customer
//   node scripts/codex-review.mjs --round r1 --piece P1 --blind review/r1/new/liff-mobile.png,docs/benchmarks/homepro/pitch-viewport.png
// ผลลัพธ์: review/<round>/codex/<piece>-<role>.json (+ .txt ดิบ)
// หมายเหตุ: Codex ไม่รู้ว่าใครสร้างหน้านี้ และไม่ได้อ่านสรุปของคนสร้าง — ดูจากภาพล้วน ๆ
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; };
const ROUND = arg("round", "r1");
const PIECE = arg("piece", "P?");
const ROLE = arg("role", "designer");          // designer | customer | blind
const SHOTS = (arg("shots", "") || arg("blind", "")).split(",").map(s => s.trim()).filter(Boolean);
const EXTRA = arg("note", "");
if (!SHOTS.length) { console.error("❌ ต้องระบุ --shots หรือ --blind เป็นรายการไฟล์ภาพ คั่นด้วยจุลภาค"); process.exit(1); }

const CODEX = (() => {
  const base = "C:/Users/Win11x64/.vscode/extensions";
  const dir = fs.readdirSync(base).filter(d => d.startsWith("openai.chatgpt-")).sort().pop();
  if (!dir) throw new Error("หา Codex CLI ไม่เจอใน VS Code extensions");
  return path.join(base, dir, "bin/windows-x86_64/codex.exe");
})();

const PERSONA_A = `ช่างรับเหมาชาย อายุ 42 ปี อยู่ อ.ทุ่งสง จ.นครศรีธรรมราช ซื้อเหล็ก ท่อ สี เครื่องมือที่ร้านวัสดุสัปดาห์ละ 2-3 ครั้ง
มือถือ Android จอ 6 นิ้ว เปิดผ่าน LINE ตอนยืนหน้าเคาน์เตอร์ มีคนต่อคิวข้างหลัง มือเปื้อนปูน แดดส่อง
ไม่ชอบกรอกฟอร์มยาว ไม่สนใจของสวย สนใจว่า "ได้ลดกี่บาท" และ "ต้องทำอะไรถึงได้"`;

const PROMPTS = {
  designer: `คุณคือผู้อำนวยการฝ่ายออกแบบที่โหดที่สุดในวงการ เคยคุมงานดีไซน์ให้แอปธนาคารและค้าปลีกระดับประเทศ
คุณกำลังตรวจงานออกแบบหน้าจอ "ระบบสมาชิกสะสมแต้มของร้านวัสดุก่อสร้างในต่างจังหวัด" จากภาพหน้าจอจริงที่แนบมา
คุณไม่รู้ว่าใครเป็นคนทำ และไม่มีใครมาอธิบายให้ฟัง ตัดสินจากสิ่งที่เห็นเท่านั้น

ให้คะแนน 1-10 (ให้ 8 ขึ้นไปเฉพาะเมื่อดีจริงระดับเอเจนซี่ชั้นนำ) ใน 6 ด้าน:
hierarchy (ลำดับสายตา), typography (ตัวอักษรไทย ขนาด น้ำหนัก การตัดบรรทัด), spacing (ระยะห่าง จังหวะ), color (สี คอนทราสต์ อ่านออกกลางแดดไหม), consistency (ความสม่ำเสมอภายในหน้าและระหว่างหน้า), usability (นิ้วโป้งกดถึงไหม ปุ่มใหญ่พอไหม รู้ว่าต้องกดอะไรต่อไหม)

แล้วระบุ "ช่องว่างที่ใหญ่ที่สุดเพียงข้อเดียว" ที่ถ้าแก้แล้วจะยกระดับงานทั้งหน้ามากที่สุด พร้อมบอกตำแหน่งบนภาพให้ชัด`,

  customer: `คุณคือลูกค้าจริง ไม่ใช่นักออกแบบ และไม่เคยรู้จักร้านนี้มาก่อน
คุณคือ: ${PERSONA_A}

ดูภาพหน้าจอที่แนบมาแล้วตอบตรง ๆ แบบคนใช้จริง ห้ามเกรงใจ ห้ามใช้ศัพท์ออกแบบ`,

  blind: `คุณเป็นกรรมการตัดสินงานออกแบบ ได้รับภาพหน้าจอ 2 ภาพจากระบบสมาชิกของร้านวัสดุก่อสร้าง 2 เจ้า
คุณไม่รู้ว่าภาพไหนเป็นของใคร และห้ามเดาจากโลโก้หรือชื่อแบรนด์ ให้ตัดสินจากคุณภาพงานเท่านั้น
ผู้ตัดสินต้องสวมบทลูกค้ากลุ่มนี้: ${PERSONA_A}`,
};

const OUTPUT_SPEC = {
  designer: `ตอบเป็น JSON ล้วน ไม่มีข้อความอื่นหุ้ม รูปแบบ:
{"scores":{"hierarchy":0,"typography":0,"spacing":0,"color":0,"consistency":0,"usability":0},
 "biggest_gap":"ช่องว่างใหญ่สุดข้อเดียว","gap_location":"ตรงไหนของภาพ","why":"ทำไมมันสำคัญ",
 "other_issues":["ปัญหารองที่เห็น"],"what_works":["สิ่งที่ทำได้ดีแล้ว อย่าไปแก้"],
 "verdict":"pass ถ้าทุกด้าน >= 8 และไม่มีปัญหาร้ายแรง มิฉะนั้น fail"}`,
  customer: `ตอบเป็น JSON ล้วน ไม่มีข้อความอื่นหุ้ม รูปแบบ:
{"understand_offer":true,"understand_offer_why":"เข้าใจ/ไม่เข้าใจว่าได้อะไร เพราะอะไร",
 "would_sign_up":true,"would_sign_up_why":"",
 "would_come_back":true,"would_come_back_why":"",
 "hesitation":"ข้อความหรือจุดไหนที่ทำให้ลังเลที่สุด",
 "confusing_words":["คำที่อ่านแล้วไม่เข้าใจหรือต้องคิด"],
 "missing_info":["ข้อมูลที่อยากรู้แต่หน้านี้ไม่บอก"],
 "verdict":"pass ถ้าตอบ true ครบ 3 ข้อ มิฉะนั้น fail"}`,
  blind: `ตอบเป็น JSON ล้วน ไม่มีข้อความอื่นหุ้ม รูปแบบ:
{"winner":"A หรือ B","why":"เหตุผลหลักที่ชนะ","margin":"ชนะขาด/ชนะนิดเดียว/เสมอ",
 "a_strengths":[],"b_strengths":[],"loser_biggest_gap":"ช่องว่างใหญ่สุดของฝั่งที่แพ้"}`,
};

const label = SHOTS.map((s, i) => `ภาพที่ ${String.fromCharCode(65 + i)} = ${path.basename(s)}`).join("\n");
const prompt = `${PROMPTS[ROLE]}

${label}
${EXTRA ? "\nบริบทเพิ่มเติม: " + EXTRA + "\n" : ""}
${OUTPUT_SPEC[ROLE]}`;

const outDir = path.resolve("review", ROUND, "codex");
fs.mkdirSync(outDir, { recursive: true });
const stem = path.join(outDir, `${PIECE}-${ROLE}`);

const args = ["exec", "--skip-git-repo-check", "-s", "read-only"];
for (const s of SHOTS) args.push("-i", path.resolve(s));
args.push("-");

let raw = "";
try {
  raw = execFileSync(CODEX, args, { input: prompt, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, timeout: 300000 });
} catch (e) {
  raw = String(e.stdout ?? "") + "\n[ERR] " + String(e.stderr ?? e.message).slice(0, 500);
}
fs.writeFileSync(stem + ".txt", raw);

// Codex พิมพ์ซ้ำ 2 รอบ เอา JSON ก้อนสุดท้ายที่ parse ผ่าน
const blocks = [...raw.matchAll(/\{[\s\S]*?\}(?=\s*$|\s*\n)/g)].map(m => m[0]);
let parsed = null;
for (const b of blocks.reverse()) { try { parsed = JSON.parse(b); break; } catch {} }
if (!parsed) {
  const first = raw.indexOf("{"), last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) { try { parsed = JSON.parse(raw.slice(first, last + 1)); } catch {} }
}

fs.writeFileSync(stem + ".json", JSON.stringify({ round: ROUND, piece: PIECE, role: ROLE, shots: SHOTS, result: parsed, parsed_ok: Boolean(parsed) }, null, 2));
console.log(parsed ? JSON.stringify(parsed) : "⚠️ แปลง JSON ไม่ได้ ดูไฟล์ดิบที่ " + stem + ".txt");
