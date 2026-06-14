export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { getFaqContent } from "@/lib/sheet";
import { askGemini, DEFAULT_REPLY } from "@/lib/gemini";
import { addPoints, getUserByLineId, registerUser } from "@/lib/points";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? "";
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";

function verifySignature(rawBody: string, signature: string): boolean {
  const hmac = crypto.createHmac("sha256", CHANNEL_SECRET);
  hmac.update(rawBody);
  return hmac.digest("base64") === signature;
}

async function sendReply(replyToken: string, text: string): Promise<void> {
  const res = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[line] reply failed replyToken=${replyToken} status=${res.status} body=${body}`);
  }
}

// +แต้ม 1500 0812345678
function parseAddPointsCommand(text: string): { amount: number; phone: string } | null {
  const match = text.trim().match(/^\+แต้ม\s+(\d+)\s+(0\d{9})$/);
  if (!match) return null;
  return { amount: parseInt(match[1]), phone: match[2] };
}

// สมัครสมาชิก 0812345678
function parseRegisterCommand(text: string): string | null {
  const match = text.trim().match(/^สมัครสมาชิก\s+(0\d{9})$/);
  return match ? match[1] : null;
}

async function handleMessage(
  lineUserId: string,
  replyToken: string,
  text: string,
  faq: string
): Promise<void> {
  let reply: string;

  // คำสั่งพนักงาน: +แต้ม 1500 0812345678
  const addCmd = parseAddPointsCommand(text);
  if (addCmd) {
    const result = await addPoints(addCmd.phone, addCmd.amount);
    if (!result) {
      reply = `ไม่พบลูกค้าเบอร์ ${addCmd.phone} ในระบบค่ะ`;
    } else {
      reply =
        `เพิ่ม ${result.pointsEarned} แต้มให้เบอร์ ${addCmd.phone} สำเร็จค่ะ 🎉\n` +
        `(ซื้อ ${addCmd.amount.toLocaleString()} บาท)\n` +
        `แต้มสะสมรวม: ${result.totalPoints} แต้ม`;
    }
    await sendReply(replyToken, reply).catch((e) =>
      console.error("[line] sendReply error", e)
    );
    return;
  }

  // คำสั่งลูกค้า: สมัครสมาชิก 0812345678
  const phone = parseRegisterCommand(text);
  if (phone) {
    const { isNew } = await registerUser(lineUserId, phone);
    reply = isNew
      ? `สมัครสมาชิกสำเร็จแล้วค่ะ 🎊 เบอร์ ${phone}\nสะสมแต้มได้เลยนะคะ ทุก 100 บาท = 1 แต้ม`
      : `ผูกบัญชีเบอร์ ${phone} กับ LINE นี้เรียบร้อยแล้วค่ะ 😊`;
    await sendReply(replyToken, reply).catch((e) =>
      console.error("[line] sendReply error", e)
    );
    return;
  }

  // คำสั่งลูกค้า: ดูคะแนน
  if (text.trim() === "คะแนน" || text.trim() === "แต้ม" || text.includes("ดูแต้ม") || text.includes("ดูคะแนน")) {
    const user = await getUserByLineId(lineUserId);
    reply = user
      ? `แต้มสะสมของคุณ: ${user.points} แต้มค่ะ 🌟\nทุก 100 บาท = 1 แต้ม`
      : `ยังไม่ได้สมัครสมาชิกค่ะ 😊\nพิมพ์ "สมัครสมาชิก [เบอร์มือถือ]" เพื่อเริ่มสะสมแต้มได้เลยนะคะ`;
    await sendReply(replyToken, reply).catch((e) =>
      console.error("[line] sendReply error", e)
    );
    return;
  }

  // ส่งต่อให้ Gemini ตอบ FAQ
  try {
    reply = await askGemini(faq, text);
  } catch (err) {
    console.error("[gemini] error:", err);
    reply = DEFAULT_REPLY;
  }
  await sendReply(replyToken, reply).catch((e) =>
    console.error("[line] sendReply error", e)
  );
}

interface LineTextEvent {
  type: "message";
  replyToken: string;
  source: { userId: string };
  message: { type: "text"; text: string };
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

  const textEvents = parsed.events.filter(
    (ev): ev is LineTextEvent =>
      (ev as LineTextEvent).type === "message" &&
      (ev as LineTextEvent).message?.type === "text"
  );

  const faq = await getFaqContent();

  await Promise.all(
    textEvents.map((ev) =>
      handleMessage(ev.source.userId, ev.replyToken, ev.message.text, faq)
    )
  );

  return NextResponse.json({ ok: true });
}
