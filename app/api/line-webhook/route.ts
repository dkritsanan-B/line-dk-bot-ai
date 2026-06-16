export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { getFaqContent } from "@/lib/sheet";
import { askGemini, generateQuizQuestion, checkQuizAnswer, explainAnswer } from "@/lib/gemini";
import { getUserByLineId } from "@/lib/points";
import {
  migrateQuizDB, getQuizSession, ensureSession,
  startQuestion, clearQuestion, awardQuizPoint, QuizSession,
} from "@/lib/quiz";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? "";
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const LIFF_URL = "https://liff.line.me/2010392141-TXmVNdGl";
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
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
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

const WELCOME_MESSAGE =
  `ยินดีต้อนรับสู่ร้าน DK วัสดุก่อสร้างค่ะ 🏗️\n\n` +
  `📌 ระบบสะสมแต้ม\n` +
  `ทุกการซื้อ 100 บาท = 1 แต้ม\n\n` +
  `🎴 สมัครสมาชิก / ดูบัตรสมาชิก\n` +
  `กดปุ่ม "สมัครสมาชิก" ในเมนูด้านล่างค่ะ\n\n` +
  `🌟 เช็คแต้มสะสม\n` +
  `พิมพ์: แต้ม หรือกดปุ่มในเมนูด้านล่างค่ะ\n\n` +
  `💬 สอบถามสินค้าและราคา\n` +
  `พิมพ์คำถามได้เลยค่ะ น้อง DK ยินดีช่วยเสมอ 😊`;

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
      LIFF_URL,
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

// ── ติดต่อฝ่ายขาย: Flex Message Carousel ────────────────────────
const BASE_URL = "https://line-dk-bot-ai.vercel.app";
const SALES_STAFF = [
  { name: "คุณเก๋",   phone: "094-651-4309", tel: "0946514309", lineId: "0946514309", photo: `${BASE_URL}/staff-gae.png` },
  { name: "คุณแพรว", phone: "065-209-4955", tel: "0652094955", lineId: "0652094955", photo: `${BASE_URL}/staff-praew.png` },
  { name: "คุณลัย",  phone: "095-023-6382", tel: "0950236382", lineId: "0950236382", photo: `${BASE_URL}/staff-lai.png` },
  { name: "คุณมีน",  phone: "094-629-3510", tel: "0946293510", lineId: "somdk5004",  photo: `${BASE_URL}/staff-meen.png` },
];

const HERO_URL = "https://line-dk-bot-ai.vercel.app/herobanner2.png";
const BRAND_COLOR = "#2E3192";

async function sendFlexSalesContact(replyToken: string): Promise<void> {
  const bubbles = SALES_STAFF.map((s) => ({
    type: "bubble",
    size: "kilo",
    hero: {
      type: "image",
      url: HERO_URL,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "0px",
      contents: [
        {
          type: "image",
          url: s.photo,
          size: "full",
          aspectRatio: "1:1",
          aspectMode: "cover",
        },
        {
          type: "box",
          layout: "vertical",
          paddingAll: "12px",
          spacing: "xs",
          contents: [
            { type: "text", text: s.name, size: "lg", weight: "bold", color: "#1A1A1A", align: "center" },
            { type: "text", text: "ฝ่ายขาย", size: "xs", color: "#888888", align: "center" },
            { type: "text", text: s.phone, size: "sm", color: "#555555", align: "center" },
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "12px",
      contents: [
        {
          type: "button",
          style: "primary",
          height: "sm",
          color: BRAND_COLOR,
          action: { type: "uri", label: `📞 โทรหา${s.name}`, uri: `tel:${s.tel}` },
        },
        {
          type: "button",
          style: "primary",
          height: "sm",
          color: "#06C755",
          action: { type: "uri", label: "🟢 เพิ่มเพื่อน LINE", uri: `https://line.me/ti/p/~${s.lineId}` },
        },
        {
          type: "box",
          layout: "vertical",
          margin: "sm",
          contents: [
            { type: "text", text: "🕐 เวลาทำการ 8:00 - 17:00", size: "xs", color: "#888888", align: "center" },
            { type: "text", text: "เปิดทุกวัน จันทร์ - เสาร์", size: "xs", color: "#888888", align: "center" },
          ],
        },
      ],
    },
  }));

  const res = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({
      replyToken,
      messages: [{
        type: "flex",
        altText: "📞 ติดต่อฝ่ายขาย DK วัสดุก่อสร้าง",
        contents: { type: "carousel", contents: bubbles },
      }],
    }),
  });
  if (!res.ok) console.error(`[line] flex sales failed status=${res.status} body=${await res.text()}`);
}

// ── จัดการข้อความหลัก ───────────────────────────────────────────
async function handleMessage(
  lineUserId: string,
  replyToken: string,
  text: string,
  faq: string
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
      LIFF_URL,
    ).catch((e) => console.error("[line] sendReplyButton error", e));
    return;
  }

  if (trimmed === "สมาชิก" || trimmed === "วิธีสะสมแต้ม" || trimmed === "สะสมแต้ม") {
    await sendReply(replyToken, WELCOME_MESSAGE).catch((e) => console.error("[line] sendReply error", e));
    return;
  }

  if (trimmed === "คะแนน" || trimmed === "แต้ม" || text.includes("ดูแต้ม") || text.includes("ดูคะแนน")) {
    if (user) {
      await sendReply(replyToken, `แต้มสะสมของคุณ: ${user.points} แต้มค่ะ 🌟\nทุก 100 บาท = 1 แต้ม`)
        .catch((e) => console.error("[line] sendReply error", e));
    } else {
      await sendReplyButton(
        replyToken,
        "ยังไม่ได้สมัครสมาชิกค่ะ 😊 กดปุ่มด้านล่างเพื่อสมัครได้เลยนะคะ",
        "สมัครสมาชิก",
        LIFF_URL,
      ).catch((e) => console.error("[line] sendReplyButton error", e));
    }
    return;
  }

  // ติดต่อฝ่ายขาย → Flex Message Carousel
  if (trimmed === "ติดต่อฝ่ายขาย") {
    await sendFlexSalesContact(replyToken).catch((e) => console.error("[line] sendFlexSalesContact error", e));
    return;
  }

  // เกมตอบคำถาม
  if (trimmed === QUIZ_TRIGGER) {
    await startQuiz(lineUserId, replyToken).catch((e) => console.error("[quiz] error", e));
    return;
  }

  // Gemini FAQ
  const reply = await askGemini(faq, text);
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

  const faq = await getFaqContent();

  await Promise.all(
    parsed.events.map(async (ev) => {
      const event = ev as LineTextEvent | LineFollowEvent;

      if (event.type === "follow") {
        await sendReply(event.replyToken, WELCOME_MESSAGE).catch((e) =>
          console.error("[line] follow reply error", e)
        );
        return;
      }

      if (event.type === "message" && (event as LineTextEvent).message?.type === "text") {
        const { source, replyToken, message } = event as LineTextEvent;
        await handleMessage(source.userId, replyToken, message.text, faq);
      }
    })
  );

  return NextResponse.json({ ok: true });
}
