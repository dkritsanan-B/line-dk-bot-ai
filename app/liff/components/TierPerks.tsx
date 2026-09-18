"use client";
import { useState } from "react";
// สิทธิ์ของระดับ "ตอนนี้" (P3) — ช่างถามได้ใน 5 วิ ว่า "ตอนนี้ลดกี่ %"
// ถ้าระดับนี้ยังไม่มีส่วนลด บอกว่าระดับถัดไปที่มีสิทธิ์ได้อะไร · ตัวเลขทั้งหมดมาจาก lib/tierRules.ts
// แถวสิทธิ์จัดเป็น 2 กลุ่ม (ลดทันที / ได้แต้มเพิ่ม) — หัวกลุ่มเหลือแค่ชื่อ
//
// c2 (ผู้ตรวจ c1):
//   - เกณฑ์ระดับบอกเป็น "ยอดซื้อราว ๆ กี่บาท" ด้วย (ช่างนึกเป็นบาท ไม่ใช่แต้ม)
//   - ระดับที่ยังไม่มีส่วนลด (Bronze) ต้องเห็นว่าตอนนี้ได้อะไรแล้ว (คูปองวันเกิด) ไม่ใช่ว่าง ๆ
//   - คูปองวันเกิดเป็นแถวหนึ่งของสิทธิ์ ให้คำสัญญาตอนสมัครมีที่อยู่จริง
// c3 (ผู้ตรวจนักออกแบบ):
//   - "ยื่นบัตร/บอกเบอร์ก่อนคิดเงิน" อยู่บนบัตรที่เดียว — การ์ดนี้ไม่พูดซ้ำ
//   - กติกาละเอียดรวมไว้ในหัวข้อพับได้ "แต้มคิดอย่างไร" (PointsHowTo) ที่เดียว
//     แสดงท้ายการ์ดนี้เมื่อปิดประวัติ / ท้ายรายการประวัติเมื่อเปิด — หน้าจอมีได้ครั้งละอันเดียว
// c4 (ผู้ตรวจนักออกแบบ):
//   - "เหล็กเส้น" ไม่ใช่สิทธิ์ → ย้ายออกจากแถวสิทธิ์ เป็นบรรทัดหมายเหตุเบา ๆ ใต้กลุ่มแต้มเพิ่ม
//   - pending (สมัครแล้ว ยังไม่ยืนยันที่ร้าน) → หัวการ์ดไม่สัญญาสิทธิ์ก่อนยืนยัน
//     และไม่ขึ้น "ตอนนี้คุณได้แล้ว" (ยังไม่ได้แต้มจนกว่าจะยืนยัน)
// r7 (ผู้ตรวจ):
//   - pending: ยังไม่ยืนยันก็อ่านเรื่องระดับ 3 ระดับไม่ไหว → เหลือกล่องเขียว + ประโยคเดียว "สะสม N แต้ม ได้ส่วนลด X%"
//     (X อ่านจาก RULES ของระดับแรกที่มีส่วนลด — ตอนนี้ Silver ลด 1% ห้ามเขียนช่วงของระดับสูงกว่า)
//     ตารางสิทธิ์ทั้งหมดซ่อนหลังปุ่ม "ดูสิทธิ์ทั้งหมด"
//   - พักระดับ: หัวข้อก่อน → กล่องเขียว "ตอนนี้ได้" → ตารางที่พักไว้ · กติกาคืนระดับอยู่บนบัตร + ป้ายในตารางเท่านั้น
import { TIERS, type Tier } from "../lib/tiers";
import { BAHT_PER_POINT, bahtFor, birthdayPointsOf, perksOf, reactivateText, VIA_HEAD, type PerkVia } from "../lib/perks";
import { BONUS_BAHT_PER_POINT, RULES, tierIndex, type RuleKey } from "@/lib/tierRules";
import Icon from "./Icon";
import TierMark from "./TierMark";

/** แต้มปกติต่อยอดซื้อ 100 บาท (หน่วย "/100 บาท" ของแถวสิทธิ์) */
const NORMAL_PER_100 = 100 / BAHT_PER_POINT;
const fmtN = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

/** บรรทัดเล็กใต้ค่าแต้มเพิ่ม: หมวดคิดเป็น % → บอกยอดรวมต่อ 100 บาท · หมวดคิดต่อเมตร → บอกว่าได้เพิ่มจากแต้มปกติ */
function totalNote(key: RuleKey, tierName: string): string {
  if (RULES[key].mode === "pct") {
    const extra = (RULES[key].byTier[tierIndex(tierName)] ?? 0) / BONUS_BAHT_PER_POINT;
    return `รวมเป็น ${fmtN(NORMAL_PER_100 + extra)} แต้ม/100 บาท`;
  }
  return "เพิ่มจากแต้มปกติ";
}

/** ส่วนลดหน้าร้านของระดับนี้ (ค่าน้อยสุด–มากสุดของหมวดที่ลดหน้าร้าน) — อ่านจาก RULES ตรง ๆ */
function discountRange(tierName: string): { lo: number; hi: number } | null {
  const i = tierIndex(tierName);
  const ns = (Object.keys(RULES) as RuleKey[])
    .filter(k => RULES[k].via === "discount" && RULES[k].mode === "pct")
    .map(k => RULES[k].byTier[i] ?? 0)
    .filter(n => n > 0);
  return ns.length ? { lo: Math.min(...ns), hi: Math.max(...ns) } : null;
}

/** กติกาการคิดแต้มทั้งหมด — พับไว้ เปิดดูเมื่อสงสัย */
export function PointsHowTo() {
  return (
    <details className="lf-ct-how">
      <summary>แต้มคิดอย่างไร</summary>
      <ul>
        <li><b className="lf-nw">แต้มจากยอดซื้อ</b> <span className="lf-nw">= ยอดบิล ÷ {BAHT_PER_POINT}</span> <span className="lf-nw">ปัดเศษทิ้ง</span></li>
        <li><b className="lf-nw">แต้มเพิ่มตามระดับ</b> <span className="lf-nw">บวกเพิ่มจากแต้มยอดซื้อ</span> <span className="lf-nw">คิดทีละรายการ</span> <span className="lf-nw">ที่จ่ายเต็มราคาป้าย</span></li>
        <li><span className="lf-nw">รายการที่ขอลดราคา</span> <span className="lf-nw">ได้เฉพาะแต้มยอดซื้อตามปกติ</span></li>
        <li><span className="lf-nw">แต้มเพิ่มแสดงเป็นแถวแยก</span> <span className="lf-nw">ในประวัติแต้ม</span></li>
        <li><span className="lf-nw">แต้มสะสมเลื่อนระดับ</span> <span className="lf-nw">นับจากยอดซื้อ</span> <span className="lf-nw">ใช้แต้มแลกของแล้วไม่ลด</span></li>
        <li><span className="lf-nw">คูปองวันเกิดเข้าบัญชีเอง</span> <span className="lf-nw">ตอนเช้าของวันเกิดทุกปี</span></li>
      </ul>
    </details>
  );
}

/** r6: ระดับถัดไปยังไม่มีส่วนลด (Welcome → Bronze) — บอกตรง ๆ ว่าได้อะไร และส่วนลดเริ่มที่ระดับไหน */
function BridgeNote({ next, target }: { next: Tier; target: Tier }) {
  const bd = birthdayPointsOf(next.name);
  return (
    <p className="lf-ct-bridge">
      <span className="lf-ct-bridge-line">
        <span className="lf-nw"><TierMark tier={next} /> <b>{next.name}</b> = สะสมแต้ม</span>
        {bd > 0 && <>{" "}<span className="lf-nw">+ คูปองวันเกิด <b>{bd.toLocaleString()}</b> แต้ม</span></>}
        {" "}<span className="lf-nw">(ยังไม่มีส่วนลด)</span>
      </span>
      <span className="lf-ct-bridge-line">
        <span className="lf-nw">ส่วนลดเริ่มที่ <TierMark tier={target} /> <b>{target.name}</b></span>
        {" "}<span className="lf-nw">(สะสม {target.min.toLocaleString()} แต้ม)</span>
      </span>
    </p>
  );
}

export default function TierPerks({ tier, currentTier, nextTier, restore, hideOnMobile, showHow, pending }: {
  tier: Tier; currentTier?: Tier; restore?: boolean; hideOnMobile?: boolean; showHow?: boolean;
  /** ระดับถัดไปตัวเดียวกับที่บัตรใช้ (page.tsx getNextTier) — ทุกที่ต้องพูดถึงระดับเดียวกัน (r6) */
  nextTier?: Tier | null;
  /** true = สมัครแล้วแต่ยังไม่ยืนยันตัวตนที่ร้าน */
  pending?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const mine = perksOf(tier.name);
  const myBirthday = birthdayPointsOf(tier.name);
  // ระดับแรกที่สูงกว่าเราและมีสิทธิ์ (TIERS เรียงสูง→ต่ำ)
  const upper = [...TIERS].reverse().filter(t => t.min > tier.min);
  const target = mine.length ? null : upper.find(t => perksOf(t.name).length > 0) ?? null;
  const lines = mine.length ? mine : target ? perksOf(target.name) : [];
  if (!lines.length) return null;
  // r6 (ผู้ตรวจ): บัตรบอก "อีก 100 แต้ม เป็น Bronze" แต่การ์ดนี้บอก "ถึง Silver ได้เพิ่ม" → ใช้ระดับถัดไปตัวเดียวกัน
  //     ถ้าระดับถัดไปยังไม่มีส่วนลด ให้บอกตรง ๆ แล้วค่อยโชว์สิทธิ์ของระดับแรกที่มีส่วนลด
  const next = mine.length ? null : (nextTier ?? upper[0] ?? null);
  const bridge = next && target && next.name !== target.name ? next : null;
  const paused = !!restore && mine.length > 0 && !pending;
  const groups = (["discount", "points"] as PerkVia[])
    .map(via => ({ via, rows: lines.filter(l => l.via === via) }))
    .filter(g => g.rows.length);
  const shownTier = mine.length ? tier.name : target!.name;
  const bdShown = mine.length ? myBirthday : target ? birthdayPointsOf(target.name) : 0;
  // นับเป็นจำนวนแถวสิทธิ์ที่ซ่อนอยู่ (กลุ่มที่ 2 เป็นต้นไป + คูปองวันเกิด)
  // pending + ยังไม่มีสิทธิ์ของตัวเอง: ซ่อนตารางทั้งหมดจนกว่าจะกด (r7)
  const pendTeaser = !!pending && !mine.length && !!target;
  const hiddenFrom = pendTeaser ? 0 : 1;
  const hiddenCount = groups.slice(hiddenFrom).reduce((n, g) => n + g.rows.length, 0) + (bdShown > 0 ? 1 : 0);
  const visibleGroups = expanded ? groups : groups.slice(0, hiddenFrom);
  const teaserDisc = pendTeaser ? discountRange(target!.name) : null;
  const activeBirthday = currentTier ? birthdayPointsOf(currentTier.name) : 0;
  return (
    <section className={`lf-card lf-perkcard${hideOnMobile ? " lf-hide-sm" : ""}${paused ? " lf-perkcard--paused" : ""}`}>
      {pending ? (
        <>
          {/* r5: หัวการ์ดไม่พูด "หลังยืนยัน" ซ้ำกับกล่องเขียวข้างล่าง */}
          <h3><Icon name="tag" size={22} /> สิทธิ์ของคุณ</h3>
          <div className="lf-perknow">
            <b>หลังยืนยัน ได้ทันที</b>
            <span>สะสมแต้มทุกบิล · แลกของรางวัล</span>
          </div>
          {mine.length ? (
            <p>ระดับ <TierMark tier={tier} /> <b>{tier.name}</b></p>
          ) : teaserDisc ? (
            <p className="lf-ct-teaser">
              <span className="lf-nw">สะสม <b>{target!.min.toLocaleString()}</b> แต้ม</span>
              {" "}<span className="lf-nw">ได้ส่วนลดหน้าร้าน <b>{teaserDisc.lo === teaserDisc.hi ? `${fmtN(teaserDisc.hi)}%` : `${fmtN(teaserDisc.lo)}–${fmtN(teaserDisc.hi)}%`}</b></span>
              {" "}<span className="lf-nw">(ระดับ <TierMark tier={target!} /> {target!.name})</span>
            </p>
          ) : (
            <p>
              <span className="lf-nw">สะสมครบ <b>{target!.min.toLocaleString()}</b> แต้ม</span>
              {" "}<span className="lf-nw">ได้สิทธิ์ระดับ <TierMark tier={target!} /> {target!.name}</span>
            </p>
          )}
        </>
      ) : restore && mine.length ? (
        <>
          {/* r7: หัวข้อก่อน → ตอนนี้ได้อะไร → ตารางที่พักไว้ (ป้าย "พักไว้" ในหัวตารางบอกทางกลับ ไม่พูดซ้ำใต้หัวข้อ) */}
          <h3><Icon name="tag" size={22} /> สิทธิ์ระดับ <TierMark tier={tier} /> {tier.name}</h3>
          <div className="lf-perknow lf-perknow--current">
            <b>ตอนนี้ได้</b>
            <span>สะสมแต้มทุกบิล{activeBirthday > 0 ? <> · คูปองวันเกิด <strong>{activeBirthday.toLocaleString()} แต้ม</strong></> : ""}</span>
          </div>
        </>
      ) : mine.length ? (
        <>
          <h3><Icon name="tag" size={22} /> สิทธิ์ของคุณตอนนี้</h3>
          <p>ระดับ <TierMark tier={tier} /> <b>{tier.name}</b></p>
        </>
      ) : (
        <>
          {myBirthday > 0 && (
            <div className="lf-perknow">
              <b>ตอนนี้คุณได้แล้ว</b>
              <span>สะสมแต้มทุกบิล · คูปองวันเกิด <b className="lf-nw">{myBirthday.toLocaleString()} แต้ม</b></span>
            </div>
          )}
          {bridge ? (
            <>
              <h3><Icon name="tag" size={22} /> ระดับถัดไป <TierMark tier={bridge} /> {bridge.name}</h3>
              <p>สะสมครบ <b>{bridge.min.toLocaleString()}</b> แต้ม <span className="lf-nw">(ซื้อรวมราว {bahtFor(bridge.min)} บาท)</span></p>
              <BridgeNote next={bridge} target={target!} />
            </>
          ) : (
            <>
              <h3><Icon name="tag" size={22} /> ถึงระดับ {target!.name} ได้เพิ่ม</h3>
              <p>
                สะสมครบ <b>{target!.min.toLocaleString()}</b> แต้ม <span className="lf-nw">(ซื้อรวมราว {bahtFor(target!.min)} บาท)</span>
                {" "}<span className="lf-nw">เริ่มได้ส่วนลดทันที</span>
              </p>
            </>
          )}
        </>
      )}
      {(pendTeaser ? expanded : !!bridge) && <div className="lf-ct-target">สิทธิ์เมื่อถึง <TierMark tier={target!} /> {target!.name}</div>}
      {visibleGroups.map(g => (
        <div key={g.via} className={`lf-perkgroup`}>
          <div className="lf-perkhead lf-ct-head">
            <b>{VIA_HEAD[g.via].title}{paused && <em className="lf-ct-paused-tag">พักไว้ · กลับมาเมื่อ{reactivateText()[0]}</em>}</b>
            {/* แต้มกลุ่มนี้เป็นแต้ม "เพิ่ม" แยกจากแต้มยอดซื้อ (lib/tierRules.ts computeBonus → รายการแยกในประวัติ) */}
            {g.via === "points" && <span className="lf-ct-headnote"><span className="lf-nw">บวกเพิ่มจากแต้มปกติ</span> <span className="lf-nw">(ทุก {BAHT_PER_POINT} บาท = 1 แต้ม)</span></span>}
          </div>
          {g.rows.map(l => (
            <div key={l.key} className="lf-perkrow-wrap">
              <div className="lf-perkrow">
                <span>{l.label}</span>
                <div className="lf-ct-valbox">
                  <b className="lf-ct-val">{l.value}{l.per && <small>{l.per}</small>}</b>
                  {l.via === "points" && <em className="lf-ct-sub">{totalNote(l.key, shownTier)}</em>}
                </div>
              </div>
              {l.key === "steel" && (
                <p className="lf-ct-note">เหล็กเส้น: ได้แต้มปกติ ({NORMAL_PER_100} แต้ม/100 บาท) ไม่มีแต้มเพิ่ม</p>
              )}
            </div>
          ))}
        </div>
      ))}
      {bdShown > 0 && expanded && (
        <div className={`lf-perkgroup`}>
          <div className="lf-perkhead lf-ct-head"><b>ของขวัญวันเกิด</b></div>
          <div className="lf-perkrow">
            <span><Icon name="cake" size={18} /> คูปองวันเกิด</span>
            <b className="lf-ct-val">+{bdShown.toLocaleString()} แต้ม</b>
          </div>
        </div>
      )}
      {hiddenCount > 0 && (
        <button type="button" className="lf-perk-more" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
          {expanded ? "ซ่อนสิทธิ์เพิ่มเติม" : `ดูสิทธิ์ทั้งหมด (+${hiddenCount})`}
          <Icon name="chevron" size={18} />
        </button>
      )}
      {showHow && <PointsHowTo />}
    </section>
  );
}
