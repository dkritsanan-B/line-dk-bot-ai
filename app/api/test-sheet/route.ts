import { NextResponse } from "next/server";
import { getFaqContent } from "@/lib/sheet";

export async function GET() {
  const url = process.env.SHEET_CSV_URL ?? "(not set)";
  const content = await getFaqContent();
  return NextResponse.json({
    url_set: url !== "(not set)",
    url_prefix: url.slice(0, 60),
    content_length: content.length,
    content_preview: content.slice(0, 300),
  });
}
