// ประกอบ Rich Menu 2500×1686 (3×2) — ไอคอนจาก Gemini + ข้อความไทยด้วยฟอนต์ระบบ (Leelawadee UI) ผ่าน resvg
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const DIR = process.env.RICHMENU_OUT || path.resolve("scripts/richmenu/out");
fs.mkdirSync(DIR, { recursive: true });
const W = 2500, H = 1686, CW = 833, CH = 843, GAP = 14, R = 44;
const THAI = "Leelawadee UI, Leelawadee, Tahoma, Arial, sans-serif";
const TILES = [
  { id: 1, name: "member",   title: "สมัครสมาชิก",   sub: "สะสมแต้ม · เช็คคะแนน", hint: "กดเพื่อดูบัตรสมาชิก", accent: "#FFD54F" },
  { id: 2, name: "map",      title: "แผนที่ร้าน",     sub: "Location",              hint: "กดเพื่อนำทาง",        accent: "#CCFF90" },
  { id: 3, name: "contact",  title: "ติดต่อฝ่ายขาย",  sub: "Contact Us",            hint: "โทร / LINE พนักงาน",   accent: "#FFE0B2" },
  { id: 4, name: "game",     title: "เล่นเกมรับแต้ม", sub: "ตอบคำถามกับ AI",        hint: "รับ 1 แต้มต่อวัน",     accent: "#E1BEE7" },
  { id: 5, name: "facebook", title: "Facebook เพจ",  sub: "DK Steel and Tools",    hint: "กดเพื่อไปที่เพจ",      accent: "#90CAF9" },
  { id: 6, name: "web",      title: "เว็บไซต์ร้าน",   sub: "Website",               hint: "สินค้า · โปรโมชั่น",    accent: "#B2DFDB" },
];

const img = (name) => { const f = fs.readdirSync(DIR).find(x => x.includes(`-${name}.png`)); return f ? "data:image/png;base64," + fs.readFileSync(path.join(DIR, f)).toString("base64") : null; };

let cells = "", defs = "";
TILES.forEach((t, i) => {
  const col = i % 3, row = Math.floor(i / 3);
  const x = col * CW + GAP / 2, y = row * CH + GAP / 2, w = CW - GAP, h = CH - GAP;
  const data = img(t.name);
  defs += `<clipPath id="c${t.id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${R}"/></clipPath>
  <linearGradient id="s${t.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0.42" stop-color="#000" stop-opacity="0"/><stop offset="0.72" stop-color="#000" stop-opacity="0.38"/><stop offset="1" stop-color="#000" stop-opacity="0.58"/></linearGradient>`;
  cells += `<g clip-path="url(#c${t.id})">
    ${data ? `<image href="${data}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1B5FC1"/>`}
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#s${t.id})"/>
  </g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${R}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3"/>
  <text x="${x + w / 2}" y="${y + h - 215}" text-anchor="middle" font-family="${THAI}" font-weight="bold" font-size="92" fill="#FFFFFF">${t.title}</text>
  <text x="${x + w / 2}" y="${y + h - 138}" text-anchor="middle" font-family="${THAI}" font-size="54" fill="rgba(255,255,255,0.92)">${t.sub}</text>
  <rect x="${x + w / 2 - 250}" y="${y + h - 108}" width="500" height="3" rx="1.5" fill="rgba(255,255,255,0.35)"/>
  <text x="${x + w / 2}" y="${y + h - 46}" text-anchor="middle" font-family="${THAI}" font-size="46" fill="${t.accent}">${t.hint}  ›</text>`;
});

const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<defs>${defs}</defs>
<rect width="${W}" height="${H}" fill="#F4F6FB"/>
${cells}
</svg>`;
fs.writeFileSync(path.join(DIR, "richmenu.svg"), svg);
const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: "Leelawadee UI" }, fitTo: { mode: "width", value: W } }).render().asPng();
fs.writeFileSync(path.join(DIR, "richmenu-new.png"), png);
console.log("richmenu-new.png", png.length, "bytes");
