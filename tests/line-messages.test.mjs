import { test, eq, ok } from "./_harness.mjs";
import {
  pointsEarnedFlex, tierUpFlex, birthdayGiftFlex, pointsExpiringFlex,
  pointsExpiredFlex, redemptionRequestedFlex, redemptionConfirmedFlex,
  redemptionCancelledFlex, tierExpiryWarningFlex,
} from "../lib/line-ui.ts";

const examples = [
  ["ได้แต้มจากบิล", pointsEarnedFlex({ name: "คุณสมชาย", points: 12345, balance: 22345, billNo: "IV-1001" }), true],
  ["เลื่อนระดับ", tierUpFlex({ name: "คุณสมชาย", tierName: "Gold", tierEmoji: "🥇", points: 22345, earned: 12345, billNo: "IV-1001" }), true],
  ["ของขวัญวันเกิด", birthdayGiftFlex({ name: "คุณสมชาย", tierName: "Gold", tierEmoji: "🥇", points: 12345 }), true],
  ["แต้มใกล้หมดอายุ", pointsExpiringFlex({ name: "คุณสมชาย", points: 12345, daysLeft: 30, expiryDate: "16 ตุลาคม 2569" }), true],
  ["แต้มหมดอายุ", pointsExpiredFlex({ name: "คุณสมชาย", points: 12345, balance: 22345 }), true],
  ["ส่งคำขอแลก", redemptionRequestedFlex({ rewardName: "สว่านไร้สาย", points: 12345, requestId: 88, availablePoints: 22345 }), true],
  ["ยืนยันแลก", redemptionConfirmedFlex({ rewardName: "สว่านไร้สาย", points: 12345, balance: 22345 }), true],
  ["ยกเลิกคำขอ", redemptionCancelledFlex({ rewardName: "สว่านไร้สาย", points: 12345, requestId: 88 }), true],
  ["ใกล้ลดระดับ", tierExpiryWarningFlex({ name: "คุณสมชาย" }), false],
];

function allNodes(value) {
  if (!value || typeof value !== "object") return [];
  return [value, ...Object.values(value).flatMap(allNodes)];
}

for (const [name, message, hasPoints] of examples) {
  test(`${name}: เป็น Flex มี altText และปุ่มลิงก์`, () => {
    eq(message.type, "flex");
    ok(typeof message.altText === "string" && message.altText.trim().length > 0, "altText ต้องไม่ว่าง");
    const uriButtons = allNodes(message).filter((node) => node.type === "button" && node.action?.type === "uri");
    ok(uriButtons.length > 0, "ต้องมีปุ่มลิงก์");
    ok(uriButtons.every((node) => /^https:\/\//.test(node.action.uri)), "ลิงก์ต้องเป็น https");
  });
  if (hasPoints) {
    test(`${name}: จัดรูปแบบแต้มหลักพันด้วยคอมมา`, () => {
      ok(JSON.stringify(message).includes("12,345"), "ไม่พบแต้มรูปแบบ 12,345");
    });
  }
}
