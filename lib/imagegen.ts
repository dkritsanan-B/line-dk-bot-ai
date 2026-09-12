import { GoogleGenAI } from "@google/genai";

// ============================================================
// Multi-provider image generation — "DK Creative Lab"
// รองรับหลาย AI ให้เลือกเทียบกันได้ (Gemini / OpenAI / เพิ่มได้ทีหลัง)
// คืนรูปเป็น base64 data URL (ไว้โชว์เทียบในหน้า Lab — ยังไม่เซฟลง B2)
// ============================================================

export type Provider = "gemini" | "openai";
export type GenMode = "poster" | "clean";

export interface GenRequest {
  provider: Provider;
  mode: GenMode;          // poster = AI ปั้นข้อความเอง · clean = ภาพล้วน (เอาไปทับเทมเพลต)
  prompt: string;         // brief จากผู้ใช้
  baseImage?: string;     // data URL รูปฐาน (ไม่บังคับ) — ให้ AI แต่งต่อ
  n?: number;             // จำนวน variation (1–4)
  aspect?: "square" | "portrait" | "landscape";
}

export interface GenImage {
  dataUrl: string;        // data:image/png;base64,....
  provider: Provider;
}

// รายชื่อผู้ให้บริการที่ "พร้อมใช้" (มีคีย์แล้ว) — ให้หน้าเว็บรู้ว่าปุ่มไหนกดได้
export function availableProviders(): Provider[] {
  const list: Provider[] = [];
  if (process.env.GEMINI_API_KEY) list.push("gemini");
  if (process.env.OPENAI_API_KEY) list.push("openai");
  return list;
}

// ---- คำอธิบายสไตล์ที่เติมเข้าไปใน prompt ตามโหมด ----
const BRAND = `Brand: "DK Steel and Tools" — a Thai steel, metal-sheet (metal roofing) and hardware/power-tools store in southern Thailand. Brand colors: deep navy blue and golden yellow. Look professional, trustworthy, industrial.`;

function wrapPrompt(req: GenRequest): string {
  const aspect =
    req.aspect === "portrait" ? "vertical 4:5 portrait composition" :
    req.aspect === "landscape" ? "horizontal 16:9 composition" :
    "square 1:1 composition";

  if (req.mode === "poster") {
    return `Create a Thai social-media advertisement poster, ${aspect}. ${BRAND}
Include bold Thai headline text, a checklist of feature bullets, the shop logo area, and a bottom contact bar. Vibrant, high-contrast, marketing style similar to Facebook promotional graphics.
Campaign brief: ${req.prompt}`;
  }
  // clean = ภาพประกอบล้วน ไม่มีตัวอักษร (เอาไปวางเทมเพลตเอง)
  return `Professional product/scene photograph, ${aspect}. ${BRAND}
IMPORTANT: absolutely NO text, NO letters, NO logos, NO watermark in the image — clean image only, leave visual breathing room for text to be added later.
Subject: ${req.prompt}`;
}

// ---- helper: แยก mimeType + base64 ออกจาก data URL ----
function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], base64: m[2] };
}

// ============================================================
// GEMINI (gemini-2.5-flash-image) — text→image และ image+text→image
// ============================================================
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

async function genGeminiOne(req: GenRequest): Promise<GenImage | null> {
  const prompt = wrapPrompt(req);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [{ text: prompt }];

  // ถ้ามีรูปฐาน → ส่งเข้าไปให้ Gemini แต่งต่อ
  if (req.baseImage) {
    const parsed = parseDataUrl(req.baseImage);
    if (parsed) parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.base64 } });
  }

  let result;
  try {
    result = await gemini.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts }],
      config: { responseModalities: ["IMAGE"] },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[imagegen/gemini] call failed (hasBaseImage=${!!req.baseImage}): ${msg}`);
    throw e;
  }

  // log token จริงที่ Gemini ใช้ (ไว้ประเมินค่าใช้จ่าย)
  const u = result.usageMetadata;
  if (u) {
    const inTok = u.promptTokenCount ?? 0;
    const outTok = u.candidatesTokenCount ?? 0;
    const costUsd = (outTok / 1e6) * 30 + (inTok / 1e6) * 0.3; // ~$30/1M out (image), ~$0.30/1M in
    console.log(`[imagegen/gemini] tokens in=${inTok} out=${outTok} total=${u.totalTokenCount ?? 0} ≈ $${costUsd.toFixed(4)} (~${(costUsd * 34).toFixed(2)} บาท)`);
  }

  const outParts = result.candidates?.[0]?.content?.parts ?? [];
  for (const p of outParts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inline = (p as any).inlineData;
    if (inline?.data) {
      const mime = inline.mimeType ?? "image/png";
      return { dataUrl: `data:${mime};base64,${inline.data}`, provider: "gemini" };
    }
  }
  console.log(`[imagegen/gemini] no image part, finishReason=${result.candidates?.[0]?.finishReason}`);
  return null;
}

// ============================================================
// EXPAND BRIEF — "ทีมงาน" ขยาย brief สั้น ๆ เป็น prompt ละเอียด
// ให้ผู้ใช้ก๊อปไปรันใน ChatGPT เอง (ไม่ต้องใช้ OpenAI API)
// ใช้ Gemini text (gemini-2.5-flash) เป็นตัวขยาย
// ============================================================
export async function expandBrief(opts: {
  brief: string; aspect?: GenRequest["aspect"]; mode: GenMode; hasPhoto?: boolean;
}): Promise<string> {
  const aspect =
    opts.aspect === "portrait" ? "vertical 4:5 portrait" :
    opts.aspect === "landscape" ? "horizontal 16:9 landscape" : "square 1:1";

  const modeLine = opts.mode === "poster"
    ? `Output is a FULL Thai promotional poster: include a bold Thai headline, 3-4 Thai feature bullets with check marks, a logo area, and a bottom contact bar (phone "075-845177", Facebook "DK Steel and Tools"). Specify the EXACT Thai text to render on the image.`
    : `Output is a CLEAN background image: absolutely NO text, no letters, no logo, no watermark — leave visual breathing space so text can be added later with a template.`;

  const photoLine = opts.hasPhoto
    ? `The user will ATTACH their own real photo in ChatGPT. Begin the prompt by telling ChatGPT to use the attached photo as the reference and to KEEP the real truck and the real steel product EXACTLY unchanged — only improve lighting, sky and surroundings. Never replace or redesign the truck or the products.`
    : "";

  const instruction = `You are the production art-director of "DK Steel and Tools", a steel, metal-roofing (metal sheet) and hardware / power-tools store in southern Thailand. Brand look: deep navy blue + golden yellow, professional, industrial, trustworthy.
Expand the shop owner's short brief into ONE vivid, detailed image-generation prompt to paste into ChatGPT.
Aspect ratio: ${aspect}.
${modeLine}
${photoLine}
Owner's brief: "${opts.brief}"
Return ONLY the final prompt text, ready to paste. English is fine; put any on-image Thai wording in "quotes". No preamble, no explanation, no surrounding quotes.`;

  const result = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: instruction }] }],
    config: { temperature: 0.9, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } },
  });
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nonThought = (parts as any[]).filter(p => !p.thought);
  return (nonThought.at(-1)?.text ?? parts.at(-1)?.text ?? "").trim();
}

// ============================================================
// OPENAI (gpt-image-1) — (สำรองไว้) เรียก API ตรง ถ้าจะสร้างรูปในเว็บ
// ตอนนี้ผู้ใช้เลือกวิธี "ขยาย brief แล้วรันเอง" แทน จึงไม่ได้ต่อเข้า UI
// ============================================================
function openaiSize(aspect?: GenRequest["aspect"]): string {
  if (aspect === "portrait") return "1024x1536";
  if (aspect === "landscape") return "1536x1024";
  return "1024x1024";
}

async function genOpenAI(req: GenRequest, n: number): Promise<GenImage[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("ยังไม่ได้ตั้ง OPENAI_API_KEY ใน .env.local — เพิ่มคีย์ก่อนถึงจะใช้ OpenAI ได้");

  const prompt = wrapPrompt(req);
  const size = openaiSize(req.aspect);

  // มีรูปฐาน → ใช้ endpoint images/edits (multipart) · ไม่มี → images/generations (json)
  let res: Response;
  if (req.baseImage) {
    const parsed = parseDataUrl(req.baseImage);
    if (!parsed) throw new Error("รูปฐานไม่ถูกต้อง");
    const bin = Buffer.from(parsed.base64, "base64");
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", prompt);
    form.append("n", String(n));
    form.append("size", size);
    form.append("image", new Blob([bin], { type: parsed.mimeType }), "base.png");
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt, n, size }),
    });
  }

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI ตอบกลับ ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.data ?? []).map((d: any) => ({
    dataUrl: `data:image/png;base64,${d.b64_json}`,
    provider: "openai" as const,
  }));
}

// ============================================================
// ตัวเรียกหลัก — สั่ง n รูปพร้อมกัน คืน array
// ============================================================
export async function generateImages(req: GenRequest): Promise<GenImage[]> {
  const n = Math.min(Math.max(req.n ?? 1, 1), 4);

  if (req.provider === "gemini") {
    // Gemini คืน 1 รูป/ครั้ง → ยิงขนานกัน n ครั้ง
    // ใช้ allSettled: ถ้าบางใบพลาด (transient error/rate limit) ยังได้ใบที่สำเร็จคืนมา
    const settled = await Promise.allSettled(Array.from({ length: n }, () => genGeminiOne(req)));
    const ok = settled
      .filter((s): s is PromiseFulfilledResult<GenImage | null> => s.status === "fulfilled")
      .map(s => s.value)
      .filter((v): v is GenImage => v !== null);

    if (ok.length === 0) {
      // ทุกใบพลาด → โยน error พร้อมสาเหตุจริงของใบแรกที่ error
      const firstErr = settled.find(s => s.status === "rejected") as PromiseRejectedResult | undefined;
      if (firstErr) {
        const r = firstErr.reason;
        throw new Error(r instanceof Error ? r.message : String(r));
      }
    }
    return ok;
  }

  if (req.provider === "openai") {
    return genOpenAI(req, n);
  }

  throw new Error(`ไม่รู้จักผู้ให้บริการ: ${req.provider}`);
}
