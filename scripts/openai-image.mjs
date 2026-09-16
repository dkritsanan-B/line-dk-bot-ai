#!/usr/bin/env node
// สร้างรูปด้วย OpenAI Image API (เรียก REST ตรง ไม่ต้องลง SDK / ไม่ใช้ Python — เครื่องนี้ python เป็น stub)
//   node scripts/openai-image.mjs --out assets/robot.png --prompt "..." [--size 1024x1024|1536x1024|1024x1536] [--quality low|medium|high] [--transparent] [--model gpt-image-2.5-flare] [--n 1]
//   prompt ยาว ๆ ส่งทาง stdin ได้: printf '%s' "..." | node scripts/openai-image.mjs --out x.png
// คีย์อ่านจาก OPENAI_API_KEY ใน .env.local (ห้ามฝังในโค้ด) · โมเดลเริ่มต้นตามที่ Codex แนะนำ ถ้าบัญชีไม่มีโมเดลนั้นจะถอยไป gpt-image-1 ให้เอง
import fs from "node:fs";
import path from "node:path";

for (const line of fs.readFileSync(path.resolve(".env.local"), "utf8").split(/\r?\n/)) {
  const i = line.indexOf("="); if (i > 0 && !line.startsWith("#")) { const k = line.slice(0, i).trim(); if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim().replace(/\s+#.*$/, "").replace(/^["']|["']$/g, ""); }
}
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error("❌ ยังไม่มี OPENAI_API_KEY ใน .env.local — เพิ่มบรรทัด OPENAI_API_KEY=sk-... แล้วรันใหม่"); process.exit(1); }

const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : dflt; };
const has = (name) => process.argv.includes("--" + name);
const out = arg("out"); if (!out) { console.error("❌ ต้องระบุ --out ไฟล์.png"); process.exit(1); }
let prompt = arg("prompt", "");
if (!prompt && !process.stdin.isTTY) prompt = fs.readFileSync(0, "utf8").trim();
if (!prompt) { console.error("❌ ต้องระบุ --prompt หรือส่งทาง stdin"); process.exit(1); }
const models = [arg("model", "gpt-image-2.5-flare"), "gpt-image-1"].filter((m, i, a) => a.indexOf(m) === i);

async function gen(model) {
  const body = { model, prompt, n: Number(arg("n", "1")), size: arg("size", "1024x1024"), quality: arg("quality", "medium") };
  if (has("transparent")) body.background = "transparent";
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.error?.message || `HTTP ${r.status}`), { code: j.error?.code, status: r.status });
  return j;
}

let res, used;
for (const m of models) {
  try { res = await gen(m); used = m; break; }
  catch (e) {
    const notFound = e.status === 404 || /model|not found|does not exist|invalid_request/i.test(String(e.message + e.code));
    console.error(`⚠️ ${m}: ${e.message}${notFound && m !== models[models.length - 1] ? " → ลองโมเดลถัดไป" : ""}`);
    if (!notFound) process.exit(1);
  }
}
if (!res) process.exit(1);

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
res.data.forEach((d, i) => {
  const f = res.data.length === 1 ? out : out.replace(/(\.\w+)$/, `-${i + 1}$1`);
  fs.writeFileSync(f, Buffer.from(d.b64_json, "base64"));
  console.log("✅", f, fs.statSync(f).size, "bytes");
});
console.log(`model=${used}` + (res.usage ? ` · tokens in/out ${res.usage.input_tokens}/${res.usage.output_tokens}` : ""));
