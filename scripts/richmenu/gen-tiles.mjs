// สร้างไอคอน 3D 6 ช่องด้วย Gemini (โมเดลเดียวกับ Creative Lab) — ไม่ให้มีตัวหนังสือ ข้อความไทยจะซ้อนทีหลังด้วยฟอนต์จริง
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#")).map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const OUT = process.env.RICHMENU_OUT || path.resolve("scripts/richmenu/out");
fs.mkdirSync(OUT, { recursive: true });

const STYLE = "Premium 3D clay render icon, soft matte materials, gentle studio lighting, subtle rim light, slight depth of field, centered composition, the object occupies the upper 60% of the square and the bottom 40% is clean empty gradient background reserved for text. Absolutely NO text, NO letters, NO numbers, NO logos, NO watermark. Square 1:1.";
const TILES = [
  { id: 1, name: "member",  bg: "deep navy blue to royal blue gradient (#0B2A5B to #1B5FC1)", obj: "a glossy membership card with a gold star badge and a small coin stack, hints of golden sparkles" },
  { id: 2, name: "map",     bg: "fresh green gradient (#1B5E20 to #43A047)", obj: "a folded paper map with a red 3D location pin standing on it, tiny road lines, a small cloud" },
  { id: 3, name: "contact", bg: "warm orange gradient (#BF360C to #FF7043)", obj: "a white 3D telephone handset with a speech bubble, friendly and clean" },
  { id: 4, name: "game",    bg: "purple gradient (#4A148C to #8E24AA)", obj: "a cute white robot head with headphones holding a glowing question mark, playful" },
  { id: 5, name: "facebook",bg: "blue gradient (#0D47A1 to #1E88E5)", obj: "a big white thumbs-up hand with small floating heart and like reaction icons" },
  { id: 6, name: "web",     bg: "teal gradient (#004D40 to #00897B)", obj: "a 3D laptop with a bright glowing screen showing a tiny online storefront layout made of blank colored blocks, a white shopping cart icon floating beside it, small floating price-tag shapes, clean tech look" },
];

const ONLY = (process.env.TILES || "").split(",").filter(Boolean);
for (const t of TILES) {
  if (ONLY.length && !ONLY.includes(t.name)) continue;
  const prompt = `${STYLE} Subject: ${t.obj}. Background: smooth ${t.bg}, with very subtle diagonal light streaks.`;
  const r = await ai.models.generateContent({ model: "gemini-2.5-flash-image", contents: [{ role: "user", parts: [{ text: prompt }] }], config: { responseModalities: ["IMAGE"] } });
  const part = (r.candidates?.[0]?.content?.parts ?? []).find(p => p.inlineData?.data);
  if (!part) { console.log("❌", t.name, r.candidates?.[0]?.finishReason); continue; }
  const f = path.join(OUT, `tile-${t.id}-${t.name}.png`);
  fs.writeFileSync(f, Buffer.from(part.inlineData.data, "base64"));
  console.log("✅", t.name, fs.statSync(f).size, "bytes");
}
