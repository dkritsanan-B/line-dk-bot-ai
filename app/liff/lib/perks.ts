// สิทธิ์ตามระดับ แปลงเป็นข้อความสั้นสำหรับหน้าจอ — ตัวเลขทั้งหมดอ่านจาก lib/tierRules.ts (ห้ามพิมพ์ % เองในหน้า)
import { RULES, TIER_ORDER, BONUS_BAHT_PER_POINT, type RuleKey } from "@/lib/tierRules";

export type PerkVia = "discount" | "points";
export interface PerkLine { key: RuleKey; label: string; value: string; per: string; via: PerkVia }

const SHOWN: RuleKey[] = ["retail", "paint", "steel", "sheet"];

const LABEL: Record<RuleKey, string> = {
  retail: "ฮาร์ดแวร์ เครื่องมือ ประปา ไฟฟ้า",
  paint: "สี",
  steel: "เหล็กทุกชนิด ยกเว้นเหล็กเส้น",
  sheet: "เมทัลชีท",
  none: "",
};

/** หัวกลุ่มของสิทธิ์แต่ละทาง — ใช้แทนการพิมพ์ "ลดให้ตอนจ่ายเงิน" ซ้ำทุกแถว */
export const VIA_HEAD: Record<PerkVia, { title: string; note: string }> = {
  discount: { title: "ลดทันทีตอนจ่ายเงิน", note: "" },
  points: { title: "ได้แต้มเพิ่ม (บวกจากแต้มปกติ)", note: "ซื้อราคาป้ายได้แต้มนี้ · ถ้าต่อราคา ได้แต้มปกติอย่างเดียว" },
};

function idx(tierName: string) {
  const i = TIER_ORDER.indexOf(tierName as typeof TIER_ORDER[number]);
  return i < 0 ? 0 : i;
}

const fmt = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

/** สิทธิ์ที่ระดับนี้ได้ (ไม่รวมรายการที่เป็น 0)
 *  แบบคืนแต้ม: มูลค่าส่วนลด (บาท) ÷ BONUS_BAHT_PER_POINT = แต้ม → เขียนเป็น "+N แต้ม ต่อ 100 บาท / ต่อเมตร"
 *  เพื่อไม่ให้ช่างงงว่า "คืนแต้ม 1%" คือเงินหรือแต้ม */
export function perksOf(tierName: string): PerkLine[] {
  const i = idx(tierName);
  return SHOWN.flatMap(key => {
    const r = RULES[key];
    const n = r.byTier[i] ?? 0;
    if (!n) return [];
    // หน่วยสั้น ๆ ต่อท้ายตัวเลขบรรทัดเดียวกัน (ผู้ตรวจ r5: ค่าตัด 2 บรรทัดแล้วลอยไม่ตรงชื่อหมวด)
    const per = r.mode === "pct" ? (r.via === "discount" ? "" : "/100 บาท") : "/เมตร";
    const value = r.via === "discount"
      ? (r.mode === "pct" ? `ลด ${fmt(n)}%` : `ลด ${fmt(n)} บาท`)
      : `+${fmt(n / BONUS_BAHT_PER_POINT)} แต้ม`;
    return [{ key, label: LABEL[key], value, per, via: r.via }];
  });
}

/** ส่วนลดหน้าร้านสูงสุด (หมวดปลีก) และระดับแรกที่เริ่มได้ส่วนลด */
export function retailSummary(): { max: number; from: string } {
  const by = RULES.retail.byTier;
  const max = Math.max(...by);
  const first = by.findIndex(n => n > 0);
  return { max, from: TIER_ORDER[first < 0 ? 0 : first] };
}

/** ข้อความสั้นใต้ชื่อระดับบนบันได เช่น "ลด 2%" / "สะสมแต้ม" */
export function ladderNote(tierName: string): string {
  const n = RULES.retail.byTier[idx(tierName)] ?? 0;
  return n ? `ลด ${n}%` : "สะสมแต้ม";
}
