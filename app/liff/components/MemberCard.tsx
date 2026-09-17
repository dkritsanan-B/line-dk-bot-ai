"use client";
// บัตรสมาชิก + ความคืบหน้าระดับ (P3)
//
// ลำดับที่ตาต้องอ่านได้ใน 5 วินาที (ช่างยืนหน้าเคาน์เตอร์ มีคนต่อคิว):
//   1. ใครคือเรา   → รูป + ชื่อ + บริษัท/เบอร์ เป็นบล็อกเดียวกัน (.lf-mcard-who)
//   2. มีกี่แต้ม    → ตัวเลขใหญ่ในกล่องทึบ (.lf-mcard-well) ที่คุมคอนทราสต์ไว้คงที่ทุกจุดของไล่สี
//   3. อีกเท่าไหร่เลื่อนขั้น → บรรทัดเล็กบรรทัดเดียว + แถบ + ปลายแถบ + ประโยคสรุป (ข้อความรองทั้งหมด)
//
// ตัวเลขแต้มใหญ่มีตัวเดียวบนบัตร (ผู้ตรวจ P: สองตัวเลขชวนงง + ดันกล่องแต้มหมดอายุลงใต้จอแรก)
//   "แต้มที่ใช้แลกได้" = points      → ตัวใหญ่
//   "ยอดสะสม X / Y แต้ม" = totalEarned → บรรทัด 14px น้ำหนักปกติ (คำอธิบายว่าคิดอย่างไรอยู่ในหัวข้อ "แต้มคิดอย่างไร")
//
// สามสภาพของบัตร (ผู้ตรวจรอบ 7.5/10)
//   ปกติ      → สีระดับเต็ม · แต้มตัวใหญ่ + ยอดสะสม (ข้อความรอง) + บรรทัดจิ๋วบอกว่ายอดสะสมต่างจากแต้มยังไง
//   พักระดับ   → สีของ "ระดับจริง" แต่ซีด (lf-cd-card--rest) + ป้ายระดับจริงติดป้าย "พักระดับ" + ประโยคเดียวบอกทางกลับ
//               บัตรเป็นที่เดียวที่อธิบายเรื่องนี้ (AlertNotes ไม่พูดซ้ำแล้ว)
//   รอยืนยัน   → พื้นขาวขอบเทา (lf-cd-card--pend) ไม่ใช้ไล่สีน้ำเงินที่ชนกับ Diamond · คำสั่ง "บอกพนักงาน" เป็นจุดเด่นจุดเดียว
//
// data-ink ต้องมีเสมอ — เป็นตัวเลือกชุดสีตัวอักษรของบัตร (light/dark) ใน liff.css
// ถ้าลืมใส่ ตัวอักษรบนบัตรจะไม่มีสีเลย (ตกทอดเป็นสีเข้มบนพื้นเข้ม) → scripts/check-tiers.mjs จะ fail
import { useState, type CSSProperties } from "react";
import { formatDate, type Tier } from "../lib/tiers";
import { SHOP_PHONE, SHOP_TEL } from "../lib/api";
import type { ClientLink, Member, Profile } from "../lib/types";
import { PENDING_POINTS_DAYS, reactivateText } from "../lib/perks";
import Icon from "./Icon";
import TierMark from "./TierMark";
import "../styles/card.css";

export default function MemberCard({
  tier: effTier, nextTier, totalEarned, points, progress, name, formattedPhone, member, profile, pendingLink, realTier,
  birthdayBonus = 0,
}: {
  tier: Tier;
  nextTier: Tier | null;
  totalEarned: number;
  points: number;
  progress: number;
  name: string;
  formattedPhone: string;
  member: Member | null;
  profile: Profile | null;
  /** มีค่า = ยังไม่ผูกรหัสลูกค้า แต้มยังไม่เข้า → กล่องแต้มเปลี่ยนเป็นกล่อง "รอพนักงานยืนยันตัวตน" */
  pendingLink?: ClientLink | null;
  /** แต้มวันเกิดที่ตรวจแล้วว่าตรงกับส่วนต่างของแต้มใช้ได้และยอดสะสม */
  birthdayBonus?: number;
  /** มีค่า = ระดับลดชั่วคราว (ไม่ได้ซื้อเกิน 1 ปี) · ค่าคือระดับจริงตามยอดสะสม
   *  ผู้ตรวจ c1: บัตรสี Bronze แต่ยอดสะสม 2,600 = ดูเหมือนระบบคิดผิด → ต้องบอกบนบัตรเลยว่าทำไม */
  realTier?: Tier | null;
}) {
  const [showProgressHelp, setShowProgressHelp] = useState(false);
  // หน้าตาบัตร (สี/ชุดตัวอักษร/ป้าย) ใช้ระดับจริงเสมอ — ตอนพักระดับ ป้าย Bronze บนบัตรที่ยอดสะสมถึง Gold ดูเหมือนระบบคิดผิด
  // ส่วนความคืบหน้า (nextTier/progress จาก page.tsx) คิดจากระดับที่ใช้อยู่ แต่ตอนพักระดับไม่แสดงแถบอยู่แล้ว
  const tier = realTier ?? effTier;
  const resting = !pendingLink && !!realTier;
  const toNext = nextTier ? Math.max(0, nextTier.min - totalEarned) : 0;
  const birthday = member?.birthday
    ? new Date(member.birthday).toLocaleDateString("th-TH", { day: "numeric", month: "short" })
    : null;
  return (
    <section
      className={`lf-mcard lf-cd-card${pendingLink ? " lf-cd-card--pend lf-cd-card--pend-row" : resting ? " lf-cd-card--rest" : ""}`}
      data-ink={tier.ink}
      data-tier={tier.name}
      // รอยืนยัน: พื้นมาจาก card.css (ขาว) · พักระดับ (r5): สีระดับเต็มเหมือนเดิม + ขอบเส้นประ (card.css) ให้ยังจำได้ว่าเป็นบัตรระดับไหน
      style={pendingLink ? undefined : ({ background: tier.cardGrad } as CSSProperties)}
    >
      {/* รอยืนยัน: ป้ายอยู่แถวเดียวกับชื่อ (r5 ผู้ตรวจ: ป้ายลอยแถวเดียวทิ้งที่ว่างเหนือชื่อ) */}
      {!pendingLink && (
        <div className="lf-mcard-top">
          <div className="lf-cd-tier-group">
            <div className="lf-tier"><TierMark tier={tier} /> {tier.name}</div>
            {resting && <small className="lf-cd-rest-tag">พักระดับ</small>}
          </div>
        </div>
      )}

      {/* 1. ใครคือเรา */}
      <div className="lf-mcard-who">
        {profile?.pictureUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={profile.pictureUrl} alt="" />
          : <div className="ph" aria-hidden="true">{memberInitial(name)}</div>}
        <div className="lf-mcard-id">
          <div className="lf-mcard-name">{name}</div>
          {member?.company && <div className="lf-mcard-meta"><i><Icon name="building" size={18} /></i>{member.company}</div>}
          {/* รอยืนยัน: เบอร์ย้ายไปตัวใหญ่ในกล่องด้านล่าง (ให้พนักงานอ่านจากจอ) ไม่แสดงซ้ำ */}
          {!pendingLink && <div className="lf-mcard-meta"><i><Icon name="phone" size={18} /></i><b>{formattedPhone}</b></div>}
        </div>
        {pendingLink && (
          // ยังไม่ผูก: ป้าย "Welcome" ชวนเข้าใจว่าเริ่มเก็บแต้มแล้ว → ป้ายอำพัน "รอยืนยัน" แทน
          <div className="lf-tier lf-cd-tier-wait"><Icon name="hourglass" size={18} /> รอยืนยัน</div>
        )}
      </div>

      {/* 2. ยังไม่ผูก → เรื่องแรกที่ต้องรู้คือ "แต้มยังไม่เข้า" ไม่ใช่เลข 0 เฉย ๆ (บั๊กเงียบ 16 ก.ย. 69) */}
      {pendingLink ? <PendingWell link={pendingLink} phone={formattedPhone} createdAt={member?.created_at} /> : (
      <div className="lf-mcard-well">
        <div className="lf-points-lbl">แต้มที่ใช้แลกได้</div>
        <div className="lf-points-num">{points.toLocaleString()}<span className="lf-points-unit">แต้ม</span></div>
        {birthdayBonus > 0 && (
          <div className="lf-cd-birthday-points">
            <Icon name="cake" size={18} /> รวมแต้มวันเกิด {birthdayBonus.toLocaleString()} แต้ม <span className="lf-nw">(ไม่นับเข้าระดับ)</span>
          </div>
        )}

        {resting && realTier ? (
          // พักระดับ: ไม่มีตัวเลขชุดที่ 2 ไม่มีแถบ — บอกทางกลับประโยคเดียว
          // จริงตามกติกา: บิลที่ได้แต้ม (lib/points.ts addPoints) ตั้ง last_purchase_at = ตอนนี้ → getEffectiveTier คิดจากยอดสะสมทันที
          // บิลต่ำกว่า 1 แต้มไม่นับเป็นการซื้อ → ประโยคกติกาใช้ REACTIVATE_TEXT ชุดเดียวกับกล่องใกล้ลดระดับ (lib/perks.ts)
          <div className="lf-prog lf-cd-rest">
            <div className="lf-cd-rest-msg">
              <ReactivateRule /> <span className="lf-nw">กลับเป็น <TierMark tier={realTier} /> {realTier.name} ทันที</span>
            </div>
            <div className="lf-cd-rest-sub">ไม่มีบิลเกิน 1 ปี ระดับจึงพักไว้ <span className="lf-nw">· ยอดสะสมไม่หาย</span></div>
            {member?.last_purchase_at && <div className="lf-cd-rest-sub">ซื้อล่าสุด {formatDate(member.last_purchase_at)}</div>}
          </div>
        ) : nextTier ? (
          <div className="lf-prog lf-cd-prog">
            {toNext > 0 ? (<>
            {/* ตัวเลขชุดที่ 2 เป็นข้อมูลรอง (ไม่หนา) — ห้ามแข่งกับแต้มที่ใช้แลกได้
                ยอดสะสมนับรวมตั้งแต่สมัคร ไม่รีเซ็ตรายปี (lib/points.ts getEffectiveTier) → ห้ามเขียน "ปีนี้" */}
            <div className="lf-cd-prog-head">
              ยอดสะสม <b>{totalEarned.toLocaleString()} / {nextTier.min.toLocaleString()}</b> แต้ม
            </div>
            {/* แถบ = ยอดสะสม ÷ เกณฑ์ระดับถัดไป (เริ่มที่ 0) ให้ตรงกับตัวเลขด้านบน */}
            <div
              className="lf-prog-bar lf-cd-bar"
              role="progressbar"
              aria-valuenow={totalEarned}
              aria-valuemin={0}
              aria-valuemax={nextTier.min}
              aria-valuetext={`${totalEarned.toLocaleString()} จาก ${nextTier.min.toLocaleString()} แต้ม`}
              aria-label={`ยอดสะสมไประดับ ${nextTier.name}`}
            >
              <i style={{ width: `${progress}%` }} />
            </div>
            {/* ไม่มีขีดตั้งบนแถบ เพราะดูคล้ายปุ่มเลื่อน · ป้ายสองปลาย: แถบเริ่มที่ 0 จบที่เกณฑ์ระดับถัดไป (ตรงกับ X / Y) */}
            <div className="lf-cd-prog-ends">
              <span className="lf-cd-mark">0</span>
              <span className="lf-cd-mark lf-cd-mark--next"><TierMark tier={nextTier} /> {nextTier.name} <b>{nextTier.min.toLocaleString()}</b></span>
            </div>
            <div className="lf-cd-prog-msg">
              <span>อีก <b>{toNext.toLocaleString()}</b> แต้ม <span className="lf-nw">เป็น {nextTier.name}</span></span>
              <button
                type="button"
                className="lf-cd-info"
                aria-label="ยอดสะสมคืออะไร"
                aria-expanded={showProgressHelp}
                onClick={() => setShowProgressHelp(v => !v)}
              ><i aria-hidden="true">i</i></button>
            </div>
            {showProgressHelp && <div className="lf-cd-prog-help">ยอดสะสมใช้คิดระดับ และไม่ลดเมื่อแลกของ</div>}
            </>) : (
              <>
                <div className="lf-cd-prog-head">ยอดสะสม <b>{totalEarned.toLocaleString()} แต้ม</b></div>
                <div className="lf-cd-prog-msg">
                  ยอดสะสมถึงระดับเดิมแล้ว <ReactivateRule /> <span className="lf-nw">ระดับกลับมาทันที</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="lf-prog lf-prog--max">
            <Icon name="trophy" size={20} /> <span>ระดับสูงสุดแล้ว <span className="lf-nw">ขอบคุณที่ไว้วางใจ DK ค่ะ</span></span>
          </div>
        )}
      </div>
      )}

      {/* ประโยคนี้มีที่บัตรที่เดียวทั้งหน้า */}
      {!pendingLink && (
        <div className="lf-mcard-use lf-cd-use"><Icon name="phone" size={18} /> ยื่นบัตรนี้ หรือบอกเบอร์ก่อนคิดเงิน</div>
      )}

      {/* บรรทัดเล็กบรรทัดเดียว หน้าตาเดียวกันทั้งมือถือและเดสก์ท็อป (ซื้อล่าสุดไม่อยู่บนบัตรแล้ว — กล่อง "รักษาระดับ" บอกวันที่ต้องมาซื้อเองเมื่อจำเป็น) */}
      <div className="lf-cd-foot">
        {member?.created_at && <span className="lf-nw">สมาชิกตั้งแต่ {formatDate(member.created_at)}</span>}
        {birthday && <span className="lf-nw">วันเกิด {birthday}</span>}
      </div>
    </section>
  );
}

// กล่องแทนตัวเลขแต้ม ตอนที่ยังไม่ได้ผูกรหัสลูกค้า
// ข้อความตายตัว (API ส่งข้อความเดียวกันทุกคนที่ยังไม่ผูก — lib/points.ts toClientLink)
// ตั้งใจไม่แสดงจำนวนบิลค้าง/รหัสที่ระบบเดา (คนสวมเบอร์คนอื่นสมัครได้) · เบอร์ที่แสดงคือเบอร์ที่เจ้าของบัญชีกรอกเอง
// P: เดิมซ้อนกล่อง 3 ชั้น คำสั่งสำคัญจมอยู่ข้างใน → เหลือกล่องเดียว หัวเรื่องคือสิ่งที่ต้องพูดกับพนักงาน
function PendingWell({ link, phone, createdAt }: { link: ClientLink; phone: string; createdAt?: string | null }) {
  const days = link.waiting_days ?? 0;
  const remainingDays = Math.max(0, PENDING_POINTS_DAYS - days);
  const startDate = createdAt ? formatDate(createdAt) : null;
  return (
    <div className={`lf-mcard-well lf-cd-pend${link.overdue ? " lf-cd-pend--overdue" : ""}`}>
      <div className="lf-cd-pend-kicker">แต้มยังไม่เข้า · อีกขั้นเดียว</div>
      <div className="lf-cd-pend-say">บอกพนักงานว่า <span className="lf-nw">&quot;ยืนยันสมาชิก LINE&quot;</span></div>
      {phone && (
        <div className="lf-cd-pend-phone">
          <span>เบอร์ที่สมัคร</span>
          <b>{phone}</b>
        </div>
      )}
      <p className="lf-cd-pend-why">
        {/* วันที่ 5 ขึ้นไป (ยังเหลือสิทธิ์ย้อนหลัง): ชวนแวะร้าน ไม่ดุ · นับจากกติกาย้อนหลังในเซิร์ฟเวอร์ (app/api/admin/update-member) */}
        {days >= 5 && remainingDays > 0 && startDate
          ? <><span className="lf-nw">ยังไม่ได้แวะร้าน?</span> <span className="lf-nw">บิลตั้งแต่ {startDate}</span> <span className="lf-nw">ยังได้แต้มย้อนหลัง</span> <span className="lf-nw">อีก {remainingDays.toLocaleString()} วัน</span></>
          : <><span className="lf-nw">บิลตั้งแต่วันสมัคร</span> <span className="lf-nw">(ไม่เกิน {PENDING_POINTS_DAYS} วัน)</span> <span className="lf-nw">ได้แต้มย้อนหลัง</span></>}
      </p>
      {link.overdue && (
        // r5: ปุ่มโทรกว้างเต็มกล่อง ชิดขอบซ้ายเดียวกับข้อความ (เดิมเยื้องเข้าไปหลังไอคอน)
        <div className="lf-cd-pend-late">
          <span className="lf-cd-pend-late-txt">ถ้าต้องการให้ร้านช่วยตรวจสอบ</span>
          <a className="lf-btn lf-btn--ghost lf-btn--sm lf-cd-pend-call-btn" href={SHOP_TEL}><Icon name="phone" size={20} /> โทรร้าน <span className="lf-nw">{SHOP_PHONE}</span></a>
        </div>
      )}
    </div>
  );
}

/** กติกาคืนระดับ (lib/perks.ts reactivateText) ห่อเป็นวลีห้ามตัด */
export function ReactivateRule() {
  const [a, b] = reactivateText();
  return <><span className="lf-nw">{a}</span> <span className="lf-nw">{b}</span></>;
}

// อักษรย่อแทนรูปโปรไฟล์ · ชื่อไทยที่ขึ้นต้นด้วยสระนำใช้อักษรถัดไป เพื่อให้อ่านเป็นชื่อเจ้าของบัตร
function memberInitial(name: string): string {
  const chars = Array.from(name.trim());
  if (!chars.length) return "ส";
  return "เแโใไ".includes(chars[0]) && chars[1] ? chars[1] : chars[0];
}
