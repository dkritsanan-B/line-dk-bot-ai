"use client";
// ปุ่มลัด 3 ปุ่ม — ของรางวัล / ประวัติแต้ม / แก้ไขข้อมูล (JSX เดิมจาก page.tsx)
import { reviewQS } from "../review";

export default function QuickActions({
  txLoading, txOpen, onToggleHistory, onEdit,
}: {
  txLoading: boolean;
  txOpen: boolean;
  onToggleHistory: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="lf-actions" style={{ marginTop: 14 }}>
      <button className="lf-action lf-action--accent" onClick={() => (window.location.href = "/liff/rewards" + reviewQS())}>
        <i>🎁</i><b>ของรางวัล</b><span>แลกแต้ม</span>
      </button>
      <button className="lf-action" onClick={onToggleHistory}>
        <i>{txLoading ? "⏳" : "📋"}</i><b>{txOpen ? "ซ่อนประวัติ" : "ประวัติแต้ม"}</b><span>ได้รับ / ใช้ไป</span>
      </button>
      <button className="lf-action" onClick={onEdit}>
        <i>✏️</i><b>แก้ไขข้อมูล</b><span>ชื่อ / วันเกิด</span>
      </button>
    </div>
  );
}
