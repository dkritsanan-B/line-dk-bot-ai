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
//   "เลื่อนระดับ X / Y" = totalEarned → บรรทัด 14px (คำอธิบายว่าคิดอย่างไรอยู่ในหัวข้อ "แต้มคิดอย่างไร")
//
// data-ink ต้องมีเสมอ — เป็นตัวเลือกชุดสีตัวอักษรของบัตร (light/dark) ใน liff.css
// ถ้าลืมใส่ ตัวอักษรบนบัตรจะไม่มีสีเลย (ตกทอดเป็นสีเข้มบนพื้นเข้ม) → scripts/check-tiers.mjs จะ fail
import { formatDate, type Tier } from "../lib/tiers";
import { SHOP_PHONE, SHOP_TEL } from "../lib/api";
import type { ClientLink, Member, Profile } from "../lib/types";
import Icon from "./Icon";
import TierMark from "./TierMark";
import "../styles/card.css";

export default function MemberCard({
  tier, nextTier, totalEarned, points, progress, name, formattedPhone, member, profile, pendingLink, realTier,
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
  /** มีค่า = ระดับลดชั่วคราว (ไม่ได้ซื้อเกิน 1 ปี) · ค่าคือระดับจริงตามยอดสะสม
   *  ผู้ตรวจ c1: บัตรสี Bronze แต่ยอดสะสม 2,600 = ดูเหมือนระบบคิดผิด → ต้องบอกบนบัตรเลยว่าทำไม */
  realTier?: Tier | null;
}) {
  const toNext = nextTier ? Math.max(0, nextTier.min - totalEarned) : 0;
  const birthday = member?.birthday
    ? new Date(member.birthday).toLocaleDateString("th-TH", { day: "numeric", month: "short" })
    : null;
  return (
    <section className="lf-mcard lf-cd-card" data-ink={tier.ink} style={{ background: tier.cardGrad }}>
      <div className="lf-mcard-top">
        <div className="lf-mcard-label">บัตรสมาชิก DK</div>
        {pendingLink ? (
          // ยังไม่ผูก: ป้าย "Welcome" ชวนเข้าใจว่าเริ่มเก็บแต้มแล้ว → ป้ายอำพัน "รอยืนยัน" แทน
          <div className="lf-tier lf-cd-tier-wait"><Icon name="hourglass" size={18} /> รอยืนยัน</div>
        ) : (
          <div className="lf-tier"><TierMark tier={tier} /> {tier.name}{realTier && <small className="lf-tier-temp">ชั่วคราว</small>}</div>
        )}
      </div>

      {/* 1. ใครคือเรา */}
      <div className="lf-mcard-who">
        {profile?.pictureUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={profile.pictureUrl} alt="" />
          : <div className="ph"><Icon name="user" size={28} /></div>}
        <div className="lf-mcard-id">
          <div className="lf-mcard-name">{name}</div>
          {member?.company && <div className="lf-mcard-meta"><i><Icon name="building" size={18} /></i>{member.company}</div>}
          {/* รอยืนยัน: เบอร์ย้ายไปตัวใหญ่ในกล่องด้านล่าง (ให้พนักงานอ่านจากจอ) ไม่แสดงซ้ำ */}
          {!pendingLink && <div className="lf-mcard-meta"><i><Icon name="phone" size={18} /></i><b>{formattedPhone}</b></div>}
        </div>
      </div>

      {/* 2. ยังไม่ผูก → เรื่องแรกที่ต้องรู้คือ "แต้มยังไม่เข้า" ไม่ใช่เลข 0 เฉย ๆ (บั๊กเงียบ 16 ก.ย. 69) */}
      {pendingLink ? <PendingWell link={pendingLink} phone={formattedPhone} /> : (
      <div className="lf-mcard-well">
        <div className="lf-points-lbl">แต้มที่ใช้แลกได้</div>
        <div className="lf-points-num">{points.toLocaleString()}<span className="lf-points-unit">แต้ม</span></div>

        {nextTier ? (
          <div className="lf-prog lf-cd-prog">
            {toNext > 0 ? (<>
            {/* ตัวเลขชุดที่ 2 เป็นบรรทัดเล็กบรรทัดเดียว — ห้ามแข่งกับแต้มที่ใช้แลกได้ */}
            <div className="lf-cd-prog-head">
              เลื่อนระดับ <b>{totalEarned.toLocaleString()} / {nextTier.min.toLocaleString()}</b>
            </div>
            <div
              className="lf-prog-bar"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`ความคืบหน้าไประดับ ${nextTier.name}`}
            >
              <i style={{ width: `${progress}%` }} />
            </div>
            {/* ปลายสองข้างของแถบ = เกณฑ์จริงของระดับ บรรทัดเดียว */}
            <div className="lf-cd-prog-ends">
              <span><TierMark tier={tier} /> {tier.name} <b>{tier.min.toLocaleString()}</b></span>
              <span><TierMark tier={nextTier} /> {nextTier.name} <b>{nextTier.min.toLocaleString()}</b></span>
            </div>
            <div className="lf-cd-prog-msg">
              อีก <b>{toNext.toLocaleString()}</b> แต้ม <span className="lf-nw">เป็น {nextTier.name}</span>
            </div>
            </>) : realTier ? (
              // ระดับลดชั่วคราว: ยอดสะสมถึงระดับจริงอยู่แล้ว — อธิบายในบัตรเลยว่าทำไมป้ายกับยอดไม่ตรงกัน
              <>
                <div className="lf-cd-prog-head">ยอดสะสม <b>{totalEarned.toLocaleString()} แต้ม</b></div>
                <div className="lf-prog-real">
                  <div>ระดับจริงของคุณ <b className="lf-nw"><TierMark tier={realTier} /> {realTier.name}</b></div>
                  <span><b className="lf-nw">ซื้อครั้งถัดไป กลับเป็น {realTier.name} ทันที</b></span>
                </div>
              </>
            ) : (
              <>
                <div className="lf-cd-prog-head">ยอดสะสม <b>{totalEarned.toLocaleString()} แต้ม</b></div>
                <div className="lf-cd-prog-msg">
                  ยอดสะสมถึงระดับเดิมแล้ว <span className="lf-nw">ซื้อครั้งถัดไป ระดับกลับมาทันที</span>
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
function PendingWell({ link, phone }: { link: ClientLink; phone: string }) {
  const days = link.waiting_days ?? 0;
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
      <p className="lf-cd-pend-why"><span className="lf-nw">บิลตั้งแต่วันสมัคร</span> <span className="lf-nw">(ไม่เกิน 30 วัน)</span> <span className="lf-nw">ได้แต้มย้อนหลัง</span></p>
      {link.overdue && (
        <div className="lf-cd-pend-late">
          <Icon name="alertCircle" size={18} />
          <span>สมัครมา <b>{days.toLocaleString()} วัน</b> ยังไม่ได้ยืนยัน <span className="lf-cd-pend-call">โทรถามร้าน <a className="lf-note-tel" href={SHOP_TEL}>{SHOP_PHONE}</a></span></span>
        </div>
      )}
    </div>
  );
}
