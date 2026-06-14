export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { getFaqContent } from "@/lib/sheet";
import { askGemini, DEFAULT_REPLY } from "@/lib/gemini";

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

interface LineTextEvent {
  type: "message";
  replyToken: string;
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
    textEvents.map(async (ev) => {
      const { replyToken, message } = ev;

      let reply: string;
      try {
        reply = await askGemini(faq, message.text);
      } catch (err) {
        console.error("[gemini] error:", err);
        reply = DEFAULT_REPLY;
      }

      try {
        await sendReply(replyToken, reply);
      } catch (err) {
        // ไม่ throw — ป้องกัน webhook loop
        console.error(`[line] sendReply error replyToken=${replyToken}`, err);
      }
    })
  );

  return NextResponse.json({ ok: true });
}
