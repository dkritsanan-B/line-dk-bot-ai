export const runtime = "nodejs";
// cold start + Neon + Gemini + reply เคยเกิน 10 วิ (ค่าเริ่มต้น Vercel) → ฟังก์ชันถูกฆ่าก่อนตอบ ลูกค้ากดแล้วเงียบ (เจอ 14 ก.ย. 69 หลัง deploy)
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { getFaqContent } from "@/lib/sheet";
import { askGemini, generateQuizQuestion, checkQuizAnswer, explainAnswer } from "@/lib/gemini";
import { getUserByLineId, getEffectiveTier, getNextTier, TIERS } from "@/lib/points";
import { welcomeFlex, contactFlex, pointsFlex, locationMsg, quickReplies, textMsg, TIER_COLOR, SHOP } from "@/lib/line-ui";
import {
  migrateQuizDB, getQuizSession, ensureSession,
  startQuestion, clearQuestion, awardQuizPoint, QuizSession,
} from "@/lib/quiz";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? "";
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const QUIZ_TRIGGER = "🎮 เล่นเกมตอบคำถาม";
const MAX_QUESTIONS = 3;

let quizDbReady = false;
async function ensureQuizDB() {
  if (!quizDbReady) { await migrateQuizDB(); quizDbReady = true; }
}

function verifySignature(rawBody: string, signature: string): boolean {
  const hmac = crypto.createHmac("sha256", CHANNEL_SECRET);
  hmac.update(rawBody);
  return hmac.digest("base64") === signature;
}

async function sendReply(replyToken: string, text: string): Promise<void> {
  const res = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text, quickReply: quickReplies() }] }),   // แถบปุ่มลัดทุกข้อความ
  });
  if (!res.ok) console.error(`[line] reply failed status=${res.status} body=${await res.text()}`);
}

async function sendReplyButton(replyToken: string, text: string, label: string, uri: string): Promise<void> {
  const res = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({
      replyToken,
      messages: [{
        type: "template", altText: text,
        template: { type: "buttons", text, actions: [{ type: "uri", label, uri }] },
      }],
    }),
  });
  if (!res.ok) console.error(`[line] reply button failed status=${res.status} body=${await res.text()}`);
}

// ข้อความต้อนรับย้ายไปเป็นการ์ด welcomeFlex() ใน lib/line-ui.ts (14 ก.ย. 69)

// ── เกมตอบคำถาม: ประเมินคำตอบ ──────────────────────────────────
async function handleQuizAnswer(
  userId: number,
  replyToken: string,
  session: QuizSession,
  userAnswer: string,
): Promise<void> {
  const { current_question, current_answer, points_earned, questions_asked } = session;

  const isCorrect = await checkQuizAnswer(current_question!, current_answer!, userAnswer);
  await clearQuestion(userId);

  let msg = "";

  if (isCorrect) {
    msg += `✅ ถูกต้องค่ะ! คำตอบคือ "${current_answer}"\n\n`;
    if (points_earned === 0) {
      await awardQuizPoint(userId);
      msg += `🌟 ได้รับ 1 แต้มแล้วค่ะ!`;
    } else {
      msg += `(รับแต้มรางวัลประจำวันไปแล้วนะคะ 1 แต้ม/วัน 😊)`;
    }
    if (questions_asked < MAX_QUESTIONS) {
      msg += `\n\n📝 เหลืออีก ${MAX_QUESTIONS - questions_asked} คำถาม\nพิมพ์ "${QUIZ_TRIGGER}" เพื่อเล่นต่อค่ะ`;
    } else {
      msg += `\n\n🎉 เล่นครบแล้วค่ะ มาเล่นใหม่ได้พรุ่งนี้นะคะ 😊`;
    }
  } else {
    const explanation = await explainAnswer(current_question!, current_answer!);
    msg += `❌ ยังไม่ถูกนะคะ\n✨ คำตอบที่ถูกต้องคือ "${current_answer}"\n`;
    if (explanation) msg += `💡 ${explanation}\n`;
    msg += "\n";

    if (questions_asked < MAX_QUESTIONS) {
      const next = await generateQuizQuestion();
      if (next) {
        await startQuestion(userId, next.question, next.answer);
        msg += `📝 คำถามที่ ${questions_asked + 1}/${MAX_QUESTIONS}:\n\n${next.question}\n\n✏️ พิมพ์คำตอบได้เลยค่ะ`;
      } else {
        msg += `พิมพ์ "${QUIZ_TRIGGER}" เพื่อเล่นต่อค่ะ`;
      }
    } else {
      msg += `⏰ เล่นครบ ${MAX_QUESTIONS} คำถามแล้วค่ะ\nมาเล่นใหม่ได้พรุ่งนี้นะคะ 😊`;
    }
  }

  await sendReply(replyToken, msg);
}

// ── เกมตอบคำถาม: เริ่มเกม ───────────────────────────────────────
async function startQuiz(lineUserId: string, replyToken: string): Promise<void> {
  const user = await getUserByLineId(lineUserId);
  if (!user) {
    await sendReplyButton(
      replyToken,
      "สมัครสมาชิกก่อนเล่นเกมได้เลยค่ะ 🎮",
      "สมัครสมาชิก",
      SHOP.liffUrl,
    );
    return;
  }

  await ensureQuizDB();
  const session = await ensureSession(user.id);

  if (session.questions_asked >= MAX_QUESTIONS) {
    await sendReply(replyToken, `⏰ วันนี้เล่นครบ ${MAX_QUESTIONS} คำถามแล้วค่ะ\nมาเล่นใหม่ได้พรุ่งนี้นะคะ 😊`);
    return;
  }

  const q = await generateQuizQuestion();
  if (!q) {
    await sendReply(replyToken, `ขอโทษค่ะ โหลดคำถามไม่ได้ กรุณาลองใหม่อีกครั้งนะคะ`);
    return;
  }

  await startQuestion(user.id, q.question, q.answer);

  let msg = `🎮 เกมตอบคำถามรับแต้ม!\n`;
  msg += `━━━━━━━━━━━━━━━━\n`;
  msg += `📝 คำถามที่ ${session.questions_asked + 1}/${MAX_QUESTIONS}:\n\n`;
  msg += `${q.question}\n\n`;
  msg += `💡 พิมพ์คำตอบได้เลยค่ะ`;
  if (session.points_earned === 0) {
    msg += `\n🌟 ตอบถูกรับ 1 แต้ม (สูงสุด 1 แต้ม/วัน)`;
  }

  await sendReply(replyToken, msg);
}

// ── ข้อความที่มีหน้าตา (Flex/location/quick reply) อยู่ที่ lib/line-ui.ts — ที่นี่แค่ส่ง
// ทุกข้อความแนบแถบปุ่มลัด (quick reply) ที่ข้อความสุดท้าย ลูกค้าไม่ต้องจำคำสั่ง
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function replyMessages(replyToken: string, messages: Record<string, any>[]): Promise<void> {
  const msgs = messages.slice(0, 5).map((m, i, arr) => (i === arr.length - 1 ? { ...m, quickReply: quickReplies() } : m));
  const res = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ replyToken, messages: msgs }),
  });
  if (!res.ok) console.error(`[line] reply failed status=${res.status} body=${await res.text()}`);
}

async function handleMessage(
  lineUserId: string,
  replyToken: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();

  // ตรวจสอบว่ากำลังอยู่ในเกมอยู่ไหม
  const user = await getUserByLineId(lineUserId);
  if (user) {
    await ensureQuizDB();
    const session = await getQuizSession(user.id);
    if (session?.current_question) {
      await handleQuizAnswer(user.id, replyToken, session, trimmed);
      return;
    }
  }

  // สมัครสมาชิก → เปิด LIFF
  if (trimmed === "สมัครสมาชิก") {
    await sendReplyButton(
      replyToken,
      "กดปุ่มด้านล่างเพื่อสมัครสมาชิกหรือดูบัตรสมาชิกค่ะ 🎴",
      "สมัครสมาชิก / ดูบัตรสมาชิก",
      SHOP.liffUrl,
    ).catch((e) => console.error("[line] sendReplyButton error", e));
    return;
  }

  if (trimmed === "สมาชิก" || trimmed === "วิธีสะสมแต้ม" || trimmed === "สะสมแต้ม") {
    await replyMessages(replyToken, [welcomeFlex()]).catch((e) => console.error("[line] welcome flex error", e));
    return;
  }

  if (trimmed === "คะแนน" || trimmed === "แต้ม" || text.includes("ดูแต้ม") || text.includes("ดูคะแนน") || text.includes("เช็คแต้ม")) {
    if (user) {
      // การ์ดบัตรย่อสีตามระดับ + หลอดความคืบหน้า (เดิมเป็นข้อความล้วน)
      const tier = getEffectiveTier(user.total_earned ?? 0, user.points, user.last_purchase_at ?? null);
      const baseTier = TIERS.find(t => (user.total_earned ?? 0) >= t.min) ?? TIERS[TIERS.length - 1];
      const isInactive = tier.name !== baseTier.name;
      const next = getNextTier(tier);
      const name = user.first_name ? `${user.first_name} ${user.last_name ?? ""}`.trim() : (user.display_name ?? "สมาชิก DK");
      await replyMessages(replyToken, [pointsFlex({
        name, tierName: tier.name, tierEmoji: tier.emoji, tierColor: TIER_COLOR[tier.name] ?? "#1B5FC1",
        points: user.points, totalEarned: user.total_earned ?? 0, tierMin: tier.min,
        next: next ? { name: next.name, emoji: next.emoji, min: next.min } : null,
        inactiveRealTier: isInactive ? `${baseTier.emoji} ${baseTier.name}` : undefined,
      })]).catch((e) => console.error("[line] points flex error", e));
    } else {
      await sendReplyButton(
        replyToken,
        "ยังไม่ได้สมัครสมาชิกค่ะ 😊 กดปุ่มด้านล่างเพื่อสมัครได้เลยนะคะ",
        "สมัครสมาชิก",
        SHOP.liffUrl,
      ).catch((e) => console.error("[line] sendReplyButton error", e));
    }
    return;
  }

  // ติดต่อ → การ์ดร้าน + พนักงานขาย 4 ท่าน (รับคำใกล้เคียงด้วย: ติดต่อ/โทร/เบอร์/พนักงาน)
  if (trimmed === "ติดต่อฝ่ายขาย" || /^(ติดต่อ|โทร|เบอร์|เบอร์โทร|พนักงาน|ฝ่ายขาย)/.test(trimmed)) {
    await replyMessages(replyToken, [contactFlex()]).catch((e) => console.error("[line] contact flex error", e));
    return;
  }

  // แผนที่ / ที่อยู่ → ส่งพิกัดจริง (กดแล้วนำทางได้ใน LINE) + ลิงก์ Google Maps
  if (/^(แผนที่|ที่อยู่|ทางไป|พิกัด|ร้านอยู่|อยู่ที่ไหน|อยู่ตรงไหน|ไปยังไง)/.test(trimmed) || text.includes("แผนที่")) {
    await replyMessages(replyToken, [locationMsg(), textMsg(`📍 ${SHOP.name}\n${SHOP.legal}\n🕐 ${SHOP.hours}\n📞 ${SHOP.phone}\n\nนำทาง: ${SHOP.mapsUrl}`)])
      .catch((e) => console.error("[line] location error", e));
    return;
  }

  // เวลาเปิด-ปิด
  if (/(เวลา(เปิด|ทำการ)|เปิดกี่โมง|ปิดกี่โมง|กี่โมง|เปิดวัน|หยุดวัน|วันหยุด)/.test(trimmed)) {
    await sendReply(replyToken, `🕐 เปิด${SHOP.hours} ค่ะ (หยุดวันอาทิตย์)\n📞 ${SHOP.phone}`).catch((e) => console.error("[line] hours error", e));
    return;
  }

  // เกมตอบคำถาม
  if (trimmed === QUIZ_TRIGGER) {
    await startQuiz(lineUserId, replyToken).catch((e) => console.error("[quiz] error", e));
    return;
  }

  // Gemini FAQ — โหลดชีต FAQ เฉพาะตอนต้องใช้จริง (เดิมโหลดก่อนทุกข้อความ เสียเวลาทุกปุ่มที่ไม่เกี่ยว)
  const reply = await askGemini(await getFaqContent(), text);
  await sendReply(replyToken, reply).catch((e) => console.error("[line] sendReply error", e));
}

interface LineTextEvent {
  type: "message";
  replyToken: string;
  source: { userId: string };
  message: { type: "text"; text: string };
}

interface LineFollowEvent {
  type: "follow";
  replyToken: string;
  source: { userId: string };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let parsed: { events: unknown[] };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  await Promise.all(
    parsed.events.map(async (ev) => {
      const event = ev as LineTextEvent | LineFollowEvent;

      if (event.type === "follow") {
        // เพิ่มเพื่อน → การ์ดต้อนรับ (แบนเนอร์ + 3 สิทธิ์ + ปุ่มสมัคร/ติดต่อ/แผนที่) แทนข้อความยาว
        await replyMessages(event.replyToken, [welcomeFlex()]).catch((e) =>
          console.error("[line] follow reply error", e)
        );
        return;
      }

      if (event.type === "message" && (event as LineTextEvent).message?.type === "text") {
        const { source, replyToken, message } = event as LineTextEvent;
        // ไม่ตอบใน group — ยกเว้นพิมพ์ "@groupid" เพื่อขอ Group ID ไปตั้ง LINE_STAFF_GROUP_ID (reply ฟรี ไม่กินโควตา push)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((source as any).type === "group") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (message.text.trim().toLowerCase() === "@groupid") await sendReply(replyToken, `Group ID: ${(source as any).groupId ?? "ไม่พบ"}`);
          return;
        }
        await handleMessage(source.userId, replyToken, message.text);
      }
    })
  );

  return NextResponse.json({ ok: true });
}
