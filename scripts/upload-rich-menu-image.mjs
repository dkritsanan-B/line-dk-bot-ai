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
const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
const imageBuffer = readFileSync(absPath);
console.log(`📁  ไฟล์: ${absPath} (${(imageBuffer.length / 1024).toFixed(1)} KB)`);

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
  // 1. ดึงรายการ rich menu ที่มีอยู่
  console.log("1️⃣  ดึงรายการ Rich Menu...");
  const list = await lineAPI("GET", "api.line.me", "/v2/bot/richmenu/list");
  const menus = list.richmenus ?? [];

  let richMenuId;
  if (menus.length === 0) {
    // ยังไม่มี rich menu — สร้างใหม่
    console.log("   ยังไม่มี Rich Menu สร้างใหม่...");
    const created = await lineAPI("POST", "api.line.me", "/v2/bot/richmenu", {
      size: { width: 2500, height: 843 },
      selected: true,
      name: "DK Loyalty Menu",
      chatBarText: "เมนู 📋",
      areas: [
        {
          bounds: { x: 0, y: 0, width: 1250, height: 843 },
          action: { type: "message", label: "สมัครสมาชิก", text: "สมัครสมาชิก" },
        },
        {
          bounds: { x: 1250, y: 0, width: 1250, height: 843 },
          action: { type: "message", label: "เช็คคะแนนสะสม", text: "แต้ม" },
        },
      ],
    });
    richMenuId = created.richMenuId;
    console.log(`   สร้างแล้ว: ${richMenuId}`);
  } else {
    richMenuId = menus[0].richMenuId;
    console.log(`   ใช้ richMenuId: ${richMenuId} (${menus[0].name})`);
  }

  // 2. อัปโหลดรูป
  console.log("2️⃣  อัปโหลดรูปภาพ...");
  await lineAPI("POST", "api-data.line.me", `/v2/bot/richmenu/${richMenuId}/content`, imageBuffer, true);
  console.log("   อัปโหลดสำเร็จ ✓");

  // 3. ตั้งเป็น default
  console.log("3️⃣  ตั้งเป็น default Rich Menu...");
  await lineAPI("POST", "api.line.me", `/v2/bot/user/all/richmenu/${richMenuId}`, {});
  console.log("   ตั้งค่าสำเร็จ ✓");

  console.log("\n✅  Rich Menu อัปเดตแล้ว! เปิด LINE ดูได้เลยครับ");
}

main().catch((e) => { console.error(e); process.exit(1); });
