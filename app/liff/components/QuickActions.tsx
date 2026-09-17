"use client";
// ปุ่มลัด 3 ปุ่ม — ของรางวัล / ประวัติแต้ม / แก้ไขข้อมูล
// ใช้ไอคอนชุดเดียว (Icon.tsx) เพราะอีโมจิหน้าตาต่างกันไปตามเครื่อง/เวอร์ชัน Android
//
// P: ทั้ง 3 ปุ่มหน้าตาเดียวกัน (กรอบเดียวกัน ไม่มีลูกศร) — "ของรางวัล" ต่างแค่สีไอคอน (ส้มเข้ม)
//    ปุ่มที่เปิดอยู่ (ประวัติแต้ม) = กรอบเดิม + พื้นฟ้าอ่อน + ขอบน้ำเงิน + ขีดล่างหนา (ภาษาเดียวกับแท็บ) · styles/card.css
// c4 (ผู้ตรวจนักออกแบบ): locked = สมัครแล้วแต่ยังไม่ยืนยันที่ร้าน (ยังไม่มีแต้ม)
//    ใช้ aria-disabled (ไม่ใช้ disabled) เพื่อให้โฟกัส/โปรแกรมอ่านจอยังอ่านป้ายได้ · สไตล์ styles/actions.css
// r6 (ผู้ตรวจ): ตอนรอยืนยัน ทั้ง 3 ปุ่มมีโครงเดียวกัน (ชื่อ + บรรทัดรอง) ความสูงเท่ากัน
//    ปุ่มที่ยังใช้ไม่ได้ = พื้นเทาอ่อน ตัวเทา + ไอคอนกุญแจเล็กในบรรทัดรอง · "แก้ไขข้อมูล" ยังกดได้ ใช้สีปกติ
//    "ของรางวัล" ยังเปิดดูรายการได้ (แลกไม่ได้จนกว่าจะยืนยัน) จึงเป็นลิงก์ปกติแต่หน้าตาล็อก
import { reviewQS } from "../review";
import Icon, { type IconName } from "./Icon";
import "../styles/actions.css";

function Tile({ icon, label, sub, lockedSub, className = "", ...rest }: {
  icon: IconName;
  label: string;
  /** บรรทัดรองตอนรอยืนยัน (ไม่มีค่า = ไม่มีบรรทัดรอง) */
  sub?: string | null;
  /** true = บรรทัดรองมีไอคอนกุญแจ */
  lockedSub?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`lf-action lf-cd-act ${className}`.trim()} {...rest}>
      <i><Icon name={icon} size={28} /></i>
      <span className="lf-ac-txt">
        <b>{label}</b>
        {sub && (
          <em className="lf-ac-tag lf-ac-tag--text">
            {lockedSub && <Icon name="lock" size={14} strokeWidth={2.25} />}{sub}
          </em>
        )}
      </span>
    </button>
  );
}

export default function QuickActions({
  txLoading, txOpen, onToggleHistory, onEdit, locked,
}: {
  txLoading: boolean;
  txOpen: boolean;
  onToggleHistory: () => void;
  onEdit: () => void;
  /** true = สมัครแล้วแต่ยังไม่ยืนยันตัวตนที่ร้าน → ของรางวัล/ประวัติแต้ม ยังใช้ไม่ได้ */
  locked?: boolean;
}) {
  return (
    <div className={`lf-actions${locked ? " lf-actions--locked" : ""}`}>
      <Tile
        icon="gift" label="ของรางวัล"
        className={`lf-cd-act--reward${locked ? " lf-ac-locked lf-ac-locked--browse" : ""}`}
        sub={locked ? "แลกหลังยืนยัน" : null} lockedSub
        onClick={() => (window.location.href = "/liff/rewards" + reviewQS())}
      />
      <Tile
        icon={!locked && txLoading ? "hourglass" : "history"} label="ประวัติแต้ม"
        className={`${!locked && txOpen ? "lf-cd-act--on" : ""}${locked ? " lf-ac-locked" : ""}`}
        sub={locked ? "ดูหลังยืนยัน" : null} lockedSub
        aria-disabled={locked || undefined}
        onClick={locked ? undefined : onToggleHistory}
        aria-expanded={locked ? undefined : txOpen}
        aria-pressed={locked ? undefined : txOpen}
      />
      <Tile
        icon="edit" label="แก้ไขข้อมูล"
        sub={locked ? "แก้ได้เลย" : null}
        onClick={onEdit}
      />
    </div>
  );
}
