"use client";
// ปุ่มลัด 3 ปุ่ม — ของรางวัล / ประวัติแต้ม / แก้ไขข้อมูล
// ใช้ไอคอนชุดเดียว (Icon.tsx) เพราะอีโมจิหน้าตาต่างกันไปตามเครื่อง/เวอร์ชัน Android
//
// ภาษาภาพ 2 สถานะ ห้ามปนกัน (ผู้ตรวจ r5: ปุ่มส้มถมทึบดูเหมือน "หน้าที่เลือกอยู่" ตลอด)
//   ปุ่มชวนกด (ของรางวัล — ไปหน้าอื่น) = พื้นขาว ขอบส้มเข้ม ไอคอนส้ม + ลูกศร ›
//   ปุ่มที่เปิดอยู่ (ประวัติแต้ม)        = ถมน้ำเงินทึบ ตัวขาว เหมือนแท็บ "ทั้งหมด"
//   ปุ่มปกติ                           = พื้นขาว ขอบเทาเข้ม (ต้องเห็นว่ากดได้ ไม่ใช่การ์ดข้อมูล)
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
      <button className="lf-action lf-action--go" onClick={() => (window.location.href = "/liff/rewards" + reviewQS())}>
        <i><Icon name="gift" size={28} /></i><b>ของรางวัล <Icon name="chevron" size={16} /></b>
      </button>
      <button className={`lf-action${txOpen ? " on" : ""}`} onClick={onToggleHistory} aria-expanded={txOpen} aria-pressed={txOpen}>
        <i><Icon name={txLoading ? "hourglass" : "history"} size={28} /></i>
        <b>ประวัติแต้ม</b>
      </button>
      <button className="lf-action" onClick={onEdit}>
        <i><Icon name="edit" size={28} /></i><b>แก้ไขข้อมูล</b>
      </button>
    </div>
  );
}
