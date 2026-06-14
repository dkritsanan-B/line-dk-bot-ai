import https from "https";
import { readFileSync } from "fs";
import { Resvg } from "@resvg/resvg-js";

// ── อ่าน token จาก .env.local ───────────────────────────────────────────────
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

// ── สร้างภาพ Rich Menu จาก SVG ───────────────────────────────────────────────
function createRichMenuPNG() {
  const EMOJI = "Segoe UI Emoji,Apple Color Emoji,Noto Color Emoji";
  const THAI  = "Leelawadee UI,Tahoma,Arial";

  const svg = `<svg width="2500" height="843" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0D47A1"/>
      <stop offset="100%" stop-color="#1E88E5"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#BF360C"/>
      <stop offset="100%" stop-color="#FF8F00"/>
    </linearGradient>
  </defs>

  <!-- พื้นหลัง -->
  <rect x="0"    y="0" width="1244" height="843" fill="url(#blueGrad)"/>
  <rect x="1256" y="0" width="1244" height="843" fill="url(#goldGrad)"/>
  <rect x="1244" y="0" width="12"   height="843" fill="white" opacity="0.4"/>

  <!-- ══ ช่องซ้าย: สมัครสมาชิก (ช่าง) ══ -->

  <!-- หมวกนิรภัย (hard hat) -->
  <ellipse cx="622" cy="290" rx="145" ry="30" fill="#F9A825"/>
  <path d="M477 290 Q477 180 622 165 Q767 180 767 290 Z" fill="#FDD835"/>
  <rect x="455" y="285" width="334" height="28" rx="14" fill="#F57F17"/>
  <!-- แถบหมวก -->
  <rect x="477" y="275" width="290" height="14" rx="7" fill="#E65100" opacity="0.5"/>
  <!-- ร่างกาย (เสื้อช่าง) -->
  <path d="M542 390 Q540 340 580 330 L622 350 L664 330 Q704 340 702 390 Z" fill="#1565C0"/>
  <rect x="540" y="388" width="164" height="60" rx="8" fill="#1565C0"/>
  <!-- แขน -->
  <path d="M540 345 Q500 360 490 410 L530 415 Q535 375 560 365 Z" fill="#1565C0"/>
  <path d="M702 345 Q742 360 752 410 L712 415 Q709 375 684 365 Z" fill="#1565C0"/>
  <!-- หัว -->
  <ellipse cx="622" cy="310" rx="52" ry="48" fill="#FFCC80"/>

  <!-- ข้อความช่องซ้าย -->
  <text x="622" y="535" text-anchor="middle" font-size="118" font-weight="bold"
        fill="white" font-family="${THAI}" letter-spacing="1">สมัครสมาชิก</text>
  <rect x="372" y="558" width="500" height="4" rx="2" fill="white" opacity="0.35"/>
  <text x="622" y="640" text-anchor="middle" font-size="62" fill="white" opacity="0.92"
        font-family="${THAI}">ทุก 100 บาท = 1 แต้ม</text>
  <text x="622" y="720" text-anchor="middle" font-size="58" fill="#FDD835"
        font-family="${THAI}" font-weight="bold">กดเพื่อเริ่มสะสมแต้ม!</text>

  <!-- ══ ช่องขวา: เช็คแต้มสะสม (ของรางวัล) ══ -->

  <!-- พัดลม -->
  <circle cx="1580" cy="255" r="68" fill="white" opacity="0.15"/>
  <circle cx="1580" cy="255" r="22" fill="white" opacity="0.9"/>
  <ellipse cx="1556" cy="218" rx="18" ry="32" fill="white" opacity="0.75" transform="rotate(-30 1556 218)"/>
  <ellipse cx="1617" cy="228" rx="18" ry="32" fill="white" opacity="0.75" transform="rotate(50 1617 228)"/>
  <ellipse cx="1604" cy="290" rx="18" ry="32" fill="white" opacity="0.75" transform="rotate(160 1604 290)"/>
  <ellipse cx="1543" cy="285" rx="18" ry="32" fill="white" opacity="0.75" transform="rotate(-110 1543 285)"/>
  <text x="1580" y="340" text-anchor="middle" font-size="36" fill="white" opacity="0.85" font-family="${THAI}">พัดลม</text>

  <!-- ทีวี -->
  <rect x="1700" y="195" width="140" height="100" rx="10" fill="white" opacity="0.85"/>
  <rect x="1710" y="203" width="120" height="76"  rx="5"  fill="#1A237E" opacity="0.9"/>
  <rect x="1755" y="295" width="30"  height="18"  rx="3"  fill="white" opacity="0.7"/>
  <text x="1770" y="340" text-anchor="middle" font-size="36" fill="white" opacity="0.85" font-family="${THAI}">ทีวี</text>

  <!-- ตู้เย็น -->
  <rect x="1870" y="185" width="110" height="140" rx="10" fill="white" opacity="0.85"/>
  <rect x="1870" y="185" width="110" height="55"  rx="10" fill="#E0F7FA" opacity="0.9"/>
  <rect x="1870" y="236" width="110" height="4"   fill="#90A4AE"/>
  <rect x="1878" y="200" width="6"   height="30"  rx="3"  fill="#90A4AE"/>
  <rect x="1878" y="250" width="6"   height="60"  rx="3"  fill="#90A4AE"/>
  <text x="1925" y="346" text-anchor="middle" font-size="36" fill="white" opacity="0.85" font-family="${THAI}">ตู้เย็น</text>

  <!-- ทองคำ -->
  <rect x="2040" y="210" width="130" height="68" rx="8" fill="#FFD600" opacity="0.95"/>
  <rect x="2048" y="218" width="114" height="52" rx="6" fill="#FFEA00"/>
  <text x="2105" y="255" text-anchor="middle" font-size="32" font-weight="bold" fill="#E65100" font-family="${THAI}">GOLD</text>
  <text x="2105" y="285" text-anchor="middle" font-size="26" fill="#BF360C" font-family="${THAI}">99.99%</text>
  <text x="2105" y="340" text-anchor="middle" font-size="36" fill="white" opacity="0.85" font-family="${THAI}">ทองคำ</text>

  <!-- ข้อความช่องขวา -->
  <text x="1878" y="470" text-anchor="middle" font-size="118" font-weight="bold"
        fill="white" font-family="${THAI}" letter-spacing="1">เช็คแต้มสะสม</text>
  <rect x="1578" y="490" width="600" height="4" rx="2" fill="white" opacity="0.35"/>
  <text x="1878" y="572" text-anchor="middle" font-size="62" fill="white" opacity="0.92"
        font-family="${THAI}">สะสมแต้มแลกของรางวัล</text>
  <text x="1878" y="652" text-anchor="middle" font-size="58" fill="#FFD600"
        font-family="${THAI}" font-weight="bold">กดเพื่อดูคะแนนของคุณ!</text>
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

    if (isBuffer) {
      headers["Content-Type"] = "image/png";
      headers["Content-Length"] = body.length;
      postData = body;
    } else {
      const json = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(json);
      postData = json;
    }

    const req = https.request(
      { hostname, path, method, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("1️⃣  สร้าง Rich Menu structure...");
  const menu = await lineRequest("POST", "/v2/bot/richmenu", {
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

  if (!menu.richMenuId) {
    console.error("❌  สร้าง rich menu ไม่สำเร็จ:", menu);
    process.exit(1);
  }
  console.log("   richMenuId:", menu.richMenuId);

  console.log("2️⃣  อัปโหลดภาพ...");
  const png = createRichMenuPNG();
  const uploadRes = await lineRequest(
    "POST",
    `/v2/bot/richmenu/${menu.richMenuId}/content`,
    png,
    true
  );
  console.log("   upload:", JSON.stringify(uploadRes));

  console.log("3️⃣  ตั้งเป็น default rich menu...");
  const setRes = await lineRequest(
    "POST",
    `/v2/bot/user/all/richmenu/${menu.richMenuId}`,
    {}
  );
  console.log("   set default:", JSON.stringify(setRes));

  console.log("\n✅  Rich Menu พร้อมใช้งานแล้ว!");
  console.log(`   richMenuId: ${menu.richMenuId}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
