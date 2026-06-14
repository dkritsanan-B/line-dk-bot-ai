import zlib from "zlib";
import https from "https";
import { readFileSync } from "fs";

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

// ── สร้างภาพ PNG 2 ช่อง (สีฟ้า | สีเขียว) ──────────────────────────────────
function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function createRichMenuPNG() {
  const W = 2500, H = 843, MID = 1250;
  const BLUE  = [25, 118, 210];   // #1976D2
  const GREEN = [46, 125, 50];    // #2E7D32
  const WHITE = [255, 255, 255];

  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const row = y * (1 + W * 3);
    raw[row] = 0; // filter: None
    for (let x = 0; x < W; x++) {
      const divider = x >= MID - 3 && x <= MID + 3;
      const color = divider ? WHITE : x < MID ? BLUE : GREEN;
      raw[row + 1 + x * 3]     = color[0];
      raw[row + 1 + x * 3 + 1] = color[1];
      raw[row + 1 + x * 3 + 2] = color[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // RGB color type

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
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
