import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BRAND, SHOP, TIER_COLOR, TIER_TEXT, MEMBER_BENEFITS,
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
  ["ได้แต้มจากบิล (ข้อมูลเดิม)", pointsEarnedFlex({ name: "คุณสมชาย", points: 1250, balance: 8450, billNo: "IV-690001" })],
  ["ได้แต้มจากบิล (มีระดับ)", pointsEarnedFlex({ name: "คุณสมชาย", points: 1250, balance: 8450, billNo: "IV-690001", tierName: "Gold", tierEmoji: "🥇", totalEarned: 3200, tierMin: 2000, next: { name: "Platinum", emoji: "🔱", min: 5000 } })],
  ["เลื่อนระดับ", tierUpFlex({ name: "คุณสมชาย", tierName: "Gold", tierEmoji: "🥇", points: 8450, earned: 1250, billNo: "IV-690001" })],
  ["ของขวัญวันเกิด", birthdayGiftFlex({ name: "คุณสมชาย", tierName: "Gold", tierEmoji: "🥇", points: 500 })],
  ["แต้มใกล้หมดอายุ (ข้อมูลเดิม)", pointsExpiringFlex({ name: "คุณสมชาย", points: 1250, daysLeft: 30, expiryDate: "16 ตุลาคม 2569" })],
  ["แต้มใกล้หมดอายุ (มียอดคงเหลือ)", pointsExpiringFlex({ name: "คุณสมชาย", points: 1250, daysLeft: 30, expiryDate: "16 ตุลาคม 2569", balance: 7200 })],
  ["แต้มหมดอายุ", pointsExpiredFlex({ name: "คุณสมชาย", points: 1250, balance: 7200 })],
  ["จองของรางวัล", redemptionRequestedFlex({ rewardName: "สว่านไร้สาย", points: 2500, requestId: 88, availablePoints: 5950 })],
  ["รับของรางวัล", redemptionConfirmedFlex({ rewardName: "สว่านไร้สาย", points: 2500, balance: 5950 })],
  ["ยกเลิกคำขอ (ข้อมูลเดิม)", redemptionCancelledFlex({ rewardName: "สว่านไร้สาย", points: 2500, requestId: 88 })],
  ["ยกเลิกคำขอ (มีเหตุผล)", redemptionCancelledFlex({ rewardName: "สว่านไร้สาย", points: 2500, requestId: 88, reason: "สินค้าหมด" })],
  ["รักษาระดับ (ข้อมูลเดิม)", tierExpiryWarningFlex({ name: "คุณสมชาย" })],
  ["รักษาระดับ (ข้อมูลครบ)", tierExpiryWarningFlex({ name: "คุณสมชาย", tierName: "Gold", deadline: "16 ตุลาคม 2569", lastPurchaseDate: "16 ตุลาคม 2568" })],
];

const forbiddenColors = new Set(["#F26A1B", "#2E3192"]);

function walk(value, visit, path = "message") {
  visit(value, path);
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, visit, `${path}[${index}]`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => walk(item, visit, `${path}.${key}`));
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
}

for (const [name, message] of examples) {
  validateFlex(name, message);
  console.log(`✓ ${name}`);
}

const notices = examples.slice(4);
for (const [name, message] of notices) {
  assert(/^[⭐🎉🎂⏳🔔🎁✅↩️📌]/u.test(message.altText), `${name}: altText ต้องขึ้นต้นด้วยอีโมจิสถานะ`);
  const title = message.contents.header?.contents?.[1]?.text ?? "";
  assert(!title.endsWith("ค่ะ"), `${name}: หัวข้อต้องไม่ลงท้ายด้วย ค่ะ`);
  const panels = message.contents.body?.contents?.filter((item) => item.backgroundColor === BRAND.panel) ?? [];
  for (const panel of panels) assert(panel.contents.length <= 3, `${name}: กล่องข้อมูลเกิน 3 แถว`);
  assert((message.contents.footer?.contents?.length ?? 0) <= 2, `${name}: มีปุ่มเกิน 2 ปุ่ม`);
}

const gold = examples.find(([name]) => name === "เช็คแต้ม Gold")[1];
const silver = examples.find(([name]) => name === "เช็คแต้ม Silver")[1];
assert.equal(gold.contents.header.contents[0].contents[0].color, TIER_TEXT.Gold, "Gold ต้องใช้ตัวอักษรน้ำเงิน");
assert.equal(silver.contents.header.contents[0].contents[0].color, TIER_TEXT.Silver, "Silver ต้องใช้ตัวอักษรน้ำเงิน");

const contact = examples.find(([name]) => name === "ติดต่อฝ่ายขาย")[1];
for (const bubble of contact.contents.contents) {
  const json = JSON.stringify(bubble);
  assert(json.includes(SHOP.hours), "contactFlex ต้องใช้ SHOP.hours");
  assert.equal(json.split(SHOP.hours).length - 1, 1, "contactFlex ต้องแสดงเวลาร้านบรรทัดเดียว");
}

// สิทธิ์บนการ์ด (MEMBER_BENEFITS) ต้องตรงกับกติกาจริง — อ่านตัวเลขจากไฟล์ต้นทาง (ไม่ import เพราะไฟล์นั้นต่อฐานข้อมูล)
const root = new URL("../", import.meta.url);
const readArr = (file, re) => {
  const m = fs.readFileSync(new URL(file, root), "utf8").match(re);
  assert(m, `อ่านตัวเลขกติกาจาก ${file} ไม่ได้`);
  return m[1].split(",").map((x) => Number(x.trim()));
};
const tierOrder = ["Welcome", "Bronze", "Silver", "Gold", "Platinum", "Diamond"];
const retail = readArr("lib/tierRules.ts", /retail:\s*\{[^}]*byTier:\s*\[([^\]]+)\]/);
const steel = readArr("lib/tierRules.ts", /steel:\s*\{[^}]*byTier:\s*\[([^\]]+)\]/);
const birthday = readArr("app/api/cron/birthday/route.ts", /BIRTHDAY_POINTS\s*=\s*\[([^\]]+)\]/);
tierOrder.forEach((tier, i) => {
  assert.deepEqual(MEMBER_BENEFITS[tier], { discount: retail[i], steelBonus: steel[i], birthday: birthday[i] }, `MEMBER_BENEFITS.${tier} ไม่ตรงกับ tierRules/birthday cron`);
});
console.log("✓ สิทธิ์ระดับบนการ์ดตรงกับ lib/tierRules.ts และ cron วันเกิด");

console.log(`ตรวจโครงสร้างและเนื้อหาผ่าน ${examples.length}/${examples.length} ตัวอย่าง (local only · ไม่เรียก LINE API)`);
