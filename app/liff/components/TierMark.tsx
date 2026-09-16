"use client";
// ตราระดับ — วงกลมไล่สีเดียวกับบัตรของระดับนั้น
// แทนอีโมจิ 🥇🔱 ที่หน้าตาไม่เป็นชุด (เหรียญมีเลข 1 · ตรีศูลสีส้มจาง) ผู้ตรวจรอบ r3 ชี้
// ระดับที่มี mark (Welcome) ใช้วงโปร่งแทน — ไม่ให้ระดับต่ำสุดกับสูงสุดเป็นจุดน้ำเงินเหมือนกัน
import type { Tier } from "../lib/tiers";

export default function TierMark({ tier }: { tier: Pick<Tier, "cardGrad" | "name" | "mark"> }) {
  return <span className={`lf-tmark${tier.mark ? " lf-tmark--open" : ""}`} style={{ background: tier.mark ?? tier.cardGrad }} aria-hidden="true" />;
}
