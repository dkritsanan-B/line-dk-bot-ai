import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BRAND, SHOP, TIER_COLOR, TIER_TEXT, TIER_THEME, TIER_MIN, TONE_STYLE, MEMBER_BENEFITS, visualLength, TITLE_MAX,
  welcomeFlex, contactFlex, pointsFlex, pointsEarnedFlex, tierUpFlex,
  birthdayGiftFlex, pointsExpiringFlex, pointsExpiredFlex,
  redemptionRequestedFlex, redemptionConfirmedFlex, redemptionCancelledFlex,
  tierExpiryWarningFlex,
} from "../lib/line-ui.ts";

// ตรวจข้อมูลตัวอย่างในเครื่องเท่านั้น: ไม่อ่าน .env, ไม่เรียก LINE API และไม่ส่งข้อความจริง
export const examples = [
  ["ต้อนรับ", welcomeFlex()],
  ["ติดต่อฝ่ายขาย", contactFlex()],
  ["เช็คแต้ม Gold", pointsFlex({ name: "คุณสมชาย", tierName: "Gold", tierEmoji: "🥇", tierColor: TIER_COLOR.Gold, points: 8450, totalEarned: 3200, tierMin: 2000, next: { name: "Platinum", emoji: "🔱", min: 5000 } })],
  ["เช็คแต้ม Silver", pointsFlex({ name: "คุณสมชาย", tierName: "Silver", tierEmoji: "🥈", tierColor: TIER_COLOR.Silver, points: 845, totalEarned: 900, tierMin: 500, next: { name: "Gold", emoji: "🥇", min: 2000 } })],
  // ---- ตั้งแต่ตรงนี้เป็นการ์ดแจ้งเตือนสมาชิก (memberNoticeFlex) ----
  ["ได้แต้มจากบิล (ข้อมูลเดิม)", pointsEarnedFlex({ name: "คุณสมชาย", points: 1250, balance: 8450, billNo: "IV-690001" })],
  ["ได้แต้มจากบิล (มีระดับ)", pointsEarnedFlex({ name: "คุณสมชาย", points: 1250, balance: 8450, billNo: "IV-690001", tierName: "Gold", tierEmoji: "🥇", totalEarned: 3200, tierMin: 2000, next: { name: "Platinum", emoji: "🔱", min: 5000 } })],
  ["เลื่อนระดับ", tierUpFlex({ name: "คุณสมชาย", tierName: "Gold", tierEmoji: "🥇", points: 8450, earned: 1250, billNo: "IV-690001" })],
  ["เลื่อนระดับ Bronze", tierUpFlex({ name: "สมชาย", tierName: "Bronze", tierEmoji: "🥉", points: 120, earned: 120, billNo: "IV-690002" })],
  ["เลื่อนระดับ Platinum", tierUpFlex({ name: "สมชาย", tierName: "Platinum", tierEmoji: "🔱", points: 5200, earned: 400, billNo: "IV-690003" })],
  ["ของขวัญวันเกิด", birthdayGiftFlex({ name: "คุณสมชาย", tierName: "Gold", tierEmoji: "🥇", points: 500 })],
  ["แต้มใกล้หมดอายุ (ข้อมูลเดิม)", pointsExpiringFlex({ name: "คุณสมชาย", points: 1250, daysLeft: 30, expiryDate: "16 ตุลาคม 2569" })],
  ["แต้มใกล้หมดอายุ (มียอดคงเหลือ)", pointsExpiringFlex({ name: "คุณสมชาย", points: 1250, daysLeft: 30, expiryDate: "16 ตุลาคม 2569", balance: 7200 })],
  ["แต้มหมดอายุ", pointsExpiredFlex({ name: "คุณสมชาย", points: 1250, balance: 7200 })],
  ["แต้มหมดอายุ (ไม่เหลือแต้ม)", pointsExpiredFlex({ name: "คุณ", points: 300, balance: 0 })],
  ["จองของรางวัล", redemptionRequestedFlex({ rewardName: "สว่านไร้สาย", points: 2500, requestId: 88, availablePoints: 5950 })],
  ["รับของรางวัล", redemptionConfirmedFlex({ rewardName: "สว่านไร้สาย", points: 2500, balance: 5950 })],
  ["รับของรางวัล (มีเลขคำขอ)", redemptionConfirmedFlex({ rewardName: "สว่านไร้สาย", points: 2500, balance: 5950, requestId: 88 })],
  ["ยกเลิกคำขอ (ข้อมูลเดิม)", redemptionCancelledFlex({ rewardName: "สว่านไร้สาย", points: 2500, requestId: 88 })],
  ["ยกเลิกคำขอ (มีเหตุผล+ยอด)", redemptionCancelledFlex({ rewardName: "สว่านไร้สาย", points: 2500, requestId: 88, reason: "สินค้าหมด", balance: 8450 })],
  ["รักษาระดับ (ข้อมูลเดิม)", tierExpiryWarningFlex({ name: "คุณสมชาย" })],
  ["รักษาระดับ (คำนวณระดับที่จะตก)", tierExpiryWarningFlex({ name: "สมชาย", tierName: "Gold", points: 800 })],
  ["รักษาระดับ (ข้อมูลครบ)", tierExpiryWarningFlex({ name: "คุณสมชาย", tierName: "Platinum", deadline: "16 ตุลาคม 2569", lastPurchaseDate: "16 ตุลาคม 2568" })],
];
const NOTICE_START = 4;

const forbiddenColors = new Set(["#F26A1B", "#2E3192"]);

function walk(value, visit, path = "message") {
  visit(value, path);
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, visit, `${path}[${index}]`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => walk(item, visit, `${path}.${key}`));
}

function lum(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function validateFlex(name, message) {
  assert.equal(message.type, "flex", `${name}: type ต้องเป็น flex`);
  assert.equal(typeof message.altText, "string", `${name}: ต้องมี altText`);
  assert(message.altText.length > 0 && message.altText.length <= 400, `${name}: altText ยาวเกินขอบเขต LINE`);
  assert(["bubble", "carousel"].includes(message.contents?.type), `${name}: contents ต้องเป็น bubble/carousel`);
  if (message.contents.type === "carousel") {
    assert(message.contents.contents.length > 0 && message.contents.contents.length <= 12, `${name}: carousel ต้องมี 1–12 bubbles`);
  }

  walk(message, (node, nodePath) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    if (node.color) {
      assert(/^#[0-9A-F]{6}([0-9A-F]{2})?$/i.test(node.color), `${name}: สีไม่ถูกต้องที่ ${nodePath}`);
      assert(!forbiddenColors.has(node.color.toUpperCase()), `${name}: พบสีที่เลิกใช้ ${node.color}`);
    }
    if (node.type === "button") {
      assert(["primary", "secondary", "link"].includes(node.style), `${name}: style ปุ่มไม่ถูกต้อง`);
      assert(["sm", "md"].includes(node.height), `${name}: height ปุ่มไม่ถูกต้อง`);
      assert(node.action?.label && node.action.label.length <= 40, `${name}: label ปุ่มว่างหรือยาวเกินไป`);
      assert(["uri", "message"].includes(node.action?.type), `${name}: action ปุ่มไม่รองรับ`);
    }
    if (node.type === "image") assert(/^https:\/\//.test(node.url), `${name}: รูปต้องเป็น HTTPS`);
  });

  const json = JSON.stringify(message);
  assert(!json.includes("11 เดือน"), `${name}: ยังมีข้อความ hardcode 11 เดือน`);
  assert(!json.includes("เปิดทุกวัน จันทร์ - เสาร์"), `${name}: เวลาร้านขัดกัน`);
  assert(!json.includes("คุณคุณ"), `${name}: คำนำหน้าชื่อซ้ำ`);
  assert(!json.includes(BRAND.yellow), `${name}: ห้ามใช้เหลืองมะนาว ใช้ TIER_COLOR.Gold สีเดียว`);
}

for (const [name, message] of examples) {
  validateFlex(name, message);
  console.log(`✓ ${name}`);
}

// ---------- การ์ดแจ้งเตือนสมาชิก ----------
for (const [name, message] of examples.slice(NOTICE_START)) {
  assert(/^[⭐🎉🎂⏳🔔🎁✅❌📌]/u.test(message.altText), `${name}: altText ต้องขึ้นต้นด้วยอีโมจิสถานะ`);
  const header = message.contents.header.contents;
  const [eyebrow, title] = [header[0].text, header[1].text];
  assert(eyebrow.startsWith("DK MEMBER"), `${name}: eyebrow ต้องขึ้นต้นด้วย DK MEMBER`);
  assert(!title.endsWith("ค่ะ"), `${name}: หัวข้อต้องไม่ลงท้ายด้วย ค่ะ`);
  assert(visualLength(title) <= TITLE_MAX || header[1].size === "lg", `${name}: หัวข้อเกิน ${TITLE_MAX} ตัวแต่ไม่ย่อขนาด`);
  assert(visualLength(title) <= 22, `${name}: หัวข้อยาวเกินบรรทัดเดียว (${title})`);
  assert(!/#REQ|\d{3,}/.test(title), `${name}: ตัวเลข/เลขคำขอต้องอยู่ใน metric หรือกล่องข้อมูล ไม่ใช่หัวข้อ`);
  const panels = message.contents.body?.contents?.filter((item) => item.backgroundColor === BRAND.panel) ?? [];
  for (const panel of panels) {
    const rows = panel.contents.filter((c) => c.type === "box" && c.layout === "horizontal");
    assert(rows.length <= 3, `${name}: กล่องข้อมูลเกิน 3 แถว`);
  }
  assert((message.contents.footer?.contents?.length ?? 0) <= 2, `${name}: มีปุ่มเกิน 2 ปุ่ม`);
  // ห้ามมีบรรทัดซ้ำกันในการ์ดเดียว (eyebrow/หัวข้อ/caption/ข้อความ)
  const texts = [];
  walk(message.contents, (node) => { if (node && node.type === "text" && node.text && node.text.length > 2) texts.push(node.text); });
  assert.equal(new Set(texts).size, texts.length, `${name}: มีข้อความซ้ำในการ์ดเดียว`);
}
console.log("✓ หัวข้อบรรทัดเดียว · eyebrow DK MEMBER · ไม่มีบรรทัดซ้ำ");

// ---------- เช็คแต้ม ----------
const gold = examples.find(([name]) => name === "เช็คแต้ม Gold")[1];
const silver = examples.find(([name]) => name === "เช็คแต้ม Silver")[1];
assert.equal(gold.contents.header.contents[0].contents[0].color, TIER_TEXT.Gold, "Gold ต้องใช้ตัวอักษรน้ำเงิน");
assert.equal(silver.contents.header.contents[0].contents[0].color, TIER_TEXT.Silver, "Silver ต้องใช้ตัวอักษรน้ำเงิน");
assert.equal(gold.contents.header.contents[0].contents[0].text, "DK MEMBER", "pointsFlex eyebrow ต้องเป็น DK MEMBER");
assert.equal(gold.contents.header.backgroundColor, TIER_COLOR.Gold, "Gold ต้องใช้ TIER_COLOR.Gold");

// หลอดความคืบหน้าต้องตรงกับป้าย "สะสมแล้ว X / Y" (เติม = totalEarned / next.min เหมือนหน้า LIFF)
const barOf = (msg) => {
  let bar = null;
  walk(msg.contents, (node) => { if (node && node.type === "box" && node.height === "8px" && typeof node.width === "string") bar = node; });
  return bar;
};
const pf = pointsFlex({ name: "ก", tierName: "Gold", tierEmoji: "🥇", tierColor: TIER_COLOR.Gold, points: 8450, totalEarned: 12000, tierMin: 10000, next: { name: "Platinum", emoji: "🔱", min: 20000 } });
assert.equal(barOf(pf).width, "60%", "pointsFlex: หลอดต้องเติม 12000/20000 = 60%");
assert(JSON.stringify(pf).includes("สะสมแล้ว 12,000 / 20,000 แต้ม"), "pointsFlex: ป้ายต้องเป็น สะสมแล้ว X / Y");
const pe = examples.find(([n]) => n === "ได้แต้มจากบิล (มีระดับ)")[1];
assert.equal(barOf(pe).width, "64%", "pointsEarnedFlex: หลอดต้องเติม 3200/5000 = 64%");
for (const msg of [pf, pe]) assert(/อีก [\d,]+ แต้ม → /.test(JSON.stringify(msg)), "ข้อความระดับถัดไปต้องเป็นรูป อีก X แต้ม → ระดับ");
assert.equal(barOf(silver).backgroundColor, BRAND.navy, "Silver: สีระดับสว่าง หลอดต้องใช้น้ำเงินเข้ม");
for (const [tier, t] of Object.entries(TIER_THEME)) assert(contrast(t.bar, "#DDE2EA") >= 3, `หลอด ${tier} คอนทราสต์กับรางต่ำกว่า 3:1`);
const inactive = pointsFlex({ name: "ก", tierName: "Silver", tierEmoji: "🥈", tierColor: TIER_COLOR.Silver, points: 845, totalEarned: 3000, tierMin: 500, next: { name: "Gold", emoji: "🥇", min: 2000 }, inactiveRealTier: "🥇 Gold" });
assert(!barOf(inactive), "ระดับพักอยู่: ห้ามโชว์หลอด (แต้มสะสมเกินเกณฑ์แล้ว)");
assert(JSON.stringify(inactive).includes(BRAND.warnBg), "ระดับพักอยู่: คำเตือนต้องอยู่ในกล่องสีเตือน");

// ---------- ติดต่อฝ่ายขาย ----------
{
  const contact = examples.find(([name]) => name === "ติดต่อฝ่ายขาย")[1];
  const [intro, ...staff] = contact.contents.contents;
  assert(intro.hero, "contactFlex: ใบแรกต้องเป็นใบร้านที่มีแบนเนอร์");
  assert.equal(JSON.stringify(intro).split(SHOP.hours).length - 1, 1, "contactFlex: ใบร้านต้องแสดงเวลาทำการบรรทัดเดียว");
  assert.equal(staff.length, 4, "contactFlex: ต้องมีการ์ดพนักงาน 4 ใบ");
  for (const bubble of staff) {
    assert(!bubble.hero, "contactFlex: การ์ดพนักงานห้ามมีแบนเนอร์ซ้ำ");
    assert(!JSON.stringify(bubble).includes(SHOP.hours), "contactFlex: การ์ดพนักงานห้ามมีบรรทัดเวลาซ้ำ");
  }
}

// ---------- ต้อนรับ: ปุ่มหลัก 1 + ปุ่มรองคู่ในแถวเดียว ----------
{
  const footer = examples[0][1].contents.footer.contents;
  assert.equal(footer[0].type, "button", "welcomeFlex: ปุ่มแรกต้องเป็นปุ่มสมัคร");
  assert.equal(footer[1].layout, "horizontal", "welcomeFlex: ปุ่มรองต้องอยู่แถวเดียวกัน");
  assert(footer[1].contents.every((b) => b.height === "sm" && b.style === "secondary"), "welcomeFlex: ปุ่มรองต้องเป็น secondary/sm");
}

// ---------- สีระดับ + คอนทราสต์ ----------
const pairs = [];
for (const [tier, t] of Object.entries(TIER_THEME)) {
  pairs.push([`หัว ${tier}`, t.text, t.bg], [`ป้ายระดับ ${tier}`, t.ink, t.tint], [`ชื่อระดับ ${tier} บนขาว`, t.ink, "#FFFFFF"]);
}
for (const [tone, s] of Object.entries(TONE_STYLE)) {
  pairs.push([`tone ${tone} eyebrow`, s.eyebrow, s.background], [`tone ${tone} title`, s.title, s.background]);
}
pairs.push(
  ["ตั๋วคำขอ", BRAND.navy, BRAND.sky], ["ป้ายตั๋ว", BRAND.muted, BRAND.sky],
  ["กล่องเตือน", BRAND.warn, BRAND.warnBg], ["ข้อความในกล่องเตือน", BRAND.ink, BRAND.warnBg],
  ["หัวการ์ดพนักงาน", "#FFFFFF", BRAND.navy], ["ป้ายในกล่องข้อมูล", BRAND.muted, BRAND.panel],
  ["success บนขาว", BRAND.success, "#FFFFFF"], ["warn บนขาว", BRAND.warn, "#FFFFFF"],
);
for (const [label, fg, bg] of pairs) {
  const r = contrast(fg, bg);
  assert(r >= 4.5, `คอนทราสต์ ${label} ${fg}/${bg} = ${r.toFixed(2)} ต่ำกว่า 4.5`);
}
const minPair = pairs.map(([l, f, b]) => [l, contrast(f, b)]).sort((a, b) => a[1] - b[1])[0];
console.log(`✓ คอนทราสต์ตัวอักษร/พื้น ${pairs.length} คู่ ≥ 4.5:1 (ต่ำสุด ${minPair[0]} ${minPair[1].toFixed(2)})`);
assert.equal(TIER_THEME.Gold.bg, TIER_COLOR.Gold, "Gold ต้องเป็นสีเดียวกันทุกที่");
for (const tier of Object.keys(TIER_THEME)) {
  const m = tierUpFlex({ name: "ก", tierName: tier, tierEmoji: "", points: 1, earned: 1, billNo: "X" });
  assert.equal(m.contents.header.backgroundColor, TIER_THEME[tier].bg, `tierUpFlex ${tier} ต้องใช้สีระดับของตัวเอง`);
  assert(!JSON.stringify(m).includes(" %"), `tierUpFlex ${tier}: ห้ามเว้นวรรคก่อน %`);
}

// ---------- ข้อเท็จจริงเทียบไฟล์ต้นทาง ----------
const root = new URL("../", import.meta.url);
const readSrc = (file) => fs.readFileSync(new URL(file, root), "utf8");
const readArr = (file, re) => {
  const m = readSrc(file).match(re);
  assert(m, `อ่านตัวเลขกติกาจาก ${file} ไม่ได้`);
  return m[1].split(",").map((x) => Number(x.trim()));
};
// สิทธิ์บนการ์ด (MEMBER_BENEFITS) ต้องตรงกับกติกาจริง (ไม่ import เพราะไฟล์นั้นต่อฐานข้อมูล)
const tierOrder = ["Welcome", "Bronze", "Silver", "Gold", "Platinum", "Diamond"];
const retail = readArr("lib/tierRules.ts", /retail:\s*\{[^}]*byTier:\s*\[([^\]]+)\]/);
const steel = readArr("lib/tierRules.ts", /steel:\s*\{[^}]*byTier:\s*\[([^\]]+)\]/);
const birthday = readArr("app/api/cron/birthday/route.ts", /BIRTHDAY_POINTS\s*=\s*\[([^\]]+)\]/);
tierOrder.forEach((tier, i) => {
  assert.deepEqual(MEMBER_BENEFITS[tier], { discount: retail[i], steelBonus: steel[i], birthday: birthday[i] }, `MEMBER_BENEFITS.${tier} ไม่ตรงกับ tierRules/birthday cron`);
});
console.log("✓ สิทธิ์ระดับบนการ์ดตรงกับ lib/tierRules.ts และ cron วันเกิด");

// เกณฑ์ระดับ + กติกาลดระดับ (getEffectiveTier: ไม่มีบิลใน 365 วัน → คิดระดับจากแต้มคงเหลือ)
const pointsSrc = readSrc("lib/points.ts");
for (const [tier, min] of Object.entries(TIER_MIN)) {
  assert(new RegExp(`name:\\s*"${tier}"[^}]*min:\\s*${min}\\b`).test(pointsSrc), `TIER_MIN.${tier} ไม่ตรงกับ TIERS ใน lib/points.ts`);
}
assert(/isActive \? totalEarned : currentPoints/.test(pointsSrc), "กติกา getEffectiveTier เปลี่ยน ต้องทบทวนข้อความ tierExpiryWarningFlex");
assert(/365 \* 24 \* 60 \* 60 \* 1000/.test(pointsSrc), "ระยะเวลาคงระดับใน getEffectiveTier เปลี่ยน ต้องทบทวนข้อความ 1 ปี");
const drop = JSON.stringify(tierExpiryWarningFlex({ name: "ก", tierName: "Gold", points: 800 }));
assert(drop.includes("ระดับ Gold จะกลับเป็น Silver"), "tierExpiryWarningFlex: แต้มคงเหลือ 800 ต้องบอกว่าจะกลับเป็น Silver");
const keep = JSON.stringify(tierExpiryWarningFlex({ name: "ก", tierName: "Gold", points: 3000 }));
assert(!keep.includes("กลับเป็น"), "tierExpiryWarningFlex: แต้มคงเหลือพอคงระดับ ห้ามอ้างว่าระดับจะตก");
const unknown = JSON.stringify(tierExpiryWarningFlex({ name: "ก" }));
assert(!unknown.includes("กลับเป็น") && unknown.includes("อาจลดลง"), "tierExpiryWarningFlex: ไม่มีข้อมูลห้ามเดาชื่อระดับ");
console.log("✓ หลอดความคืบหน้า · สีระดับ · กติกาลดระดับตรงกับ lib/points.ts");

console.log(`ตรวจโครงสร้างและเนื้อหาผ่าน ${examples.length}/${examples.length} ตัวอย่าง (local only · ไม่เรียก LINE API)`);
