"use client";
// กล่องเตือน — ระดับลดชั่วคราว / ใกล้ลด / แต้มใกล้หมดอายุ (JSX เดิมจาก page.tsx)
import { formatDate, type Tier } from "../lib/tiers";
import type { Expiry } from "../lib/types";

export default function AlertNotes({
  isInactive, isNearDrop, tier, baseTier, months, expiry, onViewExpiring,
}: {
  isInactive: boolean;
  isNearDrop: boolean;
  tier: Tier;
  baseTier: Tier;
  months: number | null;
  expiry: Expiry | null;
  onViewExpiring: () => void;
}) {
  return (
    <>
      {isInactive && (
        <div className="lf-note lf-note--danger">
          <b>🔴 ระดับลดชั่วคราว</b>
          ระดับจริงของคุณคือ {baseTier.emoji} <strong>{baseTier.name}</strong> — กลับมาซื้อสินค้าครั้งเดียว ระดับกลับมาทันที ไม่ต้องสะสมใหม่ค่ะ
        </div>
      )}
      {!isInactive && isNearDrop && (
        <div className="lf-note lf-note--warn">
          <b>⚠️ ระดับใกล้ลด</b>
          ไม่ได้ซื้อสินค้ามา {months} เดือน อีก {12 - (months ?? 0)} เดือน ระดับ {tier.emoji} <strong>{tier.name}</strong> จะลดลง — แวะมาซื้อเพื่อรักษาระดับนะคะ 🛒
        </div>
      )}
      {expiry?.earliest_expiry && (expiry.expiring_points ?? 0) > 0 && (() => {
        const expDate = formatDate(expiry.earliest_expiry);
        const daysLeft = Math.ceil((new Date(expiry.earliest_expiry).getTime() - Date.now()) / 86400000);
        const urgent = daysLeft <= 30;
        return (
          <div className={`lf-note ${urgent ? "lf-note--danger" : "lf-note--warn"}`}>
            <div className="lf-note-row">
              <div>
                <b>{(expiry.expiring_points ?? 0).toLocaleString()} แต้ม จะหมดอายุ</b>
                {expDate}{daysLeft <= 90 ? ` (อีก ${daysLeft} วัน)` : ""}
              </div>
              <button className="lf-link" onClick={onViewExpiring}>ดูรายการ ›</button>
            </div>
          </div>
        );
      })()}
    </>
  );
}
