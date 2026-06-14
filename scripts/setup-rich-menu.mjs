import https from "https";
import { readFileSync } from "fs";
import { Resvg } from "@resvg/resvg-js";

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
if (!TOKEN) { console.error("❌  ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env.local"); process.exit(1); }

const LIFF_URL = "https://liff.line.me/2010392141-TXmVNdGl";
const MAPS_URL = "https://maps.app.goo.gl/kaxxDP9ywmorkXPC6";
const FB_URL   = "https://www.facebook.com/dksteelandtools";
const WEB_URL  = "https://line-dk-bot-ai.vercel.app";

// ── สร้างภาพ Rich Menu 6 ปุ่ม (3×2) 2500×1686 ─────────────────────────────
function createRichMenuPNG() {
  const EMOJI = "Segoe UI Emoji,Apple Color Emoji,Noto Color Emoji";
  const THAI  = "Leelawadee UI,Tahoma,Arial";

  const svg = `<svg width="2500" height="1686" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0D47A1"/><stop offset="100%" stop-color="#1E88E5"/>
    </linearGradient>
    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1B5E20"/><stop offset="100%" stop-color="#43A047"/>
    </linearGradient>
    <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#BF360C"/><stop offset="100%" stop-color="#FF7043"/>
    </linearGradient>
    <linearGradient id="g4" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4A148C"/><stop offset="100%" stop-color="#8E24AA"/>
    </linearGradient>
    <linearGradient id="g5" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1A237E"/><stop offset="100%" stop-color="#1565C0"/>
    </linearGradient>
    <linearGradient id="g6" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#004D40"/><stop offset="100%" stop-color="#00897B"/>
    </linearGradient>
  </defs>

  <!-- พื้นหลัง 6 ช่อง -->
  <rect x="0"    y="0"    width="833" height="843" fill="url(#g1)"/>
  <rect x="833"  y="0"    width="833" height="843" fill="url(#g2)"/>
  <rect x="1666" y="0"    width="834" height="843" fill="url(#g3)"/>
  <rect x="0"    y="843"  width="833" height="843" fill="url(#g4)"/>
  <rect x="833"  y="843"  width="833" height="843" fill="url(#g5)"/>
  <rect x="1666" y="843"  width="834" height="843" fill="url(#g6)"/>

  <!-- เส้นแบ่ง -->
  <rect x="833"  y="0"   width="4" height="1686" fill="white" opacity="0.35"/>
  <rect x="1666" y="0"   width="4" height="1686" fill="white" opacity="0.35"/>
  <rect x="0"    y="843" width="2500" height="4" fill="white" opacity="0.35"/>

  <!-- ปุ่ม 1: สมัครสมาชิก / เช็คคะแนน (บน-ซ้าย) -->
  <text x="417" y="330" text-anchor="middle" font-size="190" font-family="${EMOJI}">🎴</text>
  <text x="417" y="560" text-anchor="middle" font-size="88" font-weight="bold" fill="white" font-family="${THAI}">สมัครสมาชิก</text>
  <text x="417" y="660" text-anchor="middle" font-size="64" fill="rgba(255,255,255,0.88)" font-family="${THAI}">เช็คคะแนนสะสม</text>
  <rect x="197" y="690" width="440" height="4" rx="2" fill="white" opacity="0.3"/>
  <text x="417" y="760" text-anchor="middle" font-size="54" fill="#FDD835" font-family="${THAI}">กดเพื่อดูบัตรสมาชิก</text>

  <!-- ปุ่ม 2: แผนที่ร้าน (บน-กลาง) -->
  <text x="1250" y="330" text-anchor="middle" font-size="190" font-family="${EMOJI}">📍</text>
  <text x="1250" y="560" text-anchor="middle" font-size="88" font-weight="bold" fill="white" font-family="${THAI}">แผนที่ร้าน</text>
  <text x="1250" y="660" text-anchor="middle" font-size="64" fill="rgba(255,255,255,0.88)" font-family="${THAI}">Location</text>
  <rect x="1030" y="690" width="440" height="4" rx="2" fill="white" opacity="0.3"/>
  <text x="1250" y="760" text-anchor="middle" font-size="54" fill="#CCFF90" font-family="${THAI}">กดเพื่อดูแผนที่</text>

  <!-- ปุ่ม 3: ติดต่อฝ่ายขาย (บน-ขวา) -->
  <text x="2083" y="330" text-anchor="middle" font-size="190" font-family="${EMOJI}">📞</text>
  <text x="2083" y="560" text-anchor="middle" font-size="88" font-weight="bold" fill="white" font-family="${THAI}">ติดต่อฝ่ายขาย</text>
  <text x="2083" y="660" text-anchor="middle" font-size="64" fill="rgba(255,255,255,0.88)" font-family="${THAI}">Contact Us</text>
  <rect x="1863" y="690" width="440" height="4" rx="2" fill="white" opacity="0.3"/>
  <text x="2083" y="760" text-anchor="middle" font-size="54" fill="#FFCCBC" font-family="${THAI}">กดเพื่อดูเบอร์ติดต่อ</text>

  <!-- ปุ่ม 4: เล่นเกมตอบคำถาม (ล่าง-ซ้าย) -->
  <text x="417" y="1175" text-anchor="middle" font-size="190" font-family="${EMOJI}">🎮</text>
  <text x="417" y="1400" text-anchor="middle" font-size="88" font-weight="bold" fill="white" font-family="${THAI}">เล่นเกมรับแต้ม</text>
  <text x="417" y="1500" text-anchor="middle" font-size="64" fill="rgba(255,255,255,0.88)" font-family="${THAI}">ตอบคำถาม × Gemini</text>
  <rect x="197" y="1530" width="440" height="4" rx="2" fill="white" opacity="0.3"/>
  <text x="417" y="1600" text-anchor="middle" font-size="54" fill="#E1BEE7" font-family="${THAI}">1 แต้มต่อวัน (สูงสุด)</text>

  <!-- ปุ่ม 5: Facebook (ล่าง-กลาง) -->
  <text x="1250" y="1175" text-anchor="middle" font-size="190" font-family="${EMOJI}">👍</text>
  <text x="1250" y="1400" text-anchor="middle" font-size="88" font-weight="bold" fill="white" font-family="${THAI}">Facebook เพจ</text>
  <text x="1250" y="1500" text-anchor="middle" font-size="64" fill="rgba(255,255,255,0.88)" font-family="${THAI}">DK Steel and Tools</text>
  <rect x="1030" y="1530" width="440" height="4" rx="2" fill="white" opacity="0.3"/>
  <text x="1250" y="1600" text-anchor="middle" font-size="54" fill="#90CAF9" font-family="${THAI}">กดเพื่อไปที่เพจ</text>

  <!-- ปุ่ม 6: เว็บไซต์ (ล่าง-ขวา) -->
  <text x="2083" y="1175" text-anchor="middle" font-size="190" font-family="${EMOJI}">🌐</text>
  <text x="2083" y="1400" text-anchor="middle" font-size="88" font-weight="bold" fill="white" font-family="${THAI}">เว็บไซต์ร้าน</text>
  <text x="2083" y="1500" text-anchor="middle" font-size="64" fill="rgba(255,255,255,0.88)" font-family="${THAI}">Website</text>
  <rect x="1863" y="1530" width="440" height="4" rx="2" fill="white" opacity="0.3"/>
  <text x="2083" y="1600" text-anchor="middle" font-size="54" fill="#B2DFDB" font-family="${THAI}">กดเพื่อไปที่เว็บไซต์</text>
</svg>`;

  const resvg = new Resvg(svg, { font: { loadSystemFonts: true } });
  return Buffer.from(resvg.render().asPng());
}

// ── เรียก LINE API ────────────────────────────────────────────────────────────
function lineRequest(method, path, body, isBuffer = false) {
  const hostname = isBuffer ? "api-data.line.me" : "api.line.me";
  return new Promise((resolve, reject) => {
    const headers = { Authorization: `Bearer ${TOKEN}` };
    let postData;
    if (isBuffer && body) {
      headers["Content-Type"] = "image/png";
      headers["Content-Length"] = body.length;
      postData = body;
    } else if (!isBuffer && body !== undefined && body !== null) {
      const json = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(json);
      postData = json;
    }
    const req = https.request({ hostname, path, method, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  // ลบเก่า
  console.log("1️⃣  ลบ Rich Menu เก่า...");
  const list = await lineRequest("GET", "/v2/bot/richmenu/list");
  for (const m of list.richmenus ?? []) {
    await lineRequest("DELETE", `/v2/bot/richmenu/${m.richMenuId}`);
    console.log(`   ลบ: ${m.richMenuId}`);
  }

  // สร้างใหม่ 6 ปุ่ม
  console.log("2️⃣  สร้าง Rich Menu 6 ปุ่ม...");
  const menu = await lineRequest("POST", "/v2/bot/richmenu", {
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

  if (!menu.richMenuId) { console.error("❌  สร้างไม่สำเร็จ:", menu); process.exit(1); }
  console.log("   richMenuId:", menu.richMenuId);

  console.log("3️⃣  สร้างและอัปโหลดภาพ...");
  const png = createRichMenuPNG();
  await lineRequest("POST", `/v2/bot/richmenu/${menu.richMenuId}/content`, png, true);
  console.log("   อัปโหลดสำเร็จ ✓");

  console.log("4️⃣  ตั้งเป็น default rich menu...");
  await lineRequest("POST", `/v2/bot/user/all/richmenu/${menu.richMenuId}`, {});
  console.log("   ตั้งค่าสำเร็จ ✓");

  console.log("\n✅  Rich Menu 6 ปุ่มพร้อมใช้งานแล้ว!");
  console.log(`   richMenuId: ${menu.richMenuId}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
