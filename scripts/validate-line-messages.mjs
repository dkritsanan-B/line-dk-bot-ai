import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  pointsEarnedFlex, tierUpFlex, birthdayGiftFlex, pointsExpiringFlex,
  pointsExpiredFlex, redemptionRequestedFlex, redemptionConfirmedFlex,
  redemptionCancelledFlex, tierExpiryWarningFlex,
} from "../lib/line-ui.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at < 1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) throw new Error("ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน environment หรือ .env.local");

const examples = [
  ["ได้แต้มจากบิล", pointsEarnedFlex({ name: "คุณสมชาย", points: 1250, balance: 8450, billNo: "IV-690001" })],
  ["เลื่อนระดับ", tierUpFlex({ name: "คุณสมชาย", tierName: "Gold", tierEmoji: "🥇", points: 8450, earned: 1250, billNo: "IV-690001" })],
  ["ของขวัญวันเกิด", birthdayGiftFlex({ name: "คุณสมชาย", tierName: "Gold", tierEmoji: "🥇", points: 500 })],
  ["แต้มใกล้หมดอายุ", pointsExpiringFlex({ name: "คุณสมชาย", points: 1250, daysLeft: 30, expiryDate: "16 ตุลาคม 2569" })],
  ["แต้มหมดอายุ", pointsExpiredFlex({ name: "คุณสมชาย", points: 1250, balance: 7200 })],
  ["ส่งคำขอแลกของ", redemptionRequestedFlex({ rewardName: "สว่านไร้สาย", points: 2500, requestId: 88, availablePoints: 5950 })],
  ["พนักงานยืนยันแลกของ", redemptionConfirmedFlex({ rewardName: "สว่านไร้สาย", points: 2500, balance: 5950 })],
  ["ยกเลิกคำขอ", redemptionCancelledFlex({ rewardName: "สว่านไร้สาย", points: 2500, requestId: 88 })],
  ["ใกล้ลดระดับ", tierExpiryWarningFlex({ name: "คุณสมชาย" })],
];

const endpoint = "https://api.line.me/v2/bot/message/validate/push";
for (const [name, message] of examples) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [message] }),
  });
  if (!response.ok) throw new Error(`${name}: LINE validate ไม่ผ่าน (${response.status}) ${await response.text()}`);
  console.log(`✓ ${name}`);
}
console.log(`ตรวจผ่าน ${examples.length}/${examples.length} ข้อความ (validate เท่านั้น ไม่มีการส่งข้อความจริง)`);
