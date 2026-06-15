import { NextResponse } from "next/server";
import { getFaqContent } from "@/lib/sheet";
import { askGemini } from "@/lib/gemini";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const question = searchParams.get("q") ?? "สินค้าอะไรบ้าง";

  const faq = await getFaqContent();
  const answer = await askGemini(faq, question);

  return NextResponse.json({
    question,
    faq_length: faq.length,
    faq_preview: faq.slice(0, 300),
    gemini_answer: answer,
  });
}
