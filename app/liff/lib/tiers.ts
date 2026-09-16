// ระดับสมาชิกของหน้า LIFF
//
// เกณฑ์แต้ม (min) มาจาก lib/points.ts ที่เดียวเท่านั้น — ห้ามพิมพ์ตัวเลขเกณฑ์ซ้ำในโฟลเดอร์ app/liff
// ไฟล์นี้ให้ได้แค่ "หน้าตา" ของแต่ละระดับ (อีโมจิ / ไล่สีบัตร / ชุดสีตัวอักษรบนบัตร) โดยแมปตามชื่อระดับ
// ตรวจว่าเกณฑ์บนหน้ากับใน lib ตรงกันด้วย `node scripts/check-tiers.mjs`
import { TIERS as RULE_TIERS } from "@/lib/points";

/** ตัวอักษรบนบัตร: light = บัตรพื้นเข้ม ใช้ตัวอักษรขาว · dark = บัตรพื้นสว่าง ใช้ตัวอักษรเข้ม
 *  (ค่าสีจริงอยู่ใน liff.css ที่ .lf-mcard[data-ink="…"] — คำนวณคอนทราสต์ไว้แล้วทุกจุดของไล่สี) */
export type TierInk = "light" | "dark";

export interface TierTheme {
  emoji: string;
  ink: TierInk;
  cardGrad: string;
}

// ไล่สีทุกใบเลือกให้ "จุดสว่างสุด/เข้มสุด" อยู่ในช่วงที่ตัวอักษรชุดเดียวผ่าน AA ได้ทั้งใบ
// (ของเดิมไล่จากเข้มไปสว่างมาก เช่น เงิน #37474F → #B0BEC5 จึงไม่มีสีตัวอักษรใดผ่านทั้งใบ)
export const TIER_THEME: Record<string, TierTheme> = {
  Welcome:  { emoji: "👋", ink: "light", cardGrad: "linear-gradient(135deg, #0E2F5F 0%, #174C96 55%, #2A67C8 100%)" },
  Bronze:   { emoji: "🥉", ink: "light", cardGrad: "linear-gradient(135deg, #3F2409 0%, #6E3F16 55%, #8F5A27 100%)" },
  Silver:   { emoji: "🥈", ink: "dark",  cardGrad: "linear-gradient(135deg, #C6D2DC 0%, #EEF3F7 45%, #AEBDC9 100%)" },
  Gold:     { emoji: "🥇", ink: "dark",  cardGrad: "linear-gradient(135deg, #FFD86B 0%, #FFC02E 45%, #F2A80C 100%)" },
  Platinum: { emoji: "🔱", ink: "light", cardGrad: "linear-gradient(135deg, #1E2A34 0%, #3A4C5C 55%, #4E6376 100%)" },
  Diamond:  { emoji: "💎", ink: "light", cardGrad: "linear-gradient(135deg, #0A2A66 0%, #12459E 55%, #1C5BC8 100%)" },
};

const FALLBACK_THEME: TierTheme = TIER_THEME.Welcome;

export interface Tier extends TierTheme {
  name: string;
  min: number;
}

/** ระดับทั้งหมด เรียงจากสูงไปต่ำ (ลำดับเดียวกับ lib/points.ts) */
export const TIERS: Tier[] = RULE_TIERS.map(t => ({
  name: t.name,
  min: t.min,
  ...(TIER_THEME[t.name] ?? FALLBACK_THEME),
}));

export function getTierFromPoints(points: number): Tier {
  return TIERS.find(t => points >= t.min) ?? TIERS[TIERS.length - 1];
}

export function getEffectiveTier(totalEarned: number, currentPoints: number, lastPurchaseAt: string | null): Tier {
  const isActive = lastPurchaseAt !== null &&
    Date.now() - new Date(lastPurchaseAt).getTime() < 365 * 24 * 60 * 60 * 1000;
  return getTierFromPoints(isActive ? totalEarned : currentPoints);
}

export function getNextTier(tier: Tier): Tier | null {
  const idx = TIERS.findIndex(t => t.name === tier.name);
  return idx > 0 ? TIERS[idx - 1] : null;
}

export function monthsSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (30 * 24 * 60 * 60 * 1000));
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
