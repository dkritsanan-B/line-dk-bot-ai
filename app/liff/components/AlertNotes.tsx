"use client";
// กล่องเตือนใต้ปุ่มลัด — ยืนยันตัวตนสำเร็จ / วันเกิด / ใกล้ลดระดับ / แต้มใกล้หมดอายุ
// ขอบเขตกล่องมาจากแถบข้างซ้ายสีเต็ม (liff.css .lf-note) ซึ่งผ่าน 3:1 กับพื้นกล่อง
//
// c2 (ผู้ตรวจ c1):
//   - รอยืนยันนาน: ย้ายไปอยู่ในบัตร (PendingWell) ที่เดียว ไม่ซ้ำกล่องเหลืองอีก
//   - ผูกบัญชีสำเร็จ: ต้องมีข้อความยินดี ไม่ใช่ป้ายเตือนหายไปเงียบ ๆ
//   - ใกล้ลดระดับ: เตือนล่วงหน้า 3 เดือน พร้อม "วันที่" ที่ต้องมาซื้อก่อน
//   - วันเกิด: คำสัญญาตอนสมัครต้องโผล่ให้เห็นจริงช่วงใกล้วันเกิด
//
// ผู้ตรวจดีไซน์ (7.5/10): กล่องซ้อนกันหลายใบดันสิทธิ์ตกขอบจอ
//   - แสดง "กล่องเดียว" เลือกตามลำดับ: ใกล้ลดระดับ > แต้มใกล้หมดอายุ > วันเกิด > เพิ่งยืนยันตัวตน
//     ที่ไม่ได้แสดงก็ตัดทิ้ง (แต้มหมดอายุยังดูได้ในประวัติแต้ม ตัวกรอง "หมดอายุ")
//   - ตัดกล่องเขียว "ยังไม่มีแต้มใกล้หมดอายุ" ออก — ไม่มีเรื่องต้องห่วง = ไม่ต้องมีกล่อง
//   - แต้มหมดอายุจำนวนน้อย → โน้ตเงียบบรรทัดเดียว ไม่ใช่กล่องเหลืองใหญ่
//   - ระดับลดชั่วคราว: คำอธิบายอยู่บนบัตร (MemberCard) ที่เดียว ไม่พูดซ้ำที่นี่
//   - ดูวันหมดอายุไม่ได้ (ระบบขัดข้อง) ยังต้องบอก แต่เป็นโน้ตเงียบบรรทัดเดียว
import { formatDate, TIERS, type Tier } from "../lib/tiers";
import type { ClientLink, Expiry } from "../lib/types";
import { birthdayFrom, birthdayPointsOf } from "../lib/perks";
import Icon from "./Icon";
import TierMark from "./TierMark";
import { ReactivateRule } from "./MemberCard";
import "../styles/alerts.css";

const YEAR_MS = 365 * 86400000;
const BIRTHDAY_NOTICE_DAYS = 14;
type AlertKind = "nearDrop" | "expiring" | "birthday" | "welcome";

export default function AlertNotes({
  isInactive, isNearDrop, tier, expiry, onViewExpiring, expiryUnavailable,
  lastPurchaseAt, justLinked, birthdayIn,
}: {
  /** ไม่ได้ใช้แล้ว (คำอธิบายระดับลดชั่วคราวย้ายไปอยู่บนบัตร) — คงไว้ให้ page.tsx ส่งได้เหมือนเดิม */
  totalEarned?: number;
  isInactive: boolean;
  isNearDrop: boolean;
  tier: Tier;
  /** ไม่ได้ใช้แล้ว — เหตุผลเดียวกับ totalEarned */
  baseTier?: Tier;
  lastPurchaseAt: string | null;
  expiry: Expiry | null;
  onViewExpiring: () => void;
  /** API อ่านวันหมดอายุไม่ได้ตอนนี้ — บัตรขึ้นปกติ แต่ต้องบอก ไม่ใช่เงียบ */
  expiryUnavailable?: boolean;
  /** เพิ่งยืนยันตัวตนสำเร็จ ยังไม่มีบิลแรก */
  justLinked?: ClientLink | null;
  /** อีกกี่วันถึงวันเกิด (0 = วันนี้) */
  birthdayIn?: number | null;
}) {
  const expiringPts = expiry?.expiring_points ?? 0;
  const hasExpiring = !expiryUnavailable && !!expiry?.earliest_expiry && expiringPts > 0;
  const showBirthday = birthdayIn !== null && birthdayIn !== undefined && birthdayIn <= BIRTHDAY_NOTICE_DAYS;
  // ระดับลดไปแล้ว (inactive) ไม่ต้องเตือน "ใกล้ลด" ซ้ำ — บัตรบอกทางกลับอยู่แล้ว
  const showNearDrop = !isInactive && isNearDrop && !!lastPurchaseAt;

  // เลือกกล่องเดียวตามลำดับความสำคัญ
  const kind: AlertKind | null =
    showNearDrop ? "nearDrop"
    : hasExpiring ? "expiring"
    : showBirthday ? "birthday"
    : justLinked ? "welcome"
    : null;

  return (
    <>
      {kind === "nearDrop" && <NearDrop tier={tier} lastPurchaseAt={lastPurchaseAt!} />}
      {kind === "expiring" && (
        <Expiring expiry={expiry!} onView={onViewExpiring} />
      )}
      {kind === "birthday" && <Birthday tier={tier} birthdayIn={birthdayIn!} />}
      {kind === "welcome" && <Welcome link={justLinked!} />}
      {expiryUnavailable && (
        <div className="lf-note lf-al-quiet" role="status">
          <i><Icon name="hourglass" size={18} /></i>
          <span className="lf-al-txt">ดูวันหมดอายุแต้มไม่ได้ชั่วคราว</span>
        </div>
      )}
    </>
  );
}

function NearDrop({ tier, lastPurchaseAt }: { tier: Tier; lastPurchaseAt: string }) {
  const dropDate = formatDate(new Date(new Date(lastPurchaseAt).getTime() + YEAR_MS).toISOString());
  return (
    <div className="lf-note lf-note--warn">
      <b><i><Icon name="alert" size={20} /></i> รักษาระดับ {tier.name} ไว้</b>
      {/* r5: กติกาประโยคเดียวกับบัตรพักระดับ (lib/perks.ts reactivateText) */}
      <ReactivateRule /> <strong className="lf-nw">ก่อน {dropDate}</strong> <span className="lf-nw">ระดับ <TierMark tier={tier} /> <strong>{tier.name}</strong> อยู่ต่ออีก 1 ปี</span>
      {/* r7 (ผู้ตรวจ): "·" ห้อยท้ายบรรทัด → ขึ้นบรรทัดใหม่แทน */}
      <span className="lf-al-line"><span className="lf-nw">ถ้าเลยวันนั้น ระดับจะพักไว้</span> <span className="lf-nw">จนกว่าจะมีบิลถัดไปค่ะ</span></span>
    </div>
  );
}

function Expiring({ expiry, onView }: { expiry: Expiry; onView: () => void }) {
  const pts = expiry.expiring_points ?? 0;
  const exp = expiry.earliest_expiry!;
  const expDate = new Date(exp).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  const daysLeft = Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000);
  return (
    <button type="button" className="lf-note lf-note--warn lf-cd-exp" onClick={onView}>
      <i><Icon name="hourglass" size={20} /></i>
      <span className="lf-cd-exp-txt">
        <strong>{pts.toLocaleString()} แต้ม</strong>หมดอายุ{daysLeft >= 0 ? `ใน ${daysLeft} วัน` : "แล้ว"} <span className="lf-nw">({expDate})</span>
      </span>
      <Icon name="chevron" size={20} />
    </button>
  );
}

function Birthday({ tier, birthdayIn }: { tier: Tier; birthdayIn: number }) {
  const bdPts = birthdayPointsOf(tier.name);
  const bdFromTier = TIERS.find(t => t.name === birthdayFrom());
  return (
    <div className="lf-note lf-note--gift">
      <b><i><Icon name="cake" size={20} /></i> {birthdayIn === 0 ? "สุขสันต์วันเกิดค่ะ" : `อีก ${birthdayIn} วัน วันเกิดของคุณ`}</b>
      {bdPts > 0 ? (
        birthdayIn === 0
          ? <>ร้านมอบคูปองวันเกิด <strong>{bdPts.toLocaleString()} แต้ม</strong> (ระดับ {tier.name}) เข้าบัญชีให้เช้านี้ ดูได้ในประวัติแต้มค่ะ</>
          : <>รับคูปองวันเกิด <strong>{bdPts.toLocaleString()} แต้ม</strong> (ระดับ {tier.name}) ระบบเติมให้อัตโนมัติเช้าวันเกิด ไม่ต้องทำอะไรค่ะ</>
      ) : (
        <>คูปองวันเกิดเริ่มที่ระดับ {bdFromTier && <TierMark tier={bdFromTier} />} <strong>{birthdayFrom()}</strong> ({birthdayPointsOf(birthdayFrom()).toLocaleString()} แต้ม) · <span className="lf-nw">สะสมถึงก่อนวันเกิด รับได้เลยค่ะ</span></>
      )}
    </div>
  );
}

function Welcome({ link }: { link: ClientLink }) {
  return (
    <div className="lf-note lf-note--ok lf-note--welcome">
      <b><i><Icon name="check" size={20} /></i> ยืนยันตัวตนเรียบร้อยแล้วค่ะ</b>
      <span>
        {link.customer_id && <><span className="lf-nw">รหัสลูกค้า <strong>{link.customer_id}</strong></span> · </>}
        ต่อไปซื้อของ บอกเบอร์โทรที่แคชเชียร์ แต้มเข้าเองทุกบิล ปกติเห็นในหน้านี้ภายในวันที่ซื้อ
      </span>
    </div>
  );
}
