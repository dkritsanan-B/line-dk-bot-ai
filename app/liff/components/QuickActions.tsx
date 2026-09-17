"use client";
// ปุ่มลัด 3 ปุ่ม — ของรางวัล / ประวัติแต้ม / แก้ไขข้อมูล
// ใช้ไอคอนชุดเดียว (Icon.tsx) เพราะอีโมจิหน้าตาต่างกันไปตามเครื่อง/เวอร์ชัน Android
//
// P: ทั้ง 3 ปุ่มหน้าตาเดียวกัน (กรอบเดียวกัน ไม่มีลูกศร) — "ของรางวัล" ต่างแค่สีไอคอน (ส้มเข้ม)
//    ปุ่มที่เปิดอยู่ (ประวัติแต้ม) = กรอบเดิม + พื้นฟ้าอ่อน + ขอบน้ำเงิน + ขีดล่างหนา (ภาษาเดียวกับแท็บ) · styles/card.css
import { reviewQS } from "../review";
import Icon from "./Icon";

export default function QuickActions({
  txLoading, txOpen, onToggleHistory, onEdit,
}: {
  txLoading: boolean;
  txOpen: boolean;
  onToggleHistory: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="lf-actions">
      <button className="lf-action lf-cd-act lf-cd-act--reward" onClick={() => (window.location.href = "/liff/rewards" + reviewQS())}>
        <i><Icon name="gift" size={28} /></i><b>ของรางวัล</b>
      </button>
      <button className={`lf-action lf-cd-act${txOpen ? " lf-cd-act--on" : ""}`} onClick={onToggleHistory} aria-expanded={txOpen} aria-pressed={txOpen}>
        <i><Icon name={txLoading ? "hourglass" : "history"} size={28} /></i>
        <b>ประวัติแต้ม</b>
      </button>
      <button className="lf-action lf-cd-act" onClick={onEdit}>
        <i><Icon name="edit" size={28} /></i><b>แก้ไขข้อมูล</b>
      </button>
    </div>
  );
}
