"use client";
// จอสมัครสมาชิก (P1 ชวนสมัคร + P2 ฟอร์มสมัคร)
// บันไดระดับดึงชื่อ/เกณฑ์จาก TIERS (ซึ่งมาจาก lib/points.ts) — ห้ามพิมพ์ตัวเลขเกณฑ์ที่นี่
import { Shell } from "../ui";
import { TIERS } from "../lib/tiers";
import type { Profile } from "../lib/types";
import MemberForm, { type MemberFormProps } from "./MemberForm";
import Icon from "./Icon";
import TierMark from "./TierMark";
import { ladderNote, retailSummary } from "../lib/perks";

export default function SignupCard({ profile, form }: { profile: Profile | null; form: Omit<MemberFormProps, "isEdit"> }) {
  const disc = retailSummary();
  return (
    <Shell sub="สมัครสมาชิก · สะสมแต้ม · รับส่วนลด" layout="form">
      <div className="lf-card">
        <div className="lf-who">
          {profile?.pictureUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={profile.pictureUrl} alt="" />
            : <div className="ph"><Icon name="user" size={28} /></div>}
          <div><b>สวัสดีค่ะ {profile?.displayName}</b><span>สมัครสมาชิกฟรี ใช้เวลาไม่ถึง 1 นาที</span></div>
        </div>
        <MemberForm isEdit={false} {...form} />
        <div className="lf-perks">
          <div className="lf-perk"><i><Icon name="star" size={24} /></i><div><b>สะสมแต้ม</b><span>ทุก 100 บาท = 1 แต้ม</span></div></div>
          <div className="lf-perk"><i><Icon name="tag" size={24} /></i><div><b>ส่วนลดหน้าร้าน สูงสุด {disc.max}%</b><span>เริ่มได้ตั้งแต่ระดับ {disc.from}</span></div></div>
          <div className="lf-perk"><i><Icon name="gift" size={24} /></i><div><b>แลกของรางวัล</b><span>ใช้แต้มแลกได้ + ของขวัญวันเกิด</span></div></div>
        </div>
        {/* บันไดระดับ — มี "ขั้นที่" กำกับ เพราะชื่อระดับเป็นอังกฤษ ช่างต้องรู้ว่าอะไรสูงกว่าอะไรโดยไม่ต้องเดา */}
        <div className="lf-ladder-head">ระดับสมาชิก <span>ยิ่งสะสมมาก ยิ่งลดมาก</span></div>
        <ol className="lf-ladder">
          {[...TIERS].reverse().map((t, i) => (
            <li key={t.name}>
              <span className="lf-ladder-step">ขั้น {i + 1}</span>
              <b><TierMark tier={t} /> {t.name}</b>
              <span className="lf-ladder-min">{t.min > 0 ? `สะสม ${t.min.toLocaleString()} แต้ม` : "เริ่มต้น"}</span>
              <em>{ladderNote(t.name)}</em>
            </li>
          ))}
        </ol>
      </div>
      <div className="lf-foot">
        <span className="lf-nw">สมัครแล้ว ซื้อของทุกครั้ง</span> <span className="lf-nw">บอกเบอร์โทรที่แคชเชียร์</span><br />
        <span className="lf-nw">แต้มจะเข้าอัตโนมัติค่ะ</span>
      </div>
    </Shell>
  );
}
