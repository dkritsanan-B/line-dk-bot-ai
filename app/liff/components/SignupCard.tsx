"use client";
// จอสมัครสมาชิก (P1 ชวนสมัคร + P2 ฟอร์มสมัคร) — JSX เดิมจาก page.tsx
import { Shell } from "../ui";
import { TIERS } from "../lib/tiers";
import type { Profile } from "../lib/types";
import MemberForm, { type MemberFormProps } from "./MemberForm";

export default function SignupCard({ profile, form }: { profile: Profile | null; form: Omit<MemberFormProps, "isEdit"> }) {
  return (
    <Shell sub="สมัครสมาชิก · สะสมแต้ม · รับส่วนลด">
      <div className="lf-card">
        <div className="lf-who">
          {profile?.pictureUrl ? <img src={profile.pictureUrl} alt="" /> : <div className="ph">👤</div>}
          <div><b>สวัสดีค่ะ {profile?.displayName}</b><span>สมัครสมาชิกฟรี ใช้เวลาไม่ถึง 1 นาที</span></div>
        </div>
        <MemberForm isEdit={false} {...form} />
        <div className="lf-perks">
          <div className="lf-perk"><i>⭐</i><b>สะสมแต้ม</b><span>ทุก 100 บาท = 1 แต้ม</span></div>
          <div className="lf-perk"><i>🏷️</i><b>ส่วนลดสมาชิก</b><span>ตามระดับที่ร้าน</span></div>
          <div className="lf-perk"><i>🎁</i><b>แลกของรางวัล</b><span>+ คูปองวันเกิด</span></div>
        </div>
        <div className="lf-ladder">
          {[...TIERS].reverse().map(t => <div key={t.name}><i>{t.emoji}</i><b>{t.name}</b>{t.min > 0 ? `${t.min.toLocaleString()} แต้ม` : "เริ่มต้น"}</div>)}
        </div>
      </div>
      <div className="lf-foot">สมัครแล้วบอกเบอร์โทรที่แคชเชียร์ทุกครั้งที่ซื้อ แต้มจะเข้าอัตโนมัติค่ะ</div>
    </Shell>
  );
}
