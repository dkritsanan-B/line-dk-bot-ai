"use client";
// บัตรสมาชิก + ความคืบหน้าระดับ (P3)
//
// ลำดับที่ตาต้องอ่านได้ใน 5 วินาที (ช่างยืนหน้าเคาน์เตอร์ มีคนต่อคิว):
//   1. ใครคือเรา   → รูป + ชื่อ + บริษัท/เบอร์ เป็นบล็อกเดียวกัน (.lf-mcard-who)
//   2. มีกี่แต้ม    → ตัวเลขใหญ่ในกล่องทึบ (.lf-mcard-well) ที่คุมคอนทราสต์ไว้คงที่ทุกจุดของไล่สี
//   3. อีกเท่าไหร่เลื่อนขั้น → แถบความคืบหน้า + ประโยคสรุปใต้แถบ ในกล่องเดียวกับแต้ม
//
// ตัวเลข 2 ชุดต้องมีชื่อกำกับเสมอ (ผู้ตรวจ r3: 2,300 + 2,240 ≠ 5,000 แล้วช่างเลิกเชื่อทั้งบัตร)
//   "แต้มใช้ได้"            = points       (แลกของแล้วลด)
//   "ยอดสะสมเพื่อเลื่อนระดับ" = totalEarned  (แลกของแล้วไม่ลด) → แสดง "ยอดสะสม / เกณฑ์ระดับถัดไป" ให้บวกลบในใจได้ลงตัว
//
// data-ink ต้องมีเสมอ — เป็นตัวเลือกชุดสีตัวอักษรของบัตร (light/dark) ใน liff.css
// ถ้าลืมใส่ ตัวอักษรบนบัตรจะไม่มีสีเลย (ตกทอดเป็นสีเข้มบนพื้นเข้ม) → scripts/check-tiers.mjs จะ fail
import { formatDate, type Tier } from "../lib/tiers";
import { SHOP_PHONE, SHOP_TEL } from "../lib/api";
import type { ClientLink, Member, Profile } from "../lib/types";
import Icon from "./Icon";
import TierMark from "./TierMark";

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
  return (
    <section className="lf-mcard" data-ink={tier.ink} style={{ background: tier.cardGrad }}>
      <div className="lf-mcard-top">
        <div className="lf-mcard-label">บัตรสมาชิก DK</div>
        <div className="lf-tier"><TierMark tier={tier} /> {tier.name}{realTier && <small className="lf-tier-temp">ชั่วคราว</small>}</div>
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
          <div className="lf-mcard-meta"><i><Icon name="phone" size={18} /></i><b>{formattedPhone}</b></div>
          {member?.birthday && (
            <div className="lf-mcard-meta"><i><Icon name="cake" size={18} /></i>
              วันเกิด {new Date(member.birthday).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
            </div>
          )}
        </div>
      </div>

      {/* 2. ยังไม่ผูก → เรื่องแรกที่ต้องรู้คือ "แต้มยังไม่เข้า" ไม่ใช่เลข 0 เฉย ๆ (บั๊กเงียบ 16 ก.ย. 69) */}
      {pendingLink ? <PendingWell link={pendingLink} /> : (
      <div className="lf-mcard-well">
        <div className="lf-points-lbl">แต้มใช้ได้ <small>(ใช้แลกของรางวัล)</small></div>
        <div className="lf-points-num">{points.toLocaleString()}<span className="lf-points-unit">แต้ม</span></div>

        {nextTier ? (
          <div className="lf-prog">
            {/* ตัวเลขชุดที่ 2 เป็น "ข้อความรอง" เสมอ (ผู้ตรวจ r5: ตัวใหญ่แข่งกับแต้มใช้ได้ เหลือบแล้วไม่รู้ตัวไหนใช้ได้) */}
            <div className="lf-prog-head">
              <span>ยอดสะสมเพื่อเลื่อนระดับ</span>
              <b>{totalEarned.toLocaleString()} แต้ม</b>
            </div>
            <div className="lf-prog-note">นับจากยอดซื้อ ไม่รวมแต้มของขวัญ · แลกของแล้วไม่ลด</div>
            {toNext > 0 ? (<>
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
            {/* ปลายสองข้างของแถบ = เกณฑ์จริงของระดับ → ตำแหน่งแถบกับตัวเลขคิดตามกันได้ */}
            <div className="lf-prog-txt">
              <span><TierMark tier={tier} /> {tier.name} <b>{tier.min.toLocaleString()}</b></span>
              <span><TierMark tier={nextTier} /> {nextTier.name} <b>{nextTier.min.toLocaleString()}</b></span>
            </div>
            <div className="lf-prog-msg">
              สะสมอีก <b>{toNext.toLocaleString()}</b> แต้ม <span className="lf-nw">เลื่อนเป็น {nextTier.name}</span>
            </div>
            </>) : realTier ? (
              // ระดับลดชั่วคราว: ยอดสะสมถึงระดับจริงอยู่แล้ว — อธิบายในบัตรเลยว่าทำไมป้ายกับยอดไม่ตรงกัน
              <div className="lf-prog-real">
                <div>ระดับจริงของคุณ <b className="lf-nw"><TierMark tier={realTier} /> {realTier.name}</b></div>
                <span><b className="lf-nw">ซื้อครั้งถัดไป กลับเป็น {realTier.name} ทันที</b></span>
              </div>
            ) : (
              <div className="lf-prog-msg">
                ยอดสะสมถึงระดับเดิมแล้ว <span className="lf-nw">ซื้อครั้งถัดไป ระดับกลับมาทันที</span>
              </div>
            )}
          </div>
        ) : (
          <div className="lf-prog lf-prog--max">
            <Icon name="trophy" size={20} /> ระดับสูงสุดแล้ว ขอบคุณที่ไว้วางใจ DK ค่ะ
          </div>
        )}
      </div>
      )}

      <div className="lf-mcard-foot">
        <span className="lf-nw">สมาชิกตั้งแต่ {member?.created_at ? formatDate(member.created_at) : "-"}</span>
        {member?.last_purchase_at && <span className="lf-nw">ซื้อล่าสุด {formatDate(member.last_purchase_at)}</span>}
      </div>
    </section>
  );
}

// กล่องแทนตัวเลขแต้ม ตอนที่ยังไม่ได้ผูกรหัสลูกค้า — คำอธิบายหลักมาจาก API (lib/points.ts toClientLink)
// ตั้งใจไม่แสดงจำนวนบิลค้าง/รหัสที่ระบบเดา (คนสวมเบอร์คนอื่นสมัครได้)
// c2: โทน "อีกขั้นเดียว" (ลูกค้าไม่ได้ทำอะไรผิด) · บอกตรง ๆ ว่าบิลก่อนยืนยันไม่ได้แต้มย้อนหลัง
//     (เจ้าของร้านตัดสินแล้ว — ดู app/api/admin/update-member) และบอกวิธีไม่ให้พลาดบิลถัดไป
//     คำเตือนรอนานอยู่ที่นี่ที่เดียว (เดิมซ้ำ 3 จุด: กล่องนี้ + กล่องเหลือง + ท้ายหน้า)
function PendingWell({ link }: { link: ClientLink }) {
  const days = link.waiting_days ?? 0;
  return (
    <div className={`lf-mcard-well lf-pendwell${link.overdue ? " lf-pendwell--overdue" : ""}`}>
      <div className="lf-pendwell-tag"><Icon name="hourglass" size={18} /> อีกขั้นเดียว</div>
      <div className="lf-pendwell-big">ยืนยันตัวตนที่ร้าน แล้วเริ่มเก็บแต้ม</div>
      <p className="lf-pendwell-detail">{link.detail}</p>
      {link.action && (
        <div className="lf-pendwell-do">
          <b>ทำที่เคาน์เตอร์ ไม่ถึง 1 นาที</b>
          <span>{link.action}</span>
          <span className="lf-pendwell-tip">แจ้งก่อนคิดเงิน บิลนั้นจะได้แต้มเลย · บิลที่ซื้อก่อนยืนยันไม่ได้แต้มย้อนหลังค่ะ</span>
        </div>
      )}
      {link.overdue && (
        <div className="lf-pendwell-foot">
          <Icon name="alertCircle" size={18} />
          <span>สมัครมา <b>{days.toLocaleString()} วัน</b> ยังไม่ได้ยืนยัน · สะดวกโทรถามร้าน <a className="lf-note-tel" href={SHOP_TEL}>{SHOP_PHONE}</a></span>
        </div>
      )}
    </div>
  );
}
