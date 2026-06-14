/**
 * ใช้งาน:
 *   node scripts/upload-rich-menu-image.mjs <path-to-image>
 *
 * ตัวอย่าง:
 *   node scripts/upload-rich-menu-image.mjs rich-menu.png
 *   node scripts/upload-rich-menu-image.mjs C:\Users\Win11x64\Downloads\my-menu.png
 */

import https from "https";
import { readFileSync, existsSync } from "fs";
import path from "path";
import sharp from "sharp";

// ── อ่าน env ──────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const content = readFileSync(".env.local", "utf8");
    for (const line of content.split("\n")) {
      const [k, ...v] = line.split("=");
      if (k && v.length) process.env[k.trim()] = v.join("=").trim();
    }
  } catch {}
}
loadEnv();

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("❌  ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env.local");
  process.exit(1);
}

// ── รับ path รูปจาก argument ──────────────────────────────────────────────────
const imagePath = process.argv[2];
if (!imagePath) {
  console.error("❌  ระบุ path รูปด้วยครับ");
  console.error("   เช่น: node scripts/upload-rich-menu-image.mjs rich-menu.png");
  process.exit(1);
}
const absPath = path.resolve(imagePath);
if (!existsSync(absPath)) {
  console.error(`❌  ไม่พบไฟล์: ${absPath}`);
  process.exit(1);
}
const ext = path.extname(absPath).toLowerCase();
let contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
const rawBuffer = readFileSync(absPath);
console.log(`📁  ไฟล์: ${absPath} (${(rawBuffer.length / 1024).toFixed(1)} KB)`);

// ── บีบอัดให้ต่ำกว่า 1 MB (LINE limit) ──────────────────────────────────────
const MAX_BYTES = 950 * 1024; // 950 KB เผื่อ margin
let imageBuffer = rawBuffer;
if (rawBuffer.length > MAX_BYTES) {
  console.log("⚙️   รูปใหญ่เกิน 1 MB กำลังบีบอัดเป็น JPEG...");
  imageBuffer = await sharp(rawBuffer)
    .resize({ width: 2500, withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  console.log(`   บีบอัดแล้ว: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
  // contentType ต้องเปลี่ยนเป็น jpeg ด้วย
  contentType = "image/jpeg";
}

// ── LINE API ──────────────────────────────────────────────────────────────────
function lineAPI(method, hostname, path, body, isBuffer = false) {
  return new Promise((resolve, reject) => {
    const headers = { Authorization: `Bearer ${TOKEN}` };
    let postData;

    if (isBuffer) {
      headers["Content-Type"] = contentType;
      headers["Content-Length"] = body.length;
      postData = body;
    } else if (body) {
      const json = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(json);
      postData = json;
    }

    const req = https.request({ hostname, path, method, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. ลบ rich menu เก่าทั้งหมดออกก่อน (บังคับ LINE refresh cache)
  console.log("1️⃣  ลบ Rich Menu เก่า...");
  const list = await lineAPI("GET", "api.line.me", "/v2/bot/richmenu/list");
  for (const m of list.richmenus ?? []) {
    await lineAPI("DELETE", "api.line.me", `/v2/bot/richmenu/${m.richMenuId}`);
    console.log(`   ลบ: ${m.richMenuId}`);
  }

  // 2. สร้าง rich menu ใหม่
  console.log("2️⃣  สร้าง Rich Menu ใหม่ (6 ปุ่ม)...");
  const LIFF_URL = "https://liff.line.me/2010392141-TXmVNdGl";
  const MAPS_URL = "https://maps.app.goo.gl/kaxxDP9ywmorkXPC6";
  const FB_URL   = "https://www.facebook.com/dksteelandtools";
  const WEB_URL  = "https://line-dk-bot-ai.vercel.app";
  const created = await lineAPI("POST", "api.line.me", "/v2/bot/richmenu", {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: "DK Menu 6 Buttons",
    chatBarText: "เมนู 📋",
    areas: [
      // แถวบน
      { bounds: { x: 0,    y: 0,   width: 833, height: 843 }, action: { type: "uri",     label: "สมัครสมาชิก / เช็คคะแนน", uri: LIFF_URL } },
      { bounds: { x: 833,  y: 0,   width: 833, height: 843 }, action: { type: "uri",     label: "แผนที่ร้าน",                uri: MAPS_URL } },
      { bounds: { x: 1666, y: 0,   width: 834, height: 843 }, action: { type: "message", label: "ติดต่อฝ่ายขาย",             text: "ติดต่อฝ่ายขาย" } },
      // แถวล่าง
      { bounds: { x: 0,    y: 843, width: 833, height: 843 }, action: { type: "message", label: "เล่นเกมรับแต้ม",            text: "🎮 เล่นเกมตอบคำถาม" } },
      { bounds: { x: 833,  y: 843, width: 833, height: 843 }, action: { type: "uri",     label: "Facebook เพจ",              uri: FB_URL } },
      { bounds: { x: 1666, y: 843, width: 834, height: 843 }, action: { type: "uri",     label: "เว็บไซต์ร้าน",              uri: WEB_URL } },
    ],
  });
  const richMenuId = created.richMenuId;
  console.log(`   richMenuId ใหม่: ${richMenuId}`);

  // 3. อัปโหลดรูป
  console.log("3️⃣  อัปโหลดรูปภาพ...");
  await lineAPI("POST", "api-data.line.me", `/v2/bot/richmenu/${richMenuId}/content`, imageBuffer, true);
  console.log("   อัปโหลดสำเร็จ ✓");

  // 4. ตั้งเป็น default
  console.log("4️⃣  ตั้งเป็น default Rich Menu...");
  await lineAPI("POST", "api.line.me", `/v2/bot/user/all/richmenu/${richMenuId}`, {});
  console.log("   ตั้งค่าสำเร็จ ✓");

  console.log("\n✅  Rich Menu อัปเดตแล้ว! เปิด LINE ดูได้เลยครับ");
}

main().catch((e) => { console.error(e); process.exit(1); });
