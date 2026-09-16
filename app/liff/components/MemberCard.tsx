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
import type { Member, Profile } from "../lib/types";
import Icon from "./Icon";
import TierMark from "./TierMark";

export default function MemberCard({
  tier, nextTier, totalEarned, points, progress, name, formattedPhone, member, profile,
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
}) {
  const toNext = nextTier ? Math.max(0, nextTier.min - totalEarned) : 0;
  return (
    <section className="lf-mcard" data-ink={tier.ink} style={{ background: tier.cardGrad }}>
      <div className="lf-mcard-top">
        <div className="lf-mcard-label">บัตรสมาชิก DK</div>
        <div className="lf-tier"><TierMark tier={tier} /> {tier.name}</div>
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

      {/* 2. มีกี่แต้ม + 3. อีกเท่าไหร่เลื่อนขั้น — อยู่ในกล่องเดียวกัน */}
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
            <div className="lf-prog-note">นับแต้มที่เคยได้ทั้งหมด แลกของแล้วไม่ลด</div>
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
            </>) : (
              // ระดับลดชั่วคราว: ยอดสะสมถึงเกณฑ์ระดับที่สูงกว่าแล้ว — ไม่โชว์แถบเต็ม (ดูขัดกับชื่อระดับ)
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

      <div className="lf-mcard-foot">สมาชิกตั้งแต่ {member?.created_at ? formatDate(member.created_at) : "-"}</div>
    </section>
  );
}
