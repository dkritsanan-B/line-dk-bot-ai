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
  // ผู้ตรวจ c1: กติกา "ราคาป้าย vs ต่อราคา" ตรวจเองไม่ได้ → บอกว่าคิดทีละรายการ และดูผลได้ที่ไหน
  points: { title: "ได้แต้มพิเศษ (บวกจากแต้มปกติ)", note: "คิดทีละรายการที่จ่ายเต็มราคาป้าย · รายการที่ขอลดราคาได้แต้มปกติ · แต้มพิเศษขึ้นเป็นแถวแยกในประวัติแต้ม" },
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
  const birthday = birthdayPointsOf(tierName);
  return n ? `ลด ${n}%` : birthday ? `คูปองวันเกิด ${birthday.toLocaleString("th-TH")} แต้ม` : "สะสมแต้ม";
}

/** อัตราสะสมปกติ — ต้องตรงกับ POINTS_PER_BAHT ใน lib/points.ts (scripts/check-tiers.mjs ตรวจให้) */
export const BAHT_PER_POINT = 100;

/** ยอดซื้อโดยประมาณที่ต้องใช้ให้ได้ n แต้ม — ใช้บอกช่างเป็น "บาท" แทนแต้มที่นึกภาพไม่ออก */
export function bahtFor(points: number): string {
  return (points * BAHT_PER_POINT).toLocaleString("th-TH");
}

/** คูปองวันเกิด (แต้ม) ต่อระดับ เรียงตาม TIER_ORDER — ต้องตรงกับ BIRTHDAY_POINTS ใน app/api/cron/birthday/route.ts
 *  (scripts/check-tiers.mjs ตรวจให้) · ระบบให้อัตโนมัติ 08:00 ของวันเกิด ไม่ดันระดับ */
export const BIRTHDAY_POINTS = [0, 100, 200, 500, 800, 1000];

export function birthdayPointsOf(tierName: string): number {
  return BIRTHDAY_POINTS[idx(tierName)] ?? 0;
}

/** ระดับแรกที่ได้คูปองวันเกิด */
export function birthdayFrom(): string {
  const first = BIRTHDAY_POINTS.findIndex(n => n > 0);
  return TIER_ORDER[first < 0 ? 0 : first];
}

/** อีกกี่วันถึงวันเกิด (0 = วันนี้) ตามเวลาไทย · null ถ้าไม่มีวันเกิด */
export function daysToBirthday(birthday: string | null | undefined, now = new Date()): number | null {
  if (!birthday) return null;
  const m = birthday.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const th = new Date(now.getTime() + 7 * 3600 * 1000);
  const today = Date.UTC(th.getUTCFullYear(), th.getUTCMonth(), th.getUTCDate());
  let next = Date.UTC(th.getUTCFullYear(), +m[2] - 1, +m[3]);
  if (next < today) next = Date.UTC(th.getUTCFullYear() + 1, +m[2] - 1, +m[3]);
  return Math.round((next - today) / 86400000);
}

/** ระดับแรกที่หมวดนี้เริ่มได้สิทธิ์ (เช่น เหล็ก = Gold) */
export function firstTierOf(key: RuleKey): string {
  const i = RULES[key].byTier.findIndex(n => n > 0);
  return TIER_ORDER[i < 0 ? 0 : i];
}
