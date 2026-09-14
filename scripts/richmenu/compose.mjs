// ประกอบ Rich Menu 2500×1686 (3×2) — ไอคอนจาก Gemini + ข้อความไทยด้วยฟอนต์ระบบ (Leelawadee UI) ผ่าน resvg
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const DIR = process.env.RICHMENU_OUT || path.resolve("scripts/richmenu/out");
fs.mkdirSync(DIR, { recursive: true });
const W = 2500, H = 1686, CW = 833, CH = 843, GAP = 14, R = 44;
// หมายเหตุ: ฟอนต์ Noto Sans Thai ชุดนี้วางสระ ำ เพี้ยนใน resvg — เลี่ยงคำที่มี ำ ในข้อความบนเมนู
const THAI = "Noto Sans Thai, Noto Sans, Leelawadee UI, Tahoma, sans-serif";   // ไทย=Noto Sans Thai · ละติน=Noto Sans (ไฟล์ Thai ไม่มีตัวละติน)   // ฟอนต์เดียวกับหน้าเว็บ — ไฟล์ .ttf อยู่ใน <out>/fonts
const TILES = [
  { id: 1, name: "member", lift: 0.20,   title: "สมัครสมาชิก",   sub: "สะสมแต้ม · เช็คคะแนน", hint: "กดเพื่อดูบัตรสมาชิก", accent: "#FFD54F" },
  { id: 2, name: "map", lift: 0.20,      title: "แผนที่ร้าน",     sub: "Location",              hint: "กดดูเส้นทาง",        accent: "#CCFF90" },
  { id: 3, name: "contact", lift: 0.16,  title: "ติดต่อฝ่ายขาย",  sub: "Contact Us",            hint: "โทร / LINE พนักงาน",   accent: "#FFE0B2" },
  { id: 4, name: "game", lift: 0.03,     title: "เล่นเกมรับแต้ม", sub: "เกมถาม-ตอบกับ AI",        hint: "รับ 1 แต้มต่อวัน",     accent: "#E1BEE7" },
  { id: 5, name: "facebook", lift: 0.14, title: "Facebook เพจ",  sub: "DK Steel and Tools",    hint: "กดเพื่อไปที่เพจ",      accent: "#90CAF9" },
  { id: 6, name: "web", lift: 0.18,      title: "เว็บไซต์ร้าน",   sub: "Website",               hint: "สินค้า · โปรโมชั่น",    accent: "#B2DFDB" },
];

const img = (name) => { const f = fs.readdirSync(DIR).find(x => x.includes(`-${name}.png`)); return f ? "data:image/png;base64," + fs.readFileSync(path.join(DIR, f)).toString("base64") : null; };

let cells = "", defs = "";
TILES.forEach((t, i) => {
  const col = i % 3, row = Math.floor(i / 3);
  const x = col * CW + GAP / 2, y = row * CH + GAP / 2, w = CW - GAP, h = CH - GAP;
  const data = img(t.name);
  defs += `<clipPath id="c${t.id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${R}"/></clipPath>
  <linearGradient id="s${t.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="0.78" stop-color="#000" stop-opacity="0.28"/><stop offset="1" stop-color="#000" stop-opacity="0.40"/></linearGradient>`;
  cells += `<g clip-path="url(#c${t.id})">
    ${data ? `<image href="${data}" x="${x}" y="${y - h * (t.lift ?? 0.16)}" width="${w}" height="${h * (1 + (t.lift ?? 0.16))}" preserveAspectRatio="xMidYMid slice" filter="url(#vivid)"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1B5FC1"/>`}
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#s${t.id})"/>
  </g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${R}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="4"/>
  <text x="${x + w / 2}" y="${y + h - 205}" text-anchor="middle" font-family="${THAI}" font-weight="700" font-size="88" fill="#FFFFFF" style="paint-order:stroke" stroke="rgba(0,0,0,0.28)" stroke-width="7">${t.title}</text>
  <text x="${x + w / 2}" y="${y + h - 138}" text-anchor="middle" font-family="${THAI}" font-weight="500" font-size="50" fill="rgba(255,255,255,0.92)">${t.sub}</text>
  <rect x="${x + w / 2 - 250}" y="${y + h - 108}" width="500" height="3" rx="1.5" fill="rgba(255,255,255,0.35)"/>
  <text x="${x + w / 2}" y="${y + h - 46}" text-anchor="middle" font-family="${THAI}" font-weight="500" font-size="42" fill="${t.accent}">${t.hint}  ›</text>`;
});

const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<defs><filter id="vivid" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="1.35"/><feComponentTransfer><feFuncR type="linear" slope="1.14" intercept="0.02"/><feFuncG type="linear" slope="1.14" intercept="0.02"/><feFuncB type="linear" slope="1.14" intercept="0.02"/></feComponentTransfer></filter>${defs}</defs>
<rect width="${W}" height="${H}" fill="#F4F6FB"/>
${cells}
</svg>`;
fs.writeFileSync(path.join(DIR, "richmenu.svg"), svg);
const fontDir = path.join(DIR, "fonts");
const fontFiles = fs.existsSync(fontDir) ? fs.readdirSync(fontDir).filter(f => /.(ttf|otf)$/i.test(f)).map(f => path.join(fontDir, f)) : [];
const png = new Resvg(svg, { font: { loadSystemFonts: true, fontFiles, defaultFontFamily: "Noto Sans Thai" }, fitTo: { mode: "width", value: W } }).render().asPng();
fs.writeFileSync(path.join(DIR, "richmenu-new.png"), png);
console.log("richmenu-new.png", png.length, "bytes");
