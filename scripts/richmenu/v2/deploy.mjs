// ขึ้น Rich Menu v2 แบบ A — ตำแหน่งปุ่มอ่านจาก designs/a.areas.json (ห้ามพิมพ์ตัวเลขซ้ำ)
//   node scripts/richmenu/v2/deploy.mjs --dry-run   แสดง payload เฉยๆ ไม่เรียก LINE
//   node scripts/richmenu/v2/deploy.mjs             สร้างเมนูใหม่ → อัปโหลดภาพ → ตั้งเป็นค่าเริ่มต้น
//   node scripts/richmenu/v2/deploy.mjs --rollback  กลับไปใช้เมนูเดิม (id ที่บันทึกไว้ใน out/previous-default.json)
//
// ต่างจาก upload-rich-menu-image.mjs: ไม่ลบเมนูเดิมก่อน — ถ้าขั้นไหนพัง ลูกค้ายังเห็นเมนูเดิม
// ลบเมนูเก่าทิ้งได้ทีหลังด้วยมือเมื่อทดสอบบนมือถือครบทั้ง 6 ปุ่มแล้ว
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../../..");
const DRY = process.argv.includes("--dry-run");
const ROLLBACK = process.argv.includes("--rollback");
const PREV_FILE = path.join(DIR, "out", "previous-default.json");

// ปุ่มเรียงตาม id ใน a.areas.json · action เดิมของเมนูที่ใช้อยู่ (setup-rich-menu.mjs / upload-rich-menu-image.mjs)
const ACTIONS = {
  1: { type: "uri", label: "บัตรสมาชิก", uri: "https://liff.line.me/2010392141-TXmVNdGl" },
  2: { type: "uri", label: "แผนที่ร้าน", uri: "https://maps.app.goo.gl/kaxxDP9ywmorkXPC6" },
  3: { type: "message", label: "ติดต่อฝ่ายขาย", text: "ติดต่อฝ่ายขาย" },
  4: { type: "message", label: "เล่นเกมรับแต้ม", text: "🎮 เล่นเกมตอบคำถาม" },
  5: { type: "uri", label: "Facebook เพจ", uri: "https://www.facebook.com/dksteelandtools" },
  6: { type: "uri", label: "เว็บไซต์ร้าน", uri: "https://line-dk-bot-ai.vercel.app" },
};

const areasJson = JSON.parse(fs.readFileSync(path.join(DIR, "designs", "a.areas.json"), "utf8"));
if (areasJson.length !== 6) throw new Error("a.areas.json ต้องมี 6 ปุ่ม");
const areas = areasJson.map(a => {
  const action = ACTIONS[a.id];
  if (!action) throw new Error(`ไม่มี action ของปุ่ม id ${a.id}`);
  return { bounds: { x: a.x, y: a.y, width: a.width, height: a.height }, action };
});
const body = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: "DK Menu v2-A",
  chatBarText: "เมนู",
  areas,
};

const image = fs.readFileSync(path.join(DIR, "out", "a.jpg"));
if (image.length > 1024 * 1024) throw new Error(`a.jpg ใหญ่เกิน 1 MB (${image.length} bytes)`);

if (DRY) {
  console.log(JSON.stringify(body, null, 2));
  console.log(`ภาพ out/a.jpg ${(image.length / 1024).toFixed(0)} KB — dry run ไม่ได้เรียก LINE`);
  process.exit(0);
}

for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0 && !line.startsWith("#") && line.slice(0, i).trim() === "LINE_CHANNEL_ACCESS_TOKEN") {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) throw new Error("ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env.local");

async function line(method, url, payload, contentType) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(payload !== undefined ? { "Content-Type": contentType ?? "application/json" } : {}),
    },
    body: payload === undefined ? undefined : (contentType ? payload : JSON.stringify(payload)),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

async function currentDefault() {
  try { return (await line("GET", "https://api.line.me/v2/bot/user/all/richmenu")).richMenuId ?? null; }
  catch (e) { if (String(e.message).includes("404")) return null; throw e; }
}

if (ROLLBACK) {
  const prev = JSON.parse(fs.readFileSync(PREV_FILE, "utf8")).richMenuId;
  if (!prev) throw new Error("ไม่มี id เมนูเดิมให้ย้อนกลับ");
  await line("POST", `https://api.line.me/v2/bot/user/all/richmenu/${prev}`);
  console.log(`ย้อนกลับเป็นเมนูเดิม ${prev} แล้ว`);
  process.exit(0);
}

// ตรวจ payload กับ LINE ก่อนสร้างจริง
await line("POST", "https://api.line.me/v2/bot/richmenu/validate", body);
console.log("1) LINE ตรวจ payload ผ่าน");

const prev = await currentDefault();
fs.writeFileSync(PREV_FILE, JSON.stringify({ richMenuId: prev, savedAt: new Date().toISOString() }, null, 2));
console.log(`2) เมนูเดิม ${prev ?? "(ไม่มี)"} — บันทึกไว้สำหรับย้อนกลับ`);

const { richMenuId } = await line("POST", "https://api.line.me/v2/bot/richmenu", body);
console.log(`3) สร้างเมนูใหม่ ${richMenuId}`);

await line("POST", `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, image, "image/jpeg");
console.log("4) อัปโหลดภาพแล้ว");

await line("POST", `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`);
const now = await currentDefault();
if (now !== richMenuId) throw new Error(`ตั้งค่าเริ่มต้นไม่สำเร็จ (ตอนนี้เป็น ${now})`);
console.log(`5) ตั้งเป็นเมนูเริ่มต้นแล้ว — ถ้าต้องย้อนกลับ: node scripts/richmenu/v2/deploy.mjs --rollback`);
