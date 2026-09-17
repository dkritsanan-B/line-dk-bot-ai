// ตรวจข้อความกับ LINE จริง (endpoint validate — ไม่ส่งข้อความถึงใคร) · ตัวตรวจในเครื่องอยู่ที่ validate-line-messages.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { examples } from "./validate-line-messages.mjs";   // ใช้ชุดตัวอย่างเดียวกับตัวตรวจในเครื่อง

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at < 1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) throw new Error("ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน environment หรือ .env.local");


const endpoint = "https://api.line.me/v2/bot/message/validate/push";
for (const [name, message] of examples) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [message] }),
  });
  if (!response.ok) throw new Error(`${name}: LINE validate ไม่ผ่าน (${response.status}) ${await response.text()}`);
  console.log(`✓ ${name}`);
}
console.log(`ตรวจผ่าน ${examples.length}/${examples.length} ข้อความ (validate เท่านั้น ไม่มีการส่งข้อความจริง)`);
