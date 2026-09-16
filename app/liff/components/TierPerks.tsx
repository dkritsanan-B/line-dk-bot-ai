"use client";
// สิทธิ์ของระดับ "ตอนนี้" (P3) — ช่างถามได้ใน 5 วิ ว่า "ตอนนี้ลดกี่ %"
// ถ้าระดับนี้ยังไม่มีส่วนลด บอกว่าระดับถัดไปที่มีสิทธิ์ได้อะไร · ตัวเลขทั้งหมดมาจาก lib/tierRules.ts
// แถวสิทธิ์จัดเป็น 2 กลุ่ม (ลดทันที / ได้แต้มเพิ่ม) — วิธีรับสิทธิ์อยู่ที่หัวกลุ่ม ไม่ซ้ำทุกแถว
import { TIERS, type Tier } from "../lib/tiers";
import { perksOf, VIA_HEAD, type PerkVia } from "../lib/perks";
import Icon from "./Icon";
import TierMark from "./TierMark";

export default function TierPerks({ tier, restore, hideOnMobile }: { tier: Tier; restore?: boolean; hideOnMobile?: boolean }) {
  const mine = perksOf(tier.name);
  // ระดับแรกที่สูงกว่าเราและมีสิทธิ์ (TIERS เรียงสูง→ต่ำ)
  const upper = [...TIERS].reverse().filter(t => t.min > tier.min);
  const target = mine.length ? null : upper.find(t => perksOf(t.name).length > 0) ?? null;
  const lines = mine.length ? mine : target ? perksOf(target.name) : [];
  if (!lines.length) return null;
  const groups = (["discount", "points"] as PerkVia[])
    .map(via => ({ via, rows: lines.filter(l => l.via === via) }))
    .filter(g => g.rows.length);
  return (
    <section className={`lf-card lf-perkcard${hideOnMobile ? " lf-hide-sm" : ""}`}>
      {restore && mine.length ? (
        <>
          <h3><Icon name="tag" size={22} /> ซื้อครั้งถัดไป ได้สิทธิ์นี้คืน</h3>
          <p>ระดับจริงของคุณ <TierMark tier={tier} /> <b>{tier.name}</b></p>
        </>
      ) : mine.length ? (
        <>
          <h3><Icon name="tag" size={22} /> สิทธิ์ของคุณตอนนี้</h3>
          <p>ระดับ <TierMark tier={tier} /> <b>{tier.name}</b> · <span className="lf-nw">บอกเบอร์โทรตอนจ่ายเงิน</span></p>
        </>
      ) : (
        <>
          <h3><Icon name="tag" size={22} /> ถึงระดับ {target!.name} ได้สิทธิ์นี้</h3>
          <p>สะสมครบ <b>{target!.min.toLocaleString()}</b> แต้ม <span className="lf-nw">เริ่มได้ส่วนลดทันที</span></p>
        </>
      )}
      {groups.map(g => (
        <div key={g.via} className="lf-perkgroup">
          <div className="lf-perkhead">
            <b>{VIA_HEAD[g.via].title}</b>
            {VIA_HEAD[g.via].note && <span>{VIA_HEAD[g.via].note}</span>}
          </div>
          {g.rows.map(l => (
            <div key={l.key} className="lf-perkrow">
              <span>{l.label}</span>
              <b>{l.value}{l.per && <small>{l.per}</small>}</b>
            </div>
          ))}
          {g.rows.some(l => l.key === "steel") && (
            <div className="lf-perkfoot">เหล็กเส้น ได้แต้มปกติอย่างเดียว</div>
          )}
        </div>
      ))}
    </section>
  );
}
