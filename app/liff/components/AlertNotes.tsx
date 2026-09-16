"use client";
// กล่องเตือน — ยืนยันตัวตนสำเร็จ / วันเกิด / ระดับลดชั่วคราว / ใกล้ลด / แต้มใกล้หมดอายุ
// ขอบเขตกล่องมาจากแถบข้างซ้ายสีเต็ม (liff.css .lf-note) ซึ่งผ่าน 3:1 กับพื้นกล่อง
//
// c2 (ผู้ตรวจ c1):
//   - รอยืนยันนาน: ย้ายไปอยู่ในบัตร (PendingWell) ที่เดียว ไม่ซ้ำกล่องเหลืองอีก
//   - ผูกบัญชีสำเร็จ: ต้องมีข้อความยินดี ไม่ใช่ป้ายเตือนหายไปเงียบ ๆ
//   - ระดับลดชั่วคราว: โทนน้ำเงินให้ข้อมูล (ไม่ใช่แดงดุ) + บอกเหตุผลและทางกลับ
//   - ใกล้ลดระดับ: เตือนล่วงหน้า 3 เดือน พร้อม "วันที่" ที่ต้องมาซื้อก่อน
//   - วันเกิด: คำสัญญาตอนสมัครต้องโผล่ให้เห็นจริงช่วงใกล้วันเกิด
import { formatDate, TIERS, type Tier } from "../lib/tiers";
import type { ClientLink, Expiry } from "../lib/types";
import { birthdayFrom, birthdayPointsOf } from "../lib/perks";
import Icon from "./Icon";
import TierMark from "./TierMark";

const YEAR_MS = 365 * 86400000;
const BIRTHDAY_NOTICE_DAYS = 14;

export default function AlertNotes({
  isInactive, isNearDrop, tier, baseTier, expiry, points, onViewExpiring, expiryUnavailable,
  totalEarned, lastPurchaseAt, justLinked, birthdayIn,
}: {
  points: number;
  totalEarned: number;
  isInactive: boolean;
  isNearDrop: boolean;
  tier: Tier;
  baseTier: Tier;
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
  const hasExpiring = !expiryUnavailable && !!expiry?.earliest_expiry && (expiry?.expiring_points ?? 0) > 0;
  const dropDate = lastPurchaseAt ? formatDate(new Date(new Date(lastPurchaseAt).getTime() + YEAR_MS).toISOString()) : null;
  const bdPts = birthdayPointsOf(tier.name);
  const bdFromTier = TIERS.find(t => t.name === birthdayFrom());
  const showBirthday = birthdayIn !== null && birthdayIn !== undefined && birthdayIn <= BIRTHDAY_NOTICE_DAYS;
  return (
    <>
      {justLinked && (
        <div className="lf-note lf-note--ok lf-note--welcome">
          <b><i><Icon name="check" size={20} /></i> ยืนยันตัวตนเรียบร้อยแล้วค่ะ</b>
          <span>
            {justLinked.customer_id && <><span className="lf-nw">รหัสลูกค้า <strong>{justLinked.customer_id}</strong></span> · </>}
            ต่อไปซื้อของ บอกเบอร์โทรที่แคชเชียร์ แต้มเข้าเองทุกบิล ปกติเห็นในหน้านี้ภายในวันที่ซื้อ
          </span>
        </div>
      )}
      {showBirthday && (
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
      )}
      {expiryUnavailable && (
        <div className="lf-note lf-note--info lf-note--compact">
          <span className="lf-note-small"><i><Icon name="hourglass" size={18} /></i> ตอนนี้ดูวันหมดอายุแต้มไม่ได้ ลองใหม่ภายหลัง</span>
        </div>
      )}
      {isInactive && (
        <div className="lf-note lf-note--info">
          <b><i><Icon name="alertCircle" size={20} /></i> ระดับลดชั่วคราว เพราะไม่ได้ซื้อเกิน 1 ปี</b>
          ยอดสะสม {totalEarned.toLocaleString()} แต้มยังอยู่ครบ ไม่ต้องสะสมใหม่ · ระหว่างนี้บัตรแสดงระดับตามแต้มที่ใช้ได้ ({points.toLocaleString()} แต้ม) จนกว่าจะกลับมาซื้อ
          {" "}<span className="lf-nw">(ระดับจริง <TierMark tier={baseTier} /> <strong>{baseTier.name}</strong>)</span>
        </div>
      )}
      {!isInactive && isNearDrop && (
        <div className="lf-note lf-note--warn">
          <b><i><Icon name="alert" size={20} /></i> รักษาระดับ {tier.name} ไว้</b>
          ซื้ออะไรก็ได้ 1 ครั้ง <strong className="lf-nw">ก่อน {dropDate}</strong> ระดับ <TierMark tier={tier} /> <strong>{tier.name}</strong> อยู่ต่ออีก 1 ปี · ถ้าเลยวันนั้น ระดับจะลดชั่วคราวจนกว่าจะกลับมาซื้อค่ะ
        </div>
      )}
      {/* ไม่มีแต้มใกล้หมดอายุ → บอกตรง ๆ ว่าปกติ (ไม่ใช่ที่ว่างที่ดูเหมือนจอโหลดพลาด) */}
      {!expiryUnavailable && !hasExpiring && points > 0 && (
        <div className="lf-note lf-note--ok">
          <b><i><Icon name="check" size={20} /></i> ยังไม่มีแต้มใกล้หมดอายุ</b>
        </div>
      )}
      {hasExpiring && (() => {
        const exp = expiry!.earliest_expiry!;
        const expDate = formatDate(exp);
        const daysLeft = Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000);
        // สีเหลืองอำพันเสมอ — เป็น "คำเตือน" ไม่ใช่ข้อผิดพลาด (ผู้ตรวจ r4: ชมพู/แดงดูเหมือนระบบพัง)
        return (
          <div className="lf-note lf-note--warn lf-note--compact">
            <div className="lf-note-row">
              <div>
                <b><i><Icon name="hourglass" size={20} /></i> {(expiry!.expiring_points ?? 0).toLocaleString()} แต้ม จะหมดอายุ</b>
                <span className="lf-note-when"><span className="lf-nw">วันที่ {expDate}</span>{daysLeft <= 90 ? <> <span className="lf-nw">(อีก {daysLeft} วัน)</span></> : ""}</span>
              </div>
              <button className="lf-link" onClick={onViewExpiring}>ดูรายการ <Icon name="chevron" size={18} /></button>
            </div>
          </div>
        );
      })()}
    </>
  );
}
