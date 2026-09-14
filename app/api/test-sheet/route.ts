import { NextRequest, NextResponse } from "next/server";
import { getFaqContent } from "@/lib/sheet";
import { askGemini } from "@/lib/gemini";
import { getAdminRole, hasRole } from "@/lib/admin-auth";

// เครื่องมือทดสอบ FAQ+Gemini — เดิมเปิดสาธารณะ ใครยิงก็เผาโควตา Gemini ได้ → ล็อก super admin (14 ก.ย. 69)
export async function GET(req: NextRequest) {
  const role = await getAdminRole(req);
  if (!hasRole(role, "super")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const question = req.nextUrl.searchParams.get("q") ?? "สินค้าอะไรบ้าง";

  const faq = await getFaqContent();
  const answer = await askGemini(faq, question);

  return NextResponse.json({
    question,
    faq_length: faq.length,
    faq_preview: faq.slice(0, 300),
    gemini_answer: answer,
  });
}
