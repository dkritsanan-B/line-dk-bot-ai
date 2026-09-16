"use client";
// บัตรสมาชิก + ความคืบหน้าระดับ (P3) — JSX เดิมจาก page.tsx
import { formatDate, type Tier } from "../lib/tiers";
import type { Member, Profile } from "../lib/types";

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
  return (
    <div className="lf-mcard" style={{ background: tier.cardGrad }}>
      <div className="lf-mcard-top">
        <div className="lf-mcard-label">MEMBER CARD</div>
        <div className="lf-tier">{tier.emoji} {tier.name}</div>
      </div>
      <div className="lf-mcard-who">
        {profile?.pictureUrl ? <img src={profile.pictureUrl} alt="" /> : <div className="ph">👤</div>}
        <div style={{ minWidth: 0 }}>
          <div className="lf-mcard-name">{name}</div>
          {member?.company && <div className="lf-mcard-meta">🏢 {member.company}</div>}
          <div className="lf-mcard-meta">📞 {formattedPhone}</div>
        </div>
      </div>
      <div className="lf-mcard-points">
        <div>
          <div className="lf-points-lbl">แต้มสะสม</div>
          <div className="lf-points-num">{points.toLocaleString()}</div>
        </div>
        {member?.birthday && (
          <div className="lf-chip">🎂 {new Date(member.birthday).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</div>
        )}
      </div>
      {nextTier ? (
        <div className="lf-prog">
          <div className="lf-prog-txt">
            <span>{tier.emoji} {tier.name}</span>
            <span>อีก {(nextTier.min - totalEarned).toLocaleString()} แต้ม → {nextTier.emoji} {nextTier.name}</span>
          </div>
          <div className="lf-prog-bar"><i style={{ width: `${progress}%` }} /></div>
        </div>
      ) : (
        <div className="lf-prog" style={{ textAlign: "center", fontSize: 12.5, opacity: .9 }}>🏆 ระดับสูงสุดแล้ว ขอบคุณที่ไว้วางใจ DK ค่ะ</div>
      )}
      <div className="lf-mcard-foot">สมาชิกตั้งแต่ {member?.created_at ? formatDate(member.created_at) : "-"}</div>
    </div>
  );
}
