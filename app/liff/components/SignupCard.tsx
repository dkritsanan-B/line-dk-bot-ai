"use client";
// จอสมัครสมาชิก (P1 ชวนสมัคร + P2 ฟอร์มสมัคร)
// บันไดระดับดึงชื่อ/เกณฑ์จาก TIERS (ซึ่งมาจาก lib/points.ts) — ห้ามพิมพ์ตัวเลขเกณฑ์ที่นี่
import { Shell } from "../ui";
import { TIERS } from "../lib/tiers";
import type { Profile } from "../lib/types";
import MemberForm, { type MemberFormProps } from "./MemberForm";
import Icon from "./Icon";
import TierMark from "./TierMark";
import { RULES } from "@/lib/tierRules";
import { BAHT_PER_POINT, PENDING_POINTS_DAYS, bahtFor, birthdayFrom, birthdayPointsOf, firstTierOf, ladderNote, retailSummary } from "../lib/perks";

export default function SignupCard({ profile, form }: { profile: Profile | null; form: Omit<MemberFormProps, "isEdit"> }) {
  const disc = retailSummary();
  // ช่วงส่วนลดหน้าร้าน (หมวดปลีก) ต่ำสุด–สูงสุดของระดับที่มีส่วนลด — อ่านจากกติกา ไม่พิมพ์ตัวเลขเอง
  const discMin = Math.min(...RULES.retail.byTier.filter(n => n > 0));
  const discRange = discMin === disc.max ? `${disc.max}%` : `${discMin}–${disc.max}%`;
  return (
    <Shell sub="สมัครสมาชิก · สะสมแต้ม · รับส่วนลด" layout="form">
      <div className="lf-card">
        <div className="lf-who">
          {profile?.pictureUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={profile.pictureUrl} alt="" />
            : <div className="ph"><Icon name="user" size={28} /></div>}
          <div><b>สวัสดีค่ะ {profile?.displayName}</b><span><span className="lf-nw">สมัครสมาชิกฟรี</span> <span className="lf-nw">ใช้เวลาไม่ถึง 1 นาที</span></span></div>
        </div>
        {/* c3: กล่องชวนสมัครเหลือ 2 บรรทัด · "สิทธิ์เริ่มหลังยืนยัน" ตัดทิ้ง เพราะขั้นตอนที่ 2 บอกอยู่แล้ว */}
        <ul className="lf-ct-pitch" aria-label="สิทธิ์ที่ได้รับจากสมาชิก">
          <li><Icon name="star" size={22} /><span><span className="lf-nw">ทุก {BAHT_PER_POINT} บาท</span> <span className="lf-nw">= 1 แต้ม</span></span></li>
          <li><Icon name="tag" size={22} /><span><span className="lf-nw">ส่วนลดหน้าร้าน</span> <span className="lf-nw">{discRange} ตามระดับ</span></span></li>
        </ul>
        {/* ขั้นตอน: เส้นเชื่อมทึบ 2px เต็มช่อง · คำในแต่ละขั้นห้ามตัดกลางคำ */}
        <ol className="lf-ct-steps" aria-label="ขั้นตอนสมัครสมาชิก">
          <li className="on"><b>1</b><span className="lf-nw">กรอกข้อมูล</span><small className="lf-nw">ตอนนี้</small></li>
          <li><b>2</b><span className="lf-nw">ยืนยันที่ร้าน</span><small className="lf-nw">ครั้งเดียว</small></li>
          <li><b>3</b><span className="lf-nw">เริ่มใช้สิทธิ์</span><small className="lf-nw">ทุกครั้งที่ซื้อ</small></li>
        </ol>
        <MemberForm isEdit={false} {...form} />
        <div className="lf-after-signup" aria-label="หลังสมัครสมาชิก">
          <b>หลังสมัคร</b>
          <span><span className="lf-nw">มาซื้อครั้งแรก</span> <span className="lf-nw">บอกเบอร์ให้แคชเชียร์</span> <span className="lf-nw">ยืนยันครั้งเดียว</span> <span className="lf-nw">ใช้เวลาไม่กี่วินาที</span></span>
          <small><span className="lf-nw">บิลตั้งแต่วันสมัคร</span> <span className="lf-nw">ได้แต้มย้อนหลังอัตโนมัติ</span> <span className="lf-nw">(ไม่เกิน {PENDING_POINTS_DAYS} วัน)</span></small>
        </div>
        <details className="lf-benefit-details">
          <summary>ดูสิทธิ์และระดับสมาชิกทั้งหมด</summary>
          <div className="lf-perks">
          <div className="lf-perk"><i><Icon name="star" size={24} /></i><div><b>สะสมแต้ม</b><span>ทุก {BAHT_PER_POINT} บาท = 1 แต้ม</span></div></div>
          <div className="lf-perk"><i><Icon name="tag" size={24} /></i><div><b>ส่วนลดหน้าร้าน {discRange} ตามระดับ</b><span>ฮาร์ดแวร์ เครื่องมือ สี · เริ่มระดับ {disc.from}</span></div></div>
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
        <div className="lf-foot-key"><span className="lf-nw">ซื้อครั้งต่อไป</span> <span className="lf-nw">บอกเบอร์หรือยื่นหน้าบัตรสมาชิก</span> <span className="lf-nw">ก่อนคิดเงิน</span></div>
        <span className="lf-nw">ไม่ได้พกมือถือหรือเน็ตไม่ดี</span> <span className="lf-nw">ใช้เบอร์โทรที่สมัครไว้ได้ค่ะ</span>
      </div>
    </Shell>
  );
}
