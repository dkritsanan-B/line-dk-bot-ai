"use client";
// ชุดไอคอนเดียวของหน้าสมาชิก — เส้น 2px บนตาราง 24px ใช้สีตามตัวอักษร (currentColor)
// เหตุผล: ของเดิมปนอีโมจิหลายสไตล์ (🎁 📋 ✏️ ⭐ ⏳) ซึ่งหน้าตาต่างกันไปตามเครื่อง/เวอร์ชัน Android
// อีโมจิที่ยังใช้อยู่คือ "ตราประจำระดับ" (🥉🥈🥇🔱💎👋) เท่านั้น เพราะเป็นสัญลักษณ์ของระดับ ไม่ใช่ไอคอนใช้งาน

export type IconName =
  | "gift" | "history" | "edit" | "star" | "tag" | "cake" | "hourglass"
  | "alert" | "alertCircle" | "chevron" | "phone" | "building" | "trophy" | "check" | "user" | "refresh"
  | "ticket" | "fuel" | "ruler" | "glove";

const PATHS: Record<IconName, React.ReactNode> = {
  gift: <><path d="M3 12h18v9H3z" /><path d="M2 8h20v4H2z" /><path d="M12 8v13" /><path d="M12 8S10.5 3.5 8 3.5 4.5 8 8 8h4zM12 8s1.5-4.5 4-4.5S19.5 8 16 8h-4z" /></>,
  history: <><path d="M4 5h16M4 12h16M4 19h10" /><circle cx="19" cy="19" r="2.5" /></>,
  edit: <><path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5V20z" /><path d="M14.5 6.5 17.5 9.5" /></>,
  star: <path d="m12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.2-5.4-2.9-5.4 2.9 1-6.2L3.2 10l6.1-.9z" />,
  tag: <><path d="M12.6 3H21v8.4L11.4 21 3 12.6z" /><circle cx="17" cy="7" r="1.6" /></>,
  cake: <><path d="M4 21h16v-7H4z" /><path d="M4 14c0-1.7 1.3-3 3-3h10c1.7 0 3 1.3 3 3" /><path d="M12 8V5M8 8V6M16 8V6" /></>,
  hourglass: <><path d="M7 3h10M7 21h10" /><path d="M7 3c0 5 5 6.5 5 9s-5 4-5 9M17 3c0 5-5 6.5-5 9s5 4 5 9" /></>,
  alert: <><path d="M12 3.5 22 20H2z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.2" r=".6" fill="currentColor" /></>,
  alertCircle: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V13" /><circle cx="12" cy="16.4" r=".7" fill="currentColor" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2C11.4 19.7 4.3 12.6 3.5 5.7A2 2 0 0 1 5.5 3.5z" />,
  building: <><path d="M4 21V5.5L13 3v18" /><path d="M13 9h7v12" /><path d="M7.5 8h2M7.5 12h2M7.5 16h2M16 13h1.5M16 17h1.5" /></>,
  trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 5.5H4.5V7A3.5 3.5 0 0 0 8 10.5M17 5.5h2.5V7a3.5 3.5 0 0 1-3.5 3.5" /><path d="M12 14v3M8.5 20.5h7" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  // รูปแทนคนที่ยังไม่มีรูปโปรไฟล์ LINE
  // ลองใหม่ (จอแจ้งปัญหา)
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4.5h-4.5" /></>,
  user: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  // รูปของรางวัล (ผู้ตรวจ c1: ของรางวัลที่ไม่มีรูปเป็นกล่องของขวัญเหมือนกันหมด)
  ticket: <><path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" /><path d="M9.5 14.5l5-5" /><circle cx="9.8" cy="9.8" r=".6" fill="currentColor" /><circle cx="14.2" cy="14.2" r=".6" fill="currentColor" /></>,
  fuel: <><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" /><path d="M3 21h12" /><path d="M6.5 7h5v4h-5z" /><path d="M14 10h2a2 2 0 0 1 2 2v4.5a1.5 1.5 0 0 0 3 0V8l-3-3" /></>,
  ruler: <><path d="M3 8h18v8H3z" /><path d="M7 8v3M11 8v4M15 8v3M19 8v4" /></>,
  glove: <><path d="M7 21v-4.5L4.5 13a1.8 1.8 0 0 1 2.9-2.1L9 12.5V5a1.5 1.5 0 0 1 3 0v5.5V4a1.5 1.5 0 0 1 3 0v6.5V5.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-2 4.5V21" /></>,
};

export default function Icon({ name, size = 24, strokeWidth = 2, className }: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
