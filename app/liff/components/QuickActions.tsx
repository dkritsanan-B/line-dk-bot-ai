"use client";
// ปุ่มลัด 3 ปุ่ม — ของรางวัล / ประวัติแต้ม / แก้ไขข้อมูล
// ใช้ไอคอนชุดเดียว (Icon.tsx) เพราะอีโมจิหน้าตาต่างกันไปตามเครื่อง/เวอร์ชัน Android
//
// P: ทั้ง 3 ปุ่มหน้าตาเดียวกัน (กรอบเดียวกัน ไม่มีลูกศร) — "ของรางวัล" ต่างแค่สีไอคอน (ส้มเข้ม)
//    ปุ่มที่เปิดอยู่ (ประวัติแต้ม) = กรอบเดิม + พื้นฟ้าอ่อน + ขอบน้ำเงิน + ขีดล่างหนา (ภาษาเดียวกับแท็บ) · styles/card.css
// c4 (ผู้ตรวจนักออกแบบ): locked = สมัครแล้วแต่ยังไม่ยืนยันที่ร้าน (ยังไม่มีแต้ม)
//    "ของรางวัล" กับ "ประวัติแต้ม" ดูปิดอยู่ กดแล้วไม่ไปไหน + ป้าย "หลังยืนยัน" · "แก้ไขข้อมูล" ยังกดได้ตามปกติ
//    ใช้ aria-disabled (ไม่ใช้ disabled) เพื่อให้โฟกัส/โปรแกรมอ่านจอยังอ่านป้ายได้ · สไตล์ styles/actions.css
import { reviewQS } from "../review";
import Icon from "./Icon";
import "../styles/actions.css";

/** ป้ายเล็กบนปุ่มที่ยังใช้ไม่ได้ */
function LockTag({ children = "หลังยืนยัน", wide }: { children?: React.ReactNode; wide?: boolean }) {
  // wide = ข้อความยาวที่อาจขึ้น 2 บรรทัด → ไม่ใช้เม็ดยา (มุมมนเต็มแล้วดูเบี้ยว) ใช้ข้อความรองเฉย ๆ
  return <em className={`lf-ac-tag${wide ? " lf-ac-tag--text" : ""}`}>{children}</em>;
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
  const lockCls = locked ? " lf-ac-locked" : "";
  return (
    <div className={`lf-actions${locked ? " lf-actions--locked" : ""}`}>
      <button
        type="button"
        className="lf-action lf-cd-act lf-cd-act--reward"
        onClick={() => (window.location.href = "/liff/rewards" + reviewQS())}
      >
        <i><Icon name="gift" size={28} /></i><b>ของรางวัล</b>
        {locked && <LockTag wide><span className="lf-nw">ดูได้</span> <span className="lf-nw">แลกหลังยืนยัน</span></LockTag>}
      </button>
      <button
        type="button"
        className={`lf-action lf-cd-act${!locked && txOpen ? " lf-cd-act--on" : ""}${lockCls}`}
        aria-disabled={locked || undefined}
        onClick={locked ? undefined : onToggleHistory}
        aria-expanded={locked ? undefined : txOpen}
        aria-pressed={locked ? undefined : txOpen}
      >
        <i><Icon name={!locked && txLoading ? "hourglass" : "history"} size={28} /></i>
        <b>ประวัติแต้ม</b>
        {locked && <LockTag />}
      </button>
      <button type="button" className="lf-action lf-cd-act" onClick={onEdit}>
        <i><Icon name="edit" size={28} /></i><b>แก้ไขข้อมูล</b>
      </button>
    </div>
  );
}
