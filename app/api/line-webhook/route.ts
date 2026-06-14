export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { getFaqContent } from "@/lib/sheet";
import { askGemini, DEFAULT_REPLY } from "@/lib/gemini";
import { getUserByLineId } from "@/lib/points";

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

const LIFF_URL = "https://liff.line.me/2010392141-TXmVNdGl";

async function sendReplyButton(replyToken: string, text: string, label: string, uri: string): Promise<void> {
  const res = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{
        type: "template",
        altText: text,
        template: {
          type: "buttons",
          text,
          actions: [{ type: "uri", label, uri }],
        },
      }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[line] reply button failed status=${res.status} body=${body}`);
  }
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



async function handleMessage(
  lineUserId: string,
  replyToken: string,
  text: string,
  faq: string
): Promise<void> {
  let reply: string;

  // สมัครสมาชิก → เปิด LIFF
  if (text.trim() === "สมัครสมาชิก") {
    await sendReplyButton(
      replyToken,
      "กดปุ่มด้านล่างเพื่อสมัครสมาชิกหรือดูบัตรสมาชิกค่ะ 🎴",
      "สมัครสมาชิก / ดูบัตรสมาชิก",
      LIFF_URL,
    ).catch((e) => console.error("[line] sendReplyButton error", e));
    return;
  }

  // คำสั่งลูกค้า: ดูวิธีสะสมแต้ม / สมาชิก
  if (text.trim() === "สมาชิก" || text.trim() === "วิธีสะสมแต้ม" || text.trim() === "สะสมแต้ม") {
    await sendReply(replyToken, WELCOME_MESSAGE).catch((e) =>
      console.error("[line] sendReply error", e)
    );
    return;
  }

  // คำสั่งลูกค้า: ดูคะแนน
  if (text.trim() === "คะแนน" || text.trim() === "แต้ม" || text.includes("ดูแต้ม") || text.includes("ดูคะแนน")) {
    const user = await getUserByLineId(lineUserId);
    if (user) {
      reply = `แต้มสะสมของคุณ: ${user.points} แต้มค่ะ 🌟\nทุก 100 บาท = 1 แต้ม`;
      await sendReply(replyToken, reply).catch((e) => console.error("[line] sendReply error", e));
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

      // ลูกค้า add LINE OA ครั้งแรก
      if (event.type === "follow") {
        await sendReply(event.replyToken, WELCOME_MESSAGE).catch((e) =>
          console.error("[line] follow reply error", e)
        );
        return;
      }

      // ข้อความปกติ
      if (
        event.type === "message" &&
        (event as LineTextEvent).message?.type === "text"
      ) {
        const { source, replyToken, message } = event as LineTextEvent;
        await handleMessage(source.userId, replyToken, message.text, faq);
      }
    })
  );

  return NextResponse.json({ ok: true });
}
