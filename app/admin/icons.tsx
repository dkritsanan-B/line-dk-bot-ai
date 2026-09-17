// ชุดไอคอนเส้นของหน้าแอดมิน (SVG ในไฟล์ ไม่พึ่งไลบรารีภายนอก) — ใช้สีจาก currentColor · ค่าเริ่มต้นเป็นน้ำเงินแบรนด์ผ่าน CSS (.ad-ic)
// filled = สถานะเลือกอยู่ (แท็บล่างบนมือถือ) ระบายพื้นจางใต้เส้นเดิม

const PATHS = {
  overview: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5z" /><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4" /><path d="M18.2 14.8c1.8.7 3 2.4 3.3 5.2" /></>,
  gift: <><rect x="3" y="8" width="18" height="4.5" rx="1" /><path d="M5 12.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5" /><path d="M12 8v13" /><path d="M12 8C10.5 4 7 3.5 6.5 5.5S9 8 12 8z" /><path d="M12 8c1.5-4 5-4.5 5.5-2.5S15 8 12 8z" /></>,
  star: <path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" />,
  history: <><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3 3.5V8h4.5" /><path d="M12 7.5V12l3 2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 10h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1z" /></>,
  tasks: <><rect x="4" y="3.5" width="16" height="18" rx="2" /><path d="M9 3.5V2.5h6v1" /><path d="M8 10l1.5 1.5L12 9" /><path d="M14 10.5h3" /><path d="M8 16l1.5 1.5L12 15" /><path d="M14 16.5h3" /></>,
  award: <><circle cx="12" cy="9" r="6" /><path d="M8.5 13.9L7 22l5-3 5 3-1.5-8.1" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3.1-3.1a4 4 0 0 0-5.7-5.7L11.5 6.8" /><path d="M14 10a4 4 0 0 0-5.7 0l-3.1 3.1a4 4 0 0 0 5.7 5.7l1.6-1.6" /></>,
  download: <><path d="M12 3.5v11" /><path d="M7.5 10l4.5 4.5 4.5-4.5" /><path d="M4 20.5h16" /></>,
  upload: <><path d="M12 15V4" /><path d="M7.5 8.5L12 4l4.5 4.5" /><path d="M4 20.5h16" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16.5L5.5 12 10 7.5" /><path d="M5.5 12H15" /></>,
  more: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
  refresh: <><path d="M20 11.5A8 8 0 0 0 5.6 7" /><path d="M5 3.5V7.5h4" /><path d="M4 12.5A8 8 0 0 0 18.4 17" /><path d="M19 20.5v-4h-4" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  undo: <><path d="M9 14.5L4 9.5l5-5" /><path d="M4 9.5h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  file: <><path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z" /><path d="M14 2.5V8h5.5" /><path d="M8.5 13h7" /><path d="M8.5 17h5" /></>,
  folder: <path d="M3 6.5a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20.5 20.5L16 16" /></>,
  trash: <><path d="M3.5 6.5h17" /><path d="M9 6.5V4h6v2.5" /><path d="M6 6.5l1 13.5a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4l1-13.5" /><path d="M10 11v6" /><path d="M14 11v6" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><path d="M12 7.6v.1" /></>,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12.3l2.8 2.8L16.3 9.5" /></>,
  x: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
  alert: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5" /><path d="M12 17.3v.1" /></>,
  compare: <><path d="M4 8h15" /><path d="M15.5 4.5L19 8l-3.5 3.5" /><path d="M20 16H5" /><path d="M8.5 12.5L5 16l3.5 3.5" /></>,
  shield: <><path d="M12 2.8l7.5 3v5.7c0 4.6-3.1 8.2-7.5 9.7-4.4-1.5-7.5-5.1-7.5-9.7V5.8z" /><path d="M9 12l2.2 2.2L15.5 10" /></>,
  inbox: <><path d="M3 13.5l2.6-8a1.5 1.5 0 0 1 1.4-1h10a1.5 1.5 0 0 1 1.4 1l2.6 8" /><path d="M3 13.5V19a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 19v-5.5h-5.5a3.5 3.5 0 0 1-7 0z" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, filled = false, className }: { name: IconName; size?: number; filled?: boolean; className?: string }) {
  return (
    <svg
      className={`ad-ic${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      fillOpacity={filled ? 0.16 : undefined}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
