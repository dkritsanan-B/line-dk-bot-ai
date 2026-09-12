// กติกาสิทธิพิเศษตามระดับสมาชิก — ฉบับจริงที่เจ้าของร้านยืนยัน 13 ก.ย. 69
// ใช้ 2 ที่: (1) โบนัสแต้มตามหมวดจากบิล Hero (/api/hero/points)  (2) บอทซิงก์ราคาระดับใน Hero (ชิ้น A, ภายหลัง)
// แก้ % ที่นี่ที่เดียว — ห้ามฝังตัวเลขในที่อื่น

import { TIERS, type Tier } from "./points";

// ลำดับระดับจากต่ำไปสูง (index = ตำแหน่งในตาราง % ด้านล่าง)
export const TIER_ORDER = ["Welcome", "Bronze", "Silver", "Gold", "Platinum", "Diamond"] as const;
export type TierName = typeof TIER_ORDER[number];

// กลุ่มกติกา — แต่ละกลุ่มมี % (หรือบาท/หน่วย) ต่อระดับ เรียงตาม TIER_ORDER
export type RuleKey = "retail" | "paint" | "steel" | "sheet" | "none";
export const RULES: Record<RuleKey, { label: string; mode: "pct" | "baht_per_unit"; byTier: number[] }> = {
  // ฮาร์ดแวร์ เครื่องมือ/มอเตอร์/ปั๊ม พีวีซี/ประปา ไฟฟ้า เกษตร วัสดุก่อสร้าง สุขภัณฑ์
  retail: { label: "หมวดปลีก", mode: "pct", byTier: [0, 0, 1, 2, 3, 4] },
  paint:  { label: "สี",       mode: "pct", byTier: [0, 0, 1, 2, 3, 3] },
  // เหล็กทุกชนิดในหมวด Hero 005 ยกเว้นเหล็กเส้น (ตัดสินใจ: 58 ตัวที่จำแนกชื่อไม่ได้ก็ถือเป็นเหล็กอื่น)
  steel:  { label: "เหล็ก (ไม่รวมเหล็กเส้น)", mode: "pct", byTier: [0, 0, 0, 1, 1.5, 2] },
  // เมทัลชีท ลดเป็นบาทต่อเมตร
  sheet:  { label: "เมทัลชีท (บาท/เมตร)", mode: "baht_per_unit", byTier: [0, 0, 0, 2, 3, 4] },
  none:   { label: "ไม่ลด", mode: "pct", byTier: [0, 0, 0, 0, 0, 0] },
};

// หมวด Hero (CSCATEGORY.ID) → กลุ่มกติกา
export const HERO_CATEGORY_RULE: Record<number, RuleKey> = {
  1: "retail",   // ฮาร์ดแวร์
  2: "retail",   // พาวเวอร์ทูลส์+มอเตอร์+เครื่องยนต์+ปั๊ม
  3: "paint",    // สี
  4: "retail",   // ไฟฟ้า
  5: "steel",    // เหล็ก
  6: "retail",   // พีวีซี+ประปา
  9: "retail",   // วัสดุก่อสร้าง
  10: "retail",  // สุขภัณฑ์
  11: "retail",  // เกษตร
  18: "sheet",   // เมทัลชีท
};

// เหล็กเส้น (ข้ออ้อย/กลม) — ไม่ลดทุกระดับ · จับจากชื่อสินค้าใน Hero
const REBAR_RE = /ข้ออ้อย|SD ?40|SD ?50|เหล็กเส้นกลม|\bRB\d|SR ?24/i;
// ไวร์เมช/ตะแกรงเทพื้น ชื่อมีคำว่า "ข้ออ้อย" (เส้นลวดข้ออ้อย) แต่เป็นเหล็กอื่น ไม่ใช่เหล็กเส้น (เจอตอน preview 13 ก.ย.)
const NOT_REBAR_RE = /ตะแกรง|ไวร์เมช|wire ?mesh/i;
// เมทัลชีทลดเป็นบาทต่อเมตร → ใช้ได้เฉพาะหน่วยเมตร หน่วยอื่น (ชิ้น/แผ่น) ไม่ลด
const METER_UNIT_RE = /เมตร/;
// หน่วยที่ถือเป็น "ราคาแบ่งตัด" ของเหล็ก — ไม่ลด (เมทัลชีทขายเป็นเมตรอยู่แล้ว ไม่เข้าเงื่อนไขนี้)
const CUT_UNIT_RE = /เมตร|ตัด|ท่อน|ซม|ฟุต|กิโล/;

export interface HeroLine {
  code: string; name: string; category: number | null; unit: string;
  qty: number; unit_price: number; list_price: number | null; discword: string; net: number;
}

export function ruleForLine(line: HeroLine): { rule: RuleKey; reason: string } {
  const base = line.category != null ? HERO_CATEGORY_RULE[line.category] : undefined;
  if (!base) return { rule: "none", reason: "ไม่มีหมวด" };
  if (base === "steel") {
    if (REBAR_RE.test(line.name) && !NOT_REBAR_RE.test(line.name)) return { rule: "none", reason: "เหล็กเส้น" };
    if (CUT_UNIT_RE.test(line.unit)) return { rule: "none", reason: "ราคาแบ่งตัด" };
  }
  if (base === "sheet" && !METER_UNIT_RE.test(line.unit)) return { rule: "none", reason: "เมทัลชีทหน่วยไม่ใช่เมตร" };
  return { rule: base, reason: RULES[base].label };
}

export function tierIndex(tier: Tier | string): number {
  const name = typeof tier === "string" ? tier : tier.name;
  const i = TIER_ORDER.indexOf(name as TierName);
  return i < 0 ? 0 : i;
}

export interface BonusLine { code: string; name: string; rule: RuleKey; reason: string; rate: number; baht: number; skipped?: string }

// คำนวณโบนัส (บาท) ของบิลตามระดับ — ไม่ให้บรรทัดที่ต่อราคาแล้ว (ราคาขายต่ำกว่าราคาป้าย)
export function computeBonus(lines: HeroLine[], tier: Tier | string): { baht: number; lines: BonusLine[] } {
  const ti = tierIndex(tier);
  let total = 0;
  const out: BonusLine[] = [];
  for (const l of lines) {
    const { rule, reason } = ruleForLine(l);
    const r = RULES[rule];
    const rate = r.byTier[ti] ?? 0;
    const item: BonusLine = { code: l.code, name: l.name, rule, reason, rate, baht: 0 };
    if (rate <= 0) { item.skipped = rule === "none" ? reason : "ระดับนี้ยังไม่ได้"; out.push(item); continue; }
    if (l.net <= 0 || l.qty <= 0) { item.skipped = "ยอดศูนย์/คืนของ"; out.push(item); continue; }
    if (l.list_price != null && l.list_price > 0 && l.unit_price < l.list_price - 0.005) { item.skipped = `ต่อราคาแล้ว (${l.unit_price} < ป้าย ${l.list_price})`; out.push(item); continue; }
    // % คิดจากราคาเต็ม (qty × ราคาป้าย) — ตามกติกา "สินค้ามีส่วนลดปกติ ให้บวก % ตรง ๆ" (ท่อพีวีซี 8% → +2% ของราคาเต็ม)
    const gross = l.qty * l.unit_price > 0 ? l.qty * l.unit_price : l.net;
    const baht = r.mode === "pct" ? gross * rate / 100 : l.qty * rate;
    item.baht = Math.round(baht * 100) / 100;
    total += item.baht;
    out.push(item);
  }
  return { baht: Math.round(total * 100) / 100, lines: out };
}

// โบนัสบาท → แต้ม: 1 แต้ม = 1 บาท (แต้มปกติ 100 บาท = 1 แต้ม คือ ~1% คืน; โบนัสคือมูลค่าส่วนลดจริง)
export const BONUS_BAHT_PER_POINT = 1;
export const bonusPoints = (baht: number) => Math.floor(baht / BONUS_BAHT_PER_POINT);

export { TIERS };
