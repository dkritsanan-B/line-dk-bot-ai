import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BRAND, SHOP, SALES_STAFF, TIER_COLOR, TIER_TEXT, TIER_THEME, TIER_MIN, TONE_STYLE, MEMBER_BENEFITS, visualLength, TITLE_MAX,
  welcomeFlex, contactFlex, pointsFlex, pointsEarnedFlex, tierUpFlex,
  birthdayGiftFlex, pointsExpiringFlex, pointsExpiredFlex,
  redemptionRequestedFlex, redemptionConfirmedFlex, redemptionCancelledFlex,
  tierExpiryWarningFlex,
} from "../lib/line-ui.ts";

// ตรวจข้อมูลตัวอย่างในเครื่องเท่านั้น: ไม่อ่าน .env, ไม่เรียก LINE API และไม่ส่งข้อความจริง
export const examples = [
  ["ต้อนรับ", welcomeFlex()],
  ["ติดต่อฝ่ายขาย", contactFlex()],
  ["เช็คแต้ม Gold", pointsFlex({ name: "คุณสมชาย", tierName: "Gold", tierEmoji: "🥇", tierColor: TIER_COLOR.Gold, points: 2450, totalEarned: 3200, tierMin: 2000, next: { name: "Platinum", emoji: "🔱", min: 5000 } })],
  ["เช็คแต้ม Silver", pointsFlex({ name: "คุณสมชาย", tierName: "Silver", tierEmoji: "🥈", tierColor: TIER_COLOR.Silver, points: 845, totalEarned: 900, tierMin: 500, next: { name: "Gold", emoji: "🥇", min: 2000 } })],
  // ---- ตั้งแต่ตรงนี้เป็นการ์ดแจ้งเตือนสมาชิก (memberNoticeFlex) ----
  ["ได้แต้มจากบิล (ข้อมูลเดิม)", pointsEarnedFlex({ name: "คุณสมชาย", points: 250, balance: 2450, billNo: "IV-690001" })],
  ["ได้แต้มจากบิล (มีระดับ)", pointsEarnedFlex({ name: "คุณสมชาย", points: 250, balance: 2450, billNo: "IV-690001", tierName: "Gold", tierEmoji: "🥇", totalEarned: 3200, tierMin: 2000, next: { name: "Platinum", emoji: "🔱", min: 5000 } })],
  ["เลื่อนระดับ", tierUpFlex({ name: "คุณสมชาย", tierName: "Gold", tierEmoji: "🥇", points: 2150, earned: 250, billNo: "IV-690001" })],
  ["เลื่อนระดับ Bronze", tierUpFlex({ name: "สมชาย", tierName: "Bronze", tierEmoji: "🥉", points: 120, earned: 120, billNo: "IV-690002" })],
  ["เลื่อนระดับ Silver", tierUpFlex({ name: "สมชาย", tierName: "Silver", tierEmoji: "🥈", points: 520, earned: 60, billNo: "IV-690004" })],
  ["เลื่อนระดับ Diamond", tierUpFlex({ name: "สมชาย", tierName: "Diamond", tierEmoji: "💎", points: 9800, earned: 700, billNo: "IV-690005" })],
  ["เลื่อนระดับ Platinum", tierUpFlex({ name: "สมชาย", tierName: "Platinum", tierEmoji: "🔱", points: 5200, earned: 400, billNo: "IV-690003" })],
  ["ของขวัญวันเกิด", birthdayGiftFlex({ name: "คุณสมชาย", tierName: "Gold", tierEmoji: "🥇", points: 500 })],
  ["ของขวัญวันเกิด (มียอดคงเหลือ)", birthdayGiftFlex({ name: "คุณสมชาย", tierName: "Gold", tierEmoji: "🥇", points: 500, balance: 2950 })],
  ["แต้มใกล้หมดอายุ (ข้อมูลเดิม)", pointsExpiringFlex({ name: "คุณสมชาย", points: 300, daysLeft: 30, expiryDate: "16 ตุลาคม 2569" })],
  ["แต้มใกล้หมดอายุ (มียอดคงเหลือ)", pointsExpiringFlex({ name: "คุณสมชาย", points: 300, daysLeft: 30, expiryDate: "16 ตุลาคม 2569", balance: 2450 })],
  ["แต้มหมดอายุ", pointsExpiredFlex({ name: "คุณสมชาย", points: 300, balance: 2150 })],
  ["แต้มหมดอายุ (ไม่เหลือแต้ม)", pointsExpiredFlex({ name: "คุณ", points: 300, balance: 0 })],
  ["จองของรางวัล", redemptionRequestedFlex({ rewardName: "สว่านไร้สาย", points: 1500, requestId: 88, availablePoints: 950 })],
  ["รับของรางวัล", redemptionConfirmedFlex({ rewardName: "สว่านไร้สาย", points: 1500, balance: 950 })],
  ["รับของรางวัล (มีเลขคำขอ)", redemptionConfirmedFlex({ rewardName: "สว่านไร้สาย", points: 1500, balance: 950, requestId: 88 })],
  ["ยกเลิกคำขอ (ข้อมูลเดิม)", redemptionCancelledFlex({ rewardName: "สว่านไร้สาย", points: 1500, requestId: 88 })],
  ["ยกเลิกคำขอ (มีเหตุผล)", redemptionCancelledFlex({ rewardName: "สว่านไร้สาย", points: 1500, requestId: 88, reason: "สินค้าหมด" })],
  ["ยกเลิกคำขอ (มีเหตุผลและยอด)", redemptionCancelledFlex({ rewardName: "สว่านไร้สาย", points: 1500, requestId: 88, reason: "สินค้าหมด", balance: 2450 })],
  ["ยกเลิกคำขอ (มียอด)", redemptionCancelledFlex({ rewardName: "สว่านไร้สาย", points: 1500, requestId: 88, balance: 2450 })],
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

// หลอดความคืบหน้าต้องตรงกับป้าย "แต้มสะสม X / Y" (pointsEarned: "สะสมเลื่อนระดับ X / Y") (เติม = totalEarned / next.min เหมือนหน้า LIFF)
const barOf = (msg) => {
  let bar = null;
  walk(msg.contents, (node) => { if (node && node.type === "box" && node.height === "8px" && typeof node.width === "string") bar = node; });
  return bar;
};
const pf = pointsFlex({ name: "ก", tierName: "Gold", tierEmoji: "🥇", tierColor: TIER_COLOR.Gold, points: 2800, totalEarned: 3500, tierMin: 2000, next: { name: "Platinum", emoji: "🔱", min: 5000 } });
assert.equal(barOf(pf).width, "70%", "pointsFlex: หลอดต้องเติม 3500/5000 = 70%");
assert(JSON.stringify(pf).includes("แต้มสะสม 3,500 / 5,000"), "pointsFlex: ป้ายต้องเป็น 'แต้มสะสม X / Y' ตรงหน้าบัตร LIFF");
assert(pointsFlex({ name: "0812345678", tierName: "Gold", tierEmoji: "", tierColor: TIER_COLOR.Gold, points: 1, totalEarned: 2100, tierMin: 2000, next: null }).contents.header.contents[1].text === "คุณ", "pointsFlex: ชื่อต้องผ่าน who() (ไม่โชว์เบอร์)");
const pe = examples.find(([n]) => n === "ได้แต้มจากบิล (มีระดับ)")[1];
assert.equal(barOf(pe).width, "64%", "pointsEarnedFlex: หลอดต้องเติม 3200/5000 = 64%");
for (const msg of [pf, pe]) assert(/อีก [\d,]+ แต้ม → /.test(JSON.stringify(msg)), "ข้อความระดับถัดไปต้องเป็นรูป อีก X แต้ม → ระดับ");
assert.equal(barOf(silver).backgroundColor, BRAND.navy, "Silver: สีระดับสว่าง หลอดต้องใช้น้ำเงินเข้ม");
for (const [tier, t] of Object.entries(TIER_THEME)) assert(contrast(t.bar, "#DDE2EA") >= 3, `หลอด ${tier} คอนทราสต์กับรางต่ำกว่า 3:1`);
const inactive = pointsFlex({ name: "ก", tierName: "Silver", tierEmoji: "🥈", tierColor: TIER_COLOR.Silver, points: 845, totalEarned: 2400, tierMin: 500, next: { name: "Gold", emoji: "🥇", min: 2000 }, inactiveRealTier: "🥇 Gold" });
assert(!barOf(inactive), "ระดับพักอยู่: ห้ามโชว์หลอด (แต้มสะสมเกินเกณฑ์แล้ว)");
assert(JSON.stringify(inactive).includes(BRAND.warnBg), "ระดับพักอยู่: คำเตือนต้องอยู่ในกล่องสีเตือน");

// ---------- ติดต่อฝ่ายขาย ----------
{
  const contact = examples.find(([name]) => name === "ติดต่อฝ่ายขาย")[1];
  const [intro, ...staff] = contact.contents.contents;
  assert(!intro.hero && intro.header?.backgroundColor === BRAND.navy && JSON.stringify(intro.header).includes("/dk-logo.jpg"), "contactFlex: ใบร้านใช้หัวน้ำเงิน + โลโก้ (แบนเนอร์ตัวหนังสือเล็กอ่านไม่ออกที่ kilo)");
  assert.equal(intro.body.justifyContent, "space-between", "contactFlex: เนื้อใบร้านต้องดันกล่องเวลาทำการลงล่าง ปุ่มตรงกับการ์ดพนักงาน");
  assert.equal(JSON.stringify(contact).split('"พนักงานขาย').length - 1, 1, "contactFlex: ป้าย 'พนักงานขาย' มีครั้งเดียวที่ใบร้าน");
  assert.equal(intro.footer.layout, "vertical", "contactFlex: ปุ่มใบร้านต้องซ้อนเต็มความกว้างเหมือนการ์ดพนักงาน (ขอบล่างตรงกัน)");
  assert(!JSON.stringify(intro).includes(SHOP.lineId), "contactFlex: ไม่ต้องมีแถว LINE ร้าน (ลูกค้าคุยอยู่ในบัญชีนี้แล้ว)");
  assert.equal(JSON.stringify(intro).split(SHOP.hours).length - 1, 1, "contactFlex: ใบร้านต้องแสดงเวลาทำการบรรทัดเดียว");
  assert.equal(staff.length, 4, "contactFlex: ต้องมีการ์ดพนักงาน 4 ใบ");
  for (const bubble of staff) {
    assert(!bubble.hero, "contactFlex: การ์ดพนักงานห้ามมีแบนเนอร์ซ้ำ");
    assert(!JSON.stringify(bubble).includes(SHOP.hours), "contactFlex: การ์ดพนักงานห้ามมีบรรทัดเวลาซ้ำ");
    assert.equal(bubble.body.contents[0].cornerRadius, "md", "contactFlex: รูปพนักงานต้องมุมมน");
    assert(!bubble.header, "contactFlex: การ์ดพนักงานไม่ต้องมีหัวซ้ำ 4 ใบ");
    const [call, line] = bubble.footer.contents;
    assert.equal(call.style, "primary", "contactFlex: ปุ่มโทรเป็นปุ่มหลัก");
    assert.equal(line.style, "secondary", "contactFlex: ปุ่ม LINE เป็นปุ่มรอง");
    assert(!/🟢/u.test(line.action.label), "contactFlex: ปุ่ม LINE ไม่ใช้อีโมจิ 🟢");
    assert(/^💬 /u.test(line.action.label) && /^📞 /u.test(call.action.label), "contactFlex: ปุ่มคู่ต้องมีไอคอนทั้งสองปุ่ม (📞/💬)");
    assert(line.action.label.includes(`LINE ${SALES_STAFF[staff.indexOf(bubble)].name}`), "contactFlex: ปุ่ม LINE ต้องบอกชื่อพนักงาน");
    assert.equal(bubble.footer.layout, "vertical", "contactFlex: ปุ่มพนักงานซ้อนเต็มความกว้าง");
  }
  // ห้ามแต่งความเชี่ยวชาญพนักงานขึ้นเอง: ข้อความในการ์ดพนักงานมีแค่ชื่อ (ไม่มีข้อมูลความถนัดจริง)
  for (const [i, bubble] of staff.entries()) {
    const texts = [];
    walk(bubble.body, (n) => { if (n && n.type === "text") texts.push(n.text); });
    assert.deepEqual(texts, [SALES_STAFF[i].name], "contactFlex: การ์ดพนักงานมีข้อความเกินชื่อ");
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
  ["ป้ายวันเหลือ", "#FFFFFF", BRAND.warn], ["ป้ายหมดอายุ", "#9B2C2C", "#FBE9E9"], ["ไอคอนต้อนรับ", BRAND.navy, BRAND.sky], ["ป้ายในกล่องข้อมูล", BRAND.muted, BRAND.panel],
  ["success บนขาว", BRAND.success, "#FFFFFF"], ["แต้มวันเกิดบนขาว", TONE_STYLE.birthday.eyebrow, "#FFFFFF"], ["ป้ายพักระดับ", "#FFFFFF", BRAND.warn], ["ป้ายโลโก้ใบร้าน", TIER_COLOR.Gold, BRAND.navy], ["warn บนขาว", BRAND.warn, "#FFFFFF"],
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

// ---------- ตัวเลขตัวอย่างต้องเป็นไปได้จริง ----------
// "สะสมเลื่อนระดับ X / Y": Y ต้องเป็นเกณฑ์ระดับจริง และ X ต้องอยู่ในระดับที่อยู่ก่อน Y พอดี
{
  const mins = Object.values(TIER_MIN).sort((a, b) => a - b);
  for (const [name, message] of examples) {
    for (const m of JSON.stringify(message).matchAll(/(?:สะสมเลื่อนระดับ|แต้มสะสม) ([\d,]+) \/ ([\d,]+)/g)) {
      const [x, y] = [m[1], m[2]].map((v) => Number(v.replace(/,/g, "")));
      const i = mins.indexOf(y);
      assert(i > 0, `${name}: ${y} ไม่ใช่เกณฑ์ระดับ`);
      assert(x >= mins[i - 1] && x < y, `${name}: สะสม ${x} ไม่อยู่ในช่วงระดับก่อน ${y} (ตัวเลขเป็นไปไม่ได้)`);
    }
  }
}

// ---------- ต้อนรับ: ส่วนลดต้องบอกช่วงและระดับเริ่มต้นตามจริง ----------
{
  const w = JSON.stringify(welcomeFlex());
  const tiers = tierOrder.filter((t) => MEMBER_BENEFITS[t].discount > 0);
  const lo = MEMBER_BENEFITS[tiers[0]].discount, hi = Math.max(...tiers.map((t) => MEMBER_BENEFITS[t].discount));
  const pts = (t) => TIER_MIN[t].toLocaleString("en-US");
  assert(w.includes(`${lo}–${hi}% เมื่อสะสมครบ ${pts(tiers[0])} แต้ม`), `welcomeFlex: ต้องบอกส่วนลด ${lo}–${hi}% เมื่อสะสมครบ ${pts(tiers[0])} แต้ม`);
  // ผู้ติดตามใหม่ยังไม่รู้จักชื่อระดับ → ไม่พูดชื่อระดับ/ศัพท์ "Bronze+" · แถวละสิทธิ์เดียว (ไม่มี " + ")
  assert(!tierOrder.some((t) => w.includes(t)) && !w.includes(" + "), "welcomeFlex: ห้ามใช้ชื่อระดับหรือรวมสองสิทธิ์ในแถวเดียว");
  assert(!/ลดสูงสุด/.test(w), "welcomeFlex: ห้ามเขียน 'ลดสูงสุด' ลอย ๆ (ส่วนลดเริ่มที่ Silver)");
  const bdFrom = tierOrder.find((t) => MEMBER_BENEFITS[t].birthday > 0);
  assert(w.includes(`"text":"แต้มวันเกิดทุกปี"`) && w.includes(`"text":"เมื่อสะสมครบ ${pts(bdFrom)} แต้ม"`), `welcomeFlex: แต้มวันเกิดต้องบอกเกณฑ์ ${pts(bdFrom)} แต้ม`);
}

// ---------- เลื่อนระดับ: ไม่ใช้เหรียญ ไม่เคลมสิทธิ์เกินกติกา บอกระดับถัดไป ----------
for (const [i, tier] of tierOrder.entries()) {
  if (tier === "Welcome") continue;
  const m = tierUpFlex({ name: "ก", tierName: tier, tierEmoji: "🥇", points: 1, earned: 1, billNo: "X" });
  const j = JSON.stringify(m);
  assert(!/[🥇🥈🥉]/u.test(j), `tierUpFlex ${tier}: ห้ามใช้เหรียญ 🥇🥈🥉 (ลำดับเหรียญกลับด้านกับระดับ)`);
  const b = MEMBER_BENEFITS[tier];
  // บรรทัด ✓ = สิทธิ์ที่ได้แล้ว ต้องตรง MEMBER_BENEFITS ของระดับนั้นพอดี
  const checks = [];
  walk(m.contents.body, (n) => { if (n && n.type === "box" && n.contents?.[0]?.text === "✓") checks.push(n.contents[1].text); });
  assert.equal(checks.some((t) => t.includes("ส่วนลดหน้าร้าน")), b.discount > 0, `tierUpFlex ${tier}: บรรทัดส่วนลดไม่ตรงกติกา`);
  assert.equal(checks.some((t) => t.includes("เหล็ก")), b.steelBonus > 0, `tierUpFlex ${tier}: บรรทัดแต้มคืนเหล็กไม่ตรงกติกา`);
  assert.equal(checks.some((t) => t.includes(`วันเกิด ${b.birthday.toLocaleString("en-US")} แต้ม`)), b.birthday > 0, `tierUpFlex ${tier}: บรรทัดวันเกิดไม่ตรงกติกา`);
  assert(!j.includes("100 บาท = 1 แต้ม"), `tierUpFlex ${tier}: สิทธิ์พื้นฐานไม่ใช่สิทธิ์ที่เพิ่งปลดล็อก`);
  const next = tierOrder[i + 1];
  if (next) assert(j.includes(`"text":"${next}"`) && j.includes(` · ครบ ${TIER_MIN[next].toLocaleString("en-US")} แต้ม`), `tierUpFlex ${tier}: ต้องบอกระดับถัดไป ${next}`);
  else assert(!j.includes("ระดับถัดไป"), "tierUpFlex Diamond: ไม่มีระดับถัดไป");
}

// ---------- ยกเลิกคำขอ: แต้มแค่ถูกจอง ไม่เคยถูกหัก → ห้ามพูดว่า "คืน" ----------
for (const [name, message] of examples.filter(([n]) => n.startsWith("ยกเลิกคำขอ"))) {
  const j = JSON.stringify(message);
  assert(!/คืน|\+[\d,]+/.test(j), `${name}: ห้ามสื่อว่าคืนแต้ม/ได้แต้มเพิ่ม (แต้มไม่เคยถูกหัก)`);
  assert(j.includes("ไม่ถูกหัก"), `${name}: ต้องบอกว่าแต้มไม่ถูกหัก`);
}
{
  const find = (n) => JSON.stringify(examples.find(([name]) => name === n)[1]);
  const fullNotices = examples.slice(NOTICE_START).map(([, m]) => m);
  // หัวข้อการ์ดแจ้งเตือนไม่มีอีโมจิ
  for (const m of fullNotices) assert(!/\p{Extended_Pictographic}/u.test(m.contents.header.contents[1].text), `หัวข้อห้ามมีอีโมจิ: ${m.contents.header.contents[1].text}`);
  // หมดอายุทั้งหมด → หัวข้อต้องไม่พูดว่า "บางส่วน"
  const allGone = examples.find(([n]) => n === "แต้มหมดอายุ (ไม่เหลือแต้ม)")[1];
  assert(!allGone.contents.header.contents[1].text.includes("บางส่วน"), "pointsExpiredFlex: ยอดเหลือ 0 ห้ามใช้หัวข้อ 'บางส่วน'");
  assert(!find("แต้มหมดอายุ").includes('"text":"หมดอายุ"'), "pointsExpiredFlex: ตัวเลขขีดฆ่าบอกแล้ว ไม่ต้องมีป้าย 'หมดอายุ' ซ้ำ");
  assert(find("แต้มหมดอายุ").includes("ยังใช้ได้ 2,150 แต้ม"), "pointsExpiredFlex: มียอดเหลือต้องบอก 'ยังใช้ได้ X แต้ม' ในบล็อกตัวเลข");
  for (const n of ["แต้มหมดอายุ", "แต้มหมดอายุ (ไม่เหลือแต้ม)"]) assert.equal(find(n).split("1 ปี").length - 1, 1, `${n}: พูด '1 ปี' ครั้งเดียว`);
  assert(find("แต้มใกล้หมดอายุ (ข้อมูลเดิม)").includes('"text":"อีก 30 วัน"'), "pointsExpiringFlex: จำนวนวันต้องเป็นป้ายแยก");
  for (const n of ["แต้มใกล้หมดอายุ (ข้อมูลเดิม)", "แต้มหมดอายุ"]) assert(find(n).includes("คุณสมชาย"), `${n}: ต้องทักชื่อ`);
  // วันเกิดใช้ชื่อระดับ
  assert(find("ของขวัญวันเกิด").includes("ของขวัญวันเกิดสมาชิก Gold"), "birthdayGiftFlex: ต้องบอกว่าเป็นของขวัญตามระดับ");
  assert(find("ของขวัญวันเกิด (มียอดคงเหลือ)").includes("2,950 แต้ม"), "birthdayGiftFlex: ส่ง balance แล้วต้องมีแถวแต้มคงเหลือ");
  assert(!/\p{Extended_Pictographic}/u.test(examples.find(([n]) => n === "ของขวัญวันเกิด")[1].contents.header.contents[0].text), "birthdayGiftFlex: eyebrow ไม่ใช้อีโมจิ");
  // รับของแล้วใช้โทนสำเร็จ
  const conf = examples.find(([n]) => n === "รับของรางวัล")[1];
  assert.equal(conf.contents.header.backgroundColor, TONE_STYLE.success.background, "redemptionConfirmedFlex: หัวต้องเป็นโทนสำเร็จ");
  // ตั๋วใช้ hair space
  assert(find("จองของรางวัล").includes("#\u200AR\u200AE"), "ticketCode: ต้องเว้นด้วย U+200A");
  // ยกเลิก: มีป้ายเหนือตัวเลข + ประโยคขออภัยเสมอ
  const cancel = find("ยกเลิกคำขอ (ข้อมูลเดิม)");
  assert(cancel.includes("แต้มของคำขอนี้") && cancel.includes("ขออภัย"), "redemptionCancelledFlex: ต้องมีป้ายเหนือตัวเลขและประโยคขออภัย");
  assert.equal(cancel.split("1,500").length - 1, 1, "redemptionCancelledFlex: ตัวเลขแต้มของคำขอต้องปรากฏครั้งเดียว");
  {
    const r = examples.find(([n]) => n === "ยกเลิกคำขอ (มีเหตุผลและยอด)")[1];
    const panel = r.contents.body.contents.find((c) => c.backgroundColor === BRAND.panel);
    assert.deepEqual(panel.contents.map((row) => row.contents[0].text), ["เหตุผล", "ของรางวัล", "แต้มคงเหลือ"], "redemptionCancelledFlex: เหตุผลเป็นแถวแรกในกล่องข้อมูล");
    assert.equal(panel.contents[0].contents[1].text, "สินค้าหมด");
    assert(!JSON.stringify(r).includes("ยกเลิกเพราะ"), "redemptionCancelledFlex: ไม่ใช้รูป 'ยกเลิกเพราะ:' แบบ log");
    let big = null, ok = null;
    walk(r.contents.body, (n) => { if (n?.type === "span" && n.text === "1,500") big = n; if (n?.type === "text" && n.text?.startsWith("✓ ไม่ถูกหัก")) ok = n; });
    assert(big.size === "xl" && ok?.color === BRAND.success, "redemptionCancelledFlex: ตัวเลข xl · คำยืนยัน ✓ ไม่ถูกหัก สีเขียว");
  }
  assert(find("ยกเลิกคำขอ (มีเหตุผลและยอด)").includes("แต้มคงเหลือ"), "redemptionCancelledFlex: มีเหตุผลแล้วต้องยังโชว์แต้มคงเหลือ");
  assert(!/"text":"หมายเลขคำขอ"/.test(cancel) && cancel.includes("หมายเลขคำขอ #REQ-88"), "redemptionCancelledFlex: หมายเลขคำขอเป็นหมายเหตุท้ายการ์ด ไม่ใช่แถว");
  assert(!/ปลด|จองไว้/.test(cancel), "redemptionCancelledFlex: ห้ามใช้คำระบบ ปลด/จองไว้");
  // เลื่อนระดับ: ชื่อระดับไม่ซ้ำในหัวข้อ/ปุ่ม
  const up = examples.find(([n]) => n === "เลื่อนระดับ")[1];
  assert(up.contents.header.contents[1].text === "เลื่อนระดับแล้ว" && !JSON.stringify(up.contents.footer).includes("Gold"), "tierUpFlex: หัวข้อกลาง ๆ ชื่อระดับอยู่ที่ป้ายใหญ่ ปุ่มไม่ซ้ำชื่อระดับ");
  assert.equal(JSON.stringify(up.contents).split("Gold").length - 1, 0, "tierUpFlex: ชื่อระดับแสดงครั้งเดียว (ป้าย GOLD)");
  assert(!JSON.stringify(up).includes("ได้เพิ่ม"), "tierUpFlex: ตัดบรรทัดสิทธิ์ระดับถัดไป (การ์ดยาวเกิน)");
  for (const t of tierOrder.slice(1)) {
    const h = tierUpFlex({ name: "ก", tierName: t, tierEmoji: "", points: 1, earned: 1, billNo: "X" }).contents.header.contents[1];
    assert.equal(h.size, "xl", `tierUpFlex ${t}: หัวข้อต้องเป็น xl (${h.text})`);
  }
  const upJson = JSON.stringify(up);
  assert(!upJson.includes("\\n"), "tierUpFlex: สิทธิ์ระดับถัดไปเป็นบรรทัดเดียว ไม่ซ้อนหลายบรรทัด");
  assert(!upJson.includes('"size":"xxs"'), "tierUpFlex: หมายเหตุบิลต้องไม่เล็กกว่า xs");
  // ใกล้ลดระดับ: ป้ายอยู่เหนือวันที่ ค่าใหญ่เป็นวันที่อย่างเดียว
  const exp = find("รักษาระดับ (ข้อมูลครบ)");
  assert(exp.includes('"text":"ซื้อสินค้า 1 บิลภายใน"') && exp.includes('"text":"16 ตุลาคม 2569"'), "tierExpiryWarningFlex: ป้ายเหนือวันที่");
  assert(exp.includes("DK MEMBER · ระดับ Platinum"), "tierExpiryWarningFlex: eyebrow ต้องบอกระดับที่กำลังจะหมดอายุ");
  assert(!JSON.stringify(examples.filter(([n]) => n.startsWith("รักษาระดับ"))).includes("คิดจากแต้มคงเหลือ"), "tierExpiryWarningFlex: ห้ามใช้ศัพท์ระบบ 'คิดจากแต้มคงเหลือ'");
  for (const [n, m] of examples.filter(([n]) => n.startsWith("รักษาระดับ"))) assert.equal(m.contents.footer.contents.length, 1, `${n}: ปุ่มเดียว (ติดต่อฝ่ายขายอยู่ใน quick reply)`);
  const bare = examples.find(([n]) => n === "รักษาระดับ (ข้อมูลเดิม)")[1];
  assert(JSON.stringify(bare).includes('"text":"ถ้าไม่มีบิลใหม่ ระดับอาจลดลงค่ะ"'), "tierExpiryWarningFlex: ข้อความสำรองสั้น ไม่ให้ 'ค่ะ' ตกบรรทัดเดี่ยว");
  // สิทธิ์ที่จะเสียคำนวณจาก MEMBER_BENEFITS (Gold → Silver: ส่วนลด 2% → 1%, คืนเหล็ก 1% → ไม่มี)
  const dropJ = JSON.stringify(tierExpiryWarningFlex({ name: "ก", tierName: "Gold", points: 800 }));
  assert(dropJ.includes(`"text":"ส่วนลด"`) && dropJ.includes(`${MEMBER_BENEFITS.Gold.discount}% → ${MEMBER_BENEFITS.Silver.discount}%`) && dropJ.includes(`${MEMBER_BENEFITS.Gold.steelBonus}% → ไม่มี`), "tierExpiryWarningFlex: ต้องบอกสิทธิ์ที่จะเสียจาก MEMBER_BENEFITS");
  assert(!JSON.stringify(tierExpiryWarningFlex({ name: "ก", tierName: "Gold", points: 3000 })).includes("→"), "tierExpiryWarningFlex: ระดับไม่ตกห้ามโชว์สิทธิ์ที่จะเสีย");
  // หมดอายุหมด: ไม่มีกล่อง 0 แต้ม
  const zero = examples.find(([n]) => n === "แต้มหมดอายุ (ไม่เหลือแต้ม)")[1];
  assert(!zero.contents.body.contents.some((c) => c.backgroundColor === BRAND.panel) && JSON.stringify(zero).includes("ตัดออกจากบัญชีแล้ว · คงเหลือ 0 แต้ม"), "pointsExpiredFlex: ยอด 0 ไม่ต้องมีกล่อง บอกในคำอธิบาย");
  assert(find("แต้มหมดอายุ").includes("แต้มมีอายุ 1 ปีค่ะ ใช้แต้มที่เหลือแลกของรางวัลได้เลย"), "pointsExpiredFlex: ข้อความทักแล้วต่อด้วยสิ่งที่ทำได้");
  // วันเกิด: คำอวยพรก่อนตัวเลข · ตัวเลขสีวันเกิด
  const bd = examples.find(([n]) => n === "ของขวัญวันเกิด")[1].contents.body.contents;
  assert(bd[0].type === "text" && bd[0].text.includes("ขอให้ปีนี้"), "birthdayGiftFlex: คำอวยพรต้องมาก่อนตัวเลข");
  assert(JSON.stringify(bd[1]).includes(TONE_STYLE.birthday.eyebrow), "birthdayGiftFlex: ตัวเลขใช้สีวันเกิด ไม่ใช่เขียวแบบใบเสร็จ");
  // ต้อนรับ: ซับไตเติลไม่ซ้ำแบนเนอร์ + ไอคอนชุดเดียว
  const w = welcomeFlex();
  assert(!JSON.stringify(w).includes("ครบจบที่เดียว"), "welcomeFlex: ซับไตเติลต้องเป็นเหตุผลที่ควรสมัคร");
  assert(!/[⭐🏷🎁♥]/u.test(JSON.stringify(w.contents.body)), "welcomeFlex: ไอคอนแถวใช้ชุดเดียวกัน ไม่ใช้อีโมจิ/หัวใจ");
  assert(!JSON.stringify(w.contents.body).includes("\\n"), "welcomeFlex: คำอธิบายแถวสิทธิ์ต้องไม่ขึ้นบรรทัดใหม่เอง");
  assert(!JSON.stringify(w.contents.body.contents[1]).includes("แลกของรางวัล"), "welcomeFlex: ซับไตเติลไม่ซ้ำกับแถวของรางวัล");
}
// ---------- รอบรีวิว 7: ไม่ใช้ 🎴 (ไพ่ฮานาฟุดะ) เป็นไอคอนบัตรสมาชิก · ไม่ใช้เหรียญระดับบนหัวเช็คแต้ม/eyebrow ----------
{
  for (const [name, message] of examples) assert(!JSON.stringify(message).includes("🎴"), `${name}: ใช้ 💳 แทน 🎴`);
  assert(!/[🥇🥈🥉]/u.test(JSON.stringify(gold.contents.header)), "pointsFlex: หัวบัตรไม่ใช้เหรียญระดับ");
  assert(!/[🥇🥈🥉]/u.test(JSON.stringify(examples.find(([n]) => n === "ได้แต้มจากบิล (มีระดับ)")[1].contents.header)), "pointsEarnedFlex: eyebrow ไม่ใช้เหรียญระดับ");
  assert.equal(silver.contents.header.backgroundColor, "#B8C4CC", "pointsFlex Silver: เงินโลหะ ไม่ใช่เทาซีดแบบปิดใช้งาน");
  assert(gold.contents.footer.contents.every((b) => b.height === "md"), "pointsFlex: ปุ่มท้ายบัตรสูง md เท่าการ์ดแจ้งเตือน");
  assert(JSON.stringify(inactive).includes('ระดับสะสม Gold"'), "pointsFlex: ตัดอีโมจิจาก inactiveRealTier");
  assert(JSON.stringify(examples.find(([n]) => n === "จองของรางวัล")[1]).includes('"text":"แต้มคงเหลือ"'), "redemptionRequestedFlex: ใช้ป้าย 'แต้มคงเหลือ' ให้ตรงการ์ดอื่น");
}
// ---------- รอบรีวิว 8: ไอคอนในเนื้อการ์ดเป็นตัวอักษรเท่านั้น (อีโมจิใช้ได้ที่ altText และป้ายปุ่ม) ----------
{
  const emoji = /[\p{Emoji_Presentation}\u26A0\uFE0F]/u;
  for (const [name, message] of [...examples, ["เช็คแต้ม (พักระดับ)", inactive], ["เช็คแต้ม (สูงสุด)", pointsFlex({ name: "ก", tierName: "Diamond", tierEmoji: "💎", tierColor: TIER_COLOR.Diamond, points: 9000, totalEarned: 12000, tierMin: 10000, next: null })]]) {
    const bubbles = message.contents.type === "carousel" ? message.contents.contents : [message.contents];
    for (const b of bubbles) walk([b.header, b.body], (n) => {
      if (n && (n.type === "text" || n.type === "span") && n.text) assert(!emoji.test(n.text), `${name}: อีโมจิในเนื้อการ์ด "${n.text}"`);
    });
  }
}
console.log("✓ ตัวเลขตัวอย่างเป็นไปได้ · ข้อความต้อนรับ/เลื่อนระดับ/ยกเลิกตรงกติกา · รายการรีวิวรอบ 6–7");

console.log(`ตรวจโครงสร้างและเนื้อหาผ่าน ${examples.length}/${examples.length} ตัวอย่าง (local only · ไม่เรียก LINE API)`);
