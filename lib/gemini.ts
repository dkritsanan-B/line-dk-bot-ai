import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const DEFAULT_REPLY =
  "ขอโทษนะคะ เรื่องนี้น้อง DK ยังไม่มีข้อมูล รบกวนโทรหาพนักงานขายได้เลยนะคะ 😊\n" +
  "คุณเก๋ 094-651-4309\n" +
  "คุณแพรว 065-209-4955\n" +
  "คุณลัย 095-023-6382\n" +
  "คุณมีน 094-629-3510";

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let fields: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(field); field = ""; }
      else if (ch === '\r' && next === '\n') { fields.push(field); rows.push(fields); fields = []; field = ""; i++; }
      else if (ch === '\n') { fields.push(field); rows.push(fields); fields = []; field = ""; }
      else { field += ch; }
    }
  }
  if (field || fields.length > 0) { fields.push(field); if (fields.some(f => f)) rows.push(fields); }

  return rows;
}

function csvToQA(csv: string): string {
  return parseCSV(csv)
    .slice(1)
    .map(fields => {
      const question = fields[1]?.trim() ?? "";
      const answer = fields.slice(2).join(",").trim();
      return question && answer ? `ถาม: ${question}\nตอบ: ${answer}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function buildPrompt(faq: string, userMessage: string): string {
  const qa = csvToQA(faq);
  return `คุณคือน้อง DK พนักงานขายของร้าน DK จำหน่ายวัสดุก่อสร้าง มีนิสัยเป็นกันเอง สุภาพ น่ารัก

ข้อมูลที่รู้:
${qa || "(ไม่มีข้อมูล)"}

กฎการตอบ:
- ถ้าคำถามเกี่ยวข้องกับข้อมูลด้านบน ให้ใช้ข้อมูลจาก "ตอบ:" ทุกรายการ ห้ามตัดทอนหรือสรุปย่อ
- ถ้าคำตอบมีหลายรายการหรือมีรายการย่อย ให้แสดงครบทุกรายการ
- ห้ามแต่งข้อมูลขึ้นมาเองที่ไม่มีใน "ข้อมูลที่รู้"
- ถ้าไม่มีข้อมูลที่เกี่ยวข้องเลย ให้ตอบว่า: "ขอโทษนะคะ เรื่องนี้น้อง DK ยังไม่มีข้อมูล รบกวนโทรหาพนักงานขายได้เลยนะคะ 😊\nคุณเก๋ 094-651-4309\nคุณแพรว 065-209-4955\nคุณลัย 095-023-6382\nคุณมีน 094-629-3510"
- ตอบภาษาไทย เป็นกันเอง ใช้ "ค่ะ" ลงท้าย ใส่ emoji น่ารัก

คำถามลูกค้า: ${userMessage}`;
}

const MODEL = "gemini-2.5-flash";

export async function generateQuizQuestion(): Promise<{ question: string; answer: string } | null> {
  const prompt = `สร้างคำถามความรู้ทั่วไปภาษาไทย 1 ข้อ ระดับปานกลาง สนุกน่าสนใจ
คำตอบต้องสั้น ไม่เกิน 5 คำ
ตอบ JSON รูปแบบนี้เท่านั้น ห้ามมีข้อความอื่น:
{"question":"คำถามที่นี่","answer":"คำตอบที่นี่"}`;

  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 1.0, maxOutputTokens: 512 },
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (parsed.question && parsed.answer) return parsed as { question: string; answer: string };
    return null;
  } catch {
    return null;
  }
}

export async function checkQuizAnswer(question: string, correctAnswer: string, userAnswer: string): Promise<boolean> {
  const prompt = `คำถาม: "${question}"
คำตอบที่ถูกต้อง: "${correctAnswer}"
คำตอบของผู้เล่น: "${userAnswer}"
ผู้เล่นตอบถูกหรือไม่? (ยอมรับคำตอบใกล้เคียง สะกดผิดเล็กน้อย หรือเป็นคำย่อที่รู้จักกัน)
ตอบ JSON เท่านั้น: {"correct":true} หรือ {"correct":false}`;

  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0, maxOutputTokens: 64 },
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return false;
    return JSON.parse(match[0]).correct === true;
  } catch {
    return false;
  }
}

export async function explainAnswer(question: string, answer: string): Promise<string> {
  const prompt = `คำถาม: "${question}"
คำตอบที่ถูกต้อง: "${answer}"

อธิบายสั้นๆ ว่าทำไมคำตอบนี้ถึงถูกต้อง ภาษาไทย เป็นกันเอง 1-2 ประโยค ใส่ emoji น่ารัก`;

  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.7, maxOutputTokens: 256 },
    });
    return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function askGemini(faq: string, userMessage: string): Promise<string> {
  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: buildPrompt(faq, userMessage) }] }],
      config: {
        temperature: 1.0,
        maxOutputTokens: 1024,
      },
    });

    const candidate = result.candidates?.[0];
    const finishReason = candidate?.finishReason;
    console.log(`[gemini] model=${MODEL} finishReason=${finishReason}`);

    if (finishReason === "MAX_TOKENS") return DEFAULT_REPLY;
    return candidate?.content?.parts?.[0]?.text?.trim() ?? DEFAULT_REPLY;
  } catch (err) {
    console.error("[gemini] error:", err);
    return DEFAULT_REPLY;
  }
}
