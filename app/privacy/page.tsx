// หน้านโยบายความเป็นส่วนตัว (PDPA · 18 ก.ย. 69) — หน้าสาธารณะ ไม่ต้องล็อกอิน
// เนื้อหาอยู่ที่ PolicyContent.tsx (ใช้ร่วมกับกล่องอ่านนโยบายในฟอร์มสมัคร)
import type { Metadata } from "next";
import { Shell } from "../liff/ui";
import PolicyContent from "./PolicyContent";
import "./privacy.css";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว — DK STEEL AND TOOLS",
  description: "นโยบายความเป็นส่วนตัวของระบบสมาชิกสะสมแต้ม DK STEEL AND TOOLS ผ่าน LINE",
};

export default function PrivacyPage() {
  return (
    <Shell sub="นโยบายความเป็นส่วนตัว" layout="form">
      <div className="lf-card pv-card">
        <PolicyContent />
      </div>
    </Shell>
  );
}
