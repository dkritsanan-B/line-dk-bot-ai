"use client";
// กล่องเตือน — ระดับลดชั่วคราว / ใกล้ลด / แต้มใกล้หมดอายุ
// ขอบเขตกล่องมาจากแถบข้างซ้ายสีเต็ม (liff.css .lf-note) ซึ่งผ่าน 3:1 กับพื้นกล่อง
import { formatDate, type Tier } from "../lib/tiers";
import type { Expiry } from "../lib/types";
import Icon from "./Icon";
import TierMark from "./TierMark";

export default function AlertNotes({
  isInactive, isNearDrop, tier, baseTier, months, expiry, points, onViewExpiring,
}: {
  points: number;
  isInactive: boolean;
  isNearDrop: boolean;
  tier: Tier;
  baseTier: Tier;
  months: number | null;
  expiry: Expiry | null;
  onViewExpiring: () => void;
}) {
  const hasExpiring = !!expiry?.earliest_expiry && (expiry?.expiring_points ?? 0) > 0;
  return (
    <>
      {isInactive && (
        <div className="lf-note lf-note--danger">
          <b><i><Icon name="alertCircle" size={20} /></i> ระดับลดชั่วคราว</b>
          ระดับจริงของคุณคือ <TierMark tier={baseTier} /> <strong>{baseTier.name}</strong> — กลับมาซื้อสินค้าครั้งเดียว ระดับกลับมาทันที ไม่ต้องสะสมใหม่ค่ะ
        </div>
      )}
      {!isInactive && isNearDrop && (
        <div className="lf-note lf-note--warn">
          <b><i><Icon name="alert" size={20} /></i> ระดับใกล้ลด</b>
          ไม่ได้ซื้อสินค้ามา {months} เดือน อีก {12 - (months ?? 0)} เดือน ระดับ <TierMark tier={tier} /> <strong>{tier.name}</strong> จะลดลง — แวะมาซื้อเพื่อรักษาระดับนะคะ
        </div>
      )}
      {/* ไม่มีแต้มใกล้หมดอายุ → บอกตรง ๆ ว่าปกติ (ไม่ใช่ที่ว่างที่ดูเหมือนจอโหลดพลาด) */}
      {!hasExpiring && points > 0 && (
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
