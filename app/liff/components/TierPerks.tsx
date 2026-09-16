"use client";
// สิทธิ์ของระดับ "ตอนนี้" (P3) — ช่างถามได้ใน 5 วิ ว่า "ตอนนี้ลดกี่ %"
// ถ้าระดับนี้ยังไม่มีส่วนลด บอกว่าระดับถัดไปที่มีสิทธิ์ได้อะไร · ตัวเลขทั้งหมดมาจาก lib/tierRules.ts
// แถวสิทธิ์จัดเป็น 2 กลุ่ม (ลดทันที / ได้แต้มเพิ่ม) — วิธีรับสิทธิ์อยู่ที่หัวกลุ่ม ไม่ซ้ำทุกแถว
//
// c2 (ผู้ตรวจ c1):
//   - เกณฑ์ระดับบอกเป็น "ยอดซื้อราว ๆ กี่บาท" ด้วย (ช่างนึกเป็นบาท ไม่ใช่แต้ม)
//   - ระดับที่ยังไม่มีส่วนลด (Bronze) ต้องเห็นว่าตอนนี้ได้อะไรแล้ว (คูปองวันเกิด) ไม่ใช่ว่าง ๆ
//   - คูปองวันเกิดเป็นแถวหนึ่งของสิทธิ์ ให้คำสัญญาตอนสมัครมีที่อยู่จริง
import { TIERS, type Tier } from "../lib/tiers";
import { bahtFor, birthdayPointsOf, perksOf, VIA_HEAD, type PerkVia } from "../lib/perks";
import Icon from "./Icon";
import TierMark from "./TierMark";

export default function TierPerks({ tier, restore, hideOnMobile }: { tier: Tier; restore?: boolean; hideOnMobile?: boolean }) {
  const mine = perksOf(tier.name);
  const myBirthday = birthdayPointsOf(tier.name);
  // ระดับแรกที่สูงกว่าเราและมีสิทธิ์ (TIERS เรียงสูง→ต่ำ)
  const upper = [...TIERS].reverse().filter(t => t.min > tier.min);
  const target = mine.length ? null : upper.find(t => perksOf(t.name).length > 0) ?? null;
  const lines = mine.length ? mine : target ? perksOf(target.name) : [];
  if (!lines.length) return null;
  const groups = (["discount", "points"] as PerkVia[])
    .map(via => ({ via, rows: lines.filter(l => l.via === via) }))
    .filter(g => g.rows.length);
  const bdShown = mine.length ? myBirthday : target ? birthdayPointsOf(target.name) : 0;
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
          {myBirthday > 0 && (
            <div className="lf-perknow">
              <b>ตอนนี้คุณได้แล้ว</b>
              <span>สะสมแต้มทุกบิล · คูปองวันเกิด <b className="lf-nw">{myBirthday.toLocaleString()} แต้ม</b></span>
            </div>
          )}
          <h3><Icon name="tag" size={22} /> ถึงระดับ {target!.name} ได้เพิ่ม</h3>
          <p>
            สะสมครบ <b>{target!.min.toLocaleString()}</b> แต้ม <span className="lf-nw">(ซื้อรวมราว {bahtFor(target!.min)} บาท)</span>
            {" "}<span className="lf-nw">เริ่มได้ส่วนลดทันที</span>
          </p>
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
      {bdShown > 0 && (
        <div className="lf-perkgroup">
          <div className="lf-perkhead"><b>ของขวัญวันเกิด</b><span>เติมเข้าบัญชีอัตโนมัติ เช้าวันเกิดทุกปี</span></div>
          <div className="lf-perkrow">
            <span><Icon name="cake" size={18} /> คูปองวันเกิด</span>
            <b>+{bdShown.toLocaleString()} แต้ม</b>
          </div>
        </div>
      )}
    </section>
  );
}
