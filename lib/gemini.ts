import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const DEFAULT_REPLY =
  "ขอโทษนะคะ เรื่องนี้น้อง DK ยังไม่มีข้อมูล รบกวนโทรหาพนักงานขายได้เลยนะคะ 😊\n" +
  "คุณเก๋ 094-651-4309\n" +
  "คุณหญิง 088-760-8470\n" +
  "คุณแพรว 065-209-4955\n" +
  "คุณลัย 095-023-6382\n" +
  "คุณมีน 094-629-3510";

function buildPrompt(faq: string, userMessage: string): string {
  return `<role>
คุณคือน้อง DK พนักงานขายของร้าน DK จำหน่ายวัสดุก่อสร้าง
มีนิสัยเป็นกันเอง สุภาพ น่ารัก และเก่งด้านการขาย
</role>

<constraints>
- ตอบโดยใช้ข้อมูลใน <faq> เท่านั้น
- ห้ามแต่งราคา ระยะเวลา หรือที่ตั้งขึ้นมาเอง
- ถ้าไม่มีข้อมูลในคำถามนั้น ให้ตอบว่า:
  "ขอโทษนะคะ เรื่องนี้น้อง DK ยังไม่มีข้อมูล รบกวนโทรหาพนักงานขายได้เลยนะคะ 😊
   คุณเก๋ 094-651-4309
   คุณหญิง 088-760-8470
   คุณแพรว 065-209-4955
   คุณลัย 095-023-6382
   คุณมีน 094-629-3510"
- โทน: เป็นกันเอง สุภาพ ใช้ "ค่ะ" ลงท้าย ใส่ emoji น่ารักเหมาะสม
- ชวนคุยต่อหรือชวนซื้อเสมอเมื่อมีโอกาส เช่น ถามปริมาณที่ต้องการ หรือแนะนำสินค้าเสริม
- ความยาว 1–3 ประโยค ไม่ยาวเกินไป
</constraints>

<output_format>
ภาษาไทยเท่านั้น ห้ามใช้ markdown เช่น ** หรือ ##
</output_format>

<faq>
${faq}
</faq>

<question>
${userMessage}
</question>`;
}

export async function generateQuizQuestion(): Promise<{ question: string; answer: string } | null> {
  const prompt = `สร้างคำถามความรู้ทั่วไปภาษาไทย 1 ข้อ เนื้อหาสนุกน่าสนใจ ระดับปานกลาง เหมาะกับคนไทยทั่วไป
คำตอบต้องสั้น ไม่เกิน 5 คำ
ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น: {"question":"...","answer":"..."}`;

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { temperature: 1.2, maxOutputTokens: 256 },
  });

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as { question: string; answer: string };
  } catch {
    return null;
  }
}

export async function checkQuizAnswer(question: string, correctAnswer: string, userAnswer: string): Promise<boolean> {
  const prompt = `คำถาม: "${question}"
คำตอบที่ถูกต้อง: "${correctAnswer}"
คำตอบของผู้เล่น: "${userAnswer}"
ผู้เล่นตอบถูกหรือไม่? (ยอมรับคำตอบที่มีความหมายใกล้เคียง สะกดผิดเล็กน้อย หรือเป็นคำย่อที่รู้จักกัน)
ตอบ JSON เท่านั้น ไม่ต้องอธิบาย: {"correct":true} หรือ {"correct":false}`;

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { temperature: 0, maxOutputTokens: 32 },
  });

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return false;
  try {
    return JSON.parse(match[0]).correct === true;
  } catch {
    return false;
  }
}

export async function askGemini(faq: string, userMessage: string): Promise<string> {
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: buildPrompt(faq, userMessage) }] }],
    config: {
      temperature: 1.0,
      maxOutputTokens: 1024,
    },
  });

  const candidate = result.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const thoughtsTokenCount = result.usageMetadata?.thoughtsTokenCount ?? 0;
  const candidatesTokenCount = result.usageMetadata?.candidatesTokenCount ?? 0;

  console.log(
    `[gemini] finishReason=${finishReason} thoughts=${thoughtsTokenCount} candidates=${candidatesTokenCount}`
  );

  if (finishReason === "MAX_TOKENS") {
    return DEFAULT_REPLY;
  }

  return candidate?.content?.parts?.[0]?.text?.trim() ?? DEFAULT_REPLY;
}
