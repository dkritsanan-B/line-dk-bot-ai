"use client";
// จอสมัครสมาชิก (P1 ชวนสมัคร + P2 ฟอร์มสมัคร)
// บันไดระดับดึงชื่อ/เกณฑ์จาก TIERS (ซึ่งมาจาก lib/points.ts) — ห้ามพิมพ์ตัวเลขเกณฑ์ที่นี่
import { Shell } from "../ui";
import { TIERS } from "../lib/tiers";
import type { Profile } from "../lib/types";
import MemberForm, { type MemberFormProps } from "./MemberForm";
import Icon from "./Icon";
import TierMark from "./TierMark";
import { BAHT_PER_POINT, PENDING_POINTS_DAYS, bahtFor, birthdayFrom, birthdayPointsOf, firstTierOf, ladderNote, retailSummary } from "../lib/perks";

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
        <div className="lf-signup-pitch" aria-label="สิทธิ์ที่ได้รับจากสมาชิก">
          <b>สมัครฟรี แล้วสะสมแต้มทุกบิล</b>
          <span>ทุก {BAHT_PER_POINT} บาท = 1 แต้ม · ระดับสูงขึ้นรับส่วนลดหน้าร้านสูงสุด {disc.max}%</span>
          <small>สิทธิ์เริ่มหลังพนักงานยืนยันตัวตนที่ร้านครั้งเดียว</small>
        </div>
        <div className="lf-signup-steps" aria-label="ขั้นตอนสมัครสมาชิก">
          <div className="on"><b>1</b><span>กรอกข้อมูล<small>ตอนนี้</small></span></div>
          <i aria-hidden="true" />
          <div><b>2</b><span>ยืนยันที่ร้าน<small>ครั้งเดียว</small></span></div>
          <i aria-hidden="true" />
          <div><b>3</b><span>เริ่มใช้สิทธิ์<small>ทุกครั้งที่ซื้อ</small></span></div>
        </div>
        <MemberForm isEdit={false} {...form} />
        <div className="lf-after-signup" aria-label="หลังสมัครสมาชิก">
          <b>หลังสมัคร</b>
          <span>มาซื้อครั้งแรก บอกเบอร์ให้แคชเชียร์ยืนยันครั้งเดียว ใช้เวลาไม่กี่วินาที</span>
          <small>บิลตั้งแต่วันสมัครได้แต้มย้อนหลังอัตโนมัติ (ไม่เกิน {PENDING_POINTS_DAYS} วัน)</small>
        </div>
        <details className="lf-benefit-details">
          <summary>ดูสิทธิ์และระดับสมาชิกทั้งหมด</summary>
          <div className="lf-perks">
          <div className="lf-perk"><i><Icon name="star" size={24} /></i><div><b>สะสมแต้ม</b><span>ทุก {BAHT_PER_POINT} บาท = 1 แต้ม</span></div></div>
          <div className="lf-perk"><i><Icon name="tag" size={24} /></i><div><b>ส่วนลดหน้าร้าน สูงสุด {disc.max}%</b><span>ฮาร์ดแวร์ เครื่องมือ สี · เริ่มระดับ {disc.from}</span></div></div>
          <div className="lf-perk"><i><Icon name="star" size={24} /></i><div><b>เหล็ก เมทัลชีท ได้แต้มพิเศษ</b><span>ซื้อราคาป้าย · เริ่มระดับ {firstTierOf("steel")}</span></div></div>
          <div className="lf-perk"><i><Icon name="cake" size={24} /></i><div><b>คูปองวันเกิดทุกปี</b><span>เริ่ม {birthdayPointsOf(birthdayFrom()).toLocaleString()} แต้ม ตั้งแต่ระดับ {birthdayFrom()}</span></div></div>
          <div className="lf-perk"><i><Icon name="gift" size={24} /></i><div><b>แลกของรางวัล</b><span>ใช้แต้มแลกส่วนลดเงินสดหรือของใช้ช่าง</span></div></div>
          </div>
        {/* บันไดระดับ — มี "ขั้นที่" กำกับ เพราะชื่อระดับเป็นอังกฤษ ช่างต้องรู้ว่าอะไรสูงกว่าอะไรโดยไม่ต้องเดา */}
        <div className="lf-ladder-head">ระดับสมาชิก <span>ยิ่งสะสมมาก ยิ่งลดมาก</span></div>
        <ol className="lf-ladder">
          {[...TIERS].reverse().map((t, i) => (
            <li key={t.name}>
              <span className="lf-ladder-step">ขั้น {i + 1}</span>
              <b><TierMark tier={t} /> {t.name}</b>
              <span className="lf-ladder-min">{t.min > 0 ? <>สะสม {t.min.toLocaleString()} แต้ม <small className="lf-nw">(ซื้อราว {bahtFor(t.min)} บาท)</small></> : "เริ่มต้น"}</span>
              <em>{ladderNote(t.name)}</em>
            </li>
          ))}
        </ol>
        </details>
      </div>
      <div className="lf-foot">
        <div className="lf-foot-key">ซื้อครั้งต่อไป บอกเบอร์หรือยื่นหน้าบัตรสมาชิกก่อนคิดเงิน</div>
        ไม่ได้พกมือถือหรือเน็ตไม่ดี ใช้เบอร์โทรที่สมัครไว้ได้ค่ะ
      </div>
    </Shell>
  );
}
