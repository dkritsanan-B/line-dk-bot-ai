// โหมดรีวิว — ให้ผู้ตรวจ (และ Playwright) เปิดทุกหน้าของระบบสมาชิกได้ โดยไม่ต้องล็อกอิน LINE และไม่แตะข้อมูลลูกค้าจริงแม้แต่แถวเดียว
//
// เปิดได้ก็ต่อเมื่อครบ 3 อย่าง:
//   1) ไม่ใช่ production (VERCEL_ENV !== "production")   ← กันหลุดขึ้นของจริงเด็ดขาด
//   2) ตั้ง REVIEW_SECRET ไว้ใน env
//   3) URL มี ?review=<ค่าเดียวกับ REVIEW_SECRET>&as=<ชื่อสถานการณ์>
//
// ข้อมูลทั้งหมดในไฟล์นี้เป็นของปลอมที่แต่งขึ้น ไม่มีการอ่าน/เขียนฐานข้อมูลจริง
// วันที่ทั้งหมดคิดจาก "ตอนนี้" เพื่อให้ความหมายของสถานการณ์คงที่ (เช่น "อีก 21 วันหมดอายุ" ยังเป็น 21 วันเสมอ)

export const REVIEW_ENABLED_NOTE = "โหมดรีวิว: ข้อมูลจำลอง ไม่ใช่ลูกค้าจริง";

export function isReviewEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return Boolean(process.env.REVIEW_SECRET && process.env.REVIEW_SECRET.length >= 8);
}

const day = 86400000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
const dateOnly = (offsetDays: number) => iso(offsetDays).slice(0, 10);

export interface ReviewMember {
  id: number;
  phone: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  birthday: string | null;
  points: number;
  total_earned: number;
  last_purchase_at: string | null;
  created_at: string;
  customer_id: string | null;
  suggested_customer_id: string | null;
}

export interface ReviewTx {
  id: number;
  purchase_amount: number;
  points_earned: number;
  type: string;
  note: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface ReviewScenario {
  key: string;
  label: string;
  registered: boolean;
  profile: { userId: string; displayName: string; pictureUrl: string };
  member: ReviewMember | null;
  expiry: { earliest_expiry: string | null; expiring_points: number | null } | null;
  transactions: ReviewTx[];
}

const profileOf = (name: string): ReviewScenario["profile"] => ({
  userId: "U_review_" + name.replace(/\s/g, ""),
  displayName: name,
  pictureUrl: "",
});

const member = (over: Partial<ReviewMember>): ReviewMember => ({
  id: 9001,
  phone: "0812345678",
  display_name: "ช่างสมชาย",
  first_name: "สมชาย",
  last_name: "ใจดี",
  company: null,
  birthday: dateOnly(-365 * 42),
  points: 0,
  total_earned: 0,
  last_purchase_at: iso(-2),
  created_at: iso(-120),
  customer_id: "CUS-00912",
  suggested_customer_id: null,
  ...over,
});

const earn = (id: number, baht: number, pts: number, daysAgo: number, note: string): ReviewTx => ({
  id,
  purchase_amount: baht,
  points_earned: pts,
  type: "earn",
  note,
  created_at: iso(-daysAgo),
  expires_at: iso(365 - daysAgo),
});

export const REVIEW_SCENARIOS: Record<string, ReviewScenario> = {
  // 1) ยังไม่สมัคร — จอแรกสุดที่ลูกค้าใหม่เห็นหลังสแกน QR
  new: {
    key: "new",
    label: "ลูกค้าใหม่ ยังไม่สมัคร",
    registered: false,
    profile: profileOf("ช่างวิชัย"),
    member: null,
    expiry: null,
    transactions: [],
  },

  // 2) สมัครแล้ว แต่พนักงานยังไม่ผูกรหัสลูกค้า Hero — แต้มยังไม่เข้า
  pending: {
    key: "pending",
    label: "สมัครแล้ว รอพนักงานผูกรหัส",
    registered: true,
    profile: profileOf("ช่างสมชาย"),
    member: member({ points: 0, total_earned: 0, last_purchase_at: null, created_at: iso(-0.02), customer_id: null, suggested_customer_id: "CUS-00912" }),
    expiry: null,
    transactions: [],
  },

  // 3) สมาชิกใหม่ที่เพิ่งได้แต้มก้อนแรก — เพิ่งขึ้น Bronze
  bronze120: {
    key: "bronze120",
    label: "Bronze 120 แต้ม เพิ่งได้แต้มแรก",
    registered: true,
    profile: profileOf("ช่างสมชาย"),
    member: member({ points: 120, total_earned: 120, company: "หจก. สมชายก่อสร้าง" }),
    expiry: { earliest_expiry: iso(363), expiring_points: 120 },
    transactions: [
      earn(5, 4200, 42, 2, "บิล IV-690231 · เหล็กกล่อง ท่อ PVC"),
      earn(4, 7800, 78, 9, "บิล IV-690118 · สีทาภายนอก 5 แกลลอน"),
    ],
  },

  // 4) ลูกค้าประจำระดับ Gold ที่มีแต้มใกล้หมดอายุ — เคสที่ต้องกระตุ้นให้กลับมา
  gold2300: {
    key: "gold2300",
    label: "Gold 2,300 แต้ม มีแต้มใกล้หมดอายุ",
    registered: true,
    profile: profileOf("ช่างสมชาย"),
    member: member({ points: 2300, total_earned: 2760, company: "หจก. สมชายก่อสร้าง" }),
    expiry: { earliest_expiry: iso(21), expiring_points: 400 },
    transactions: [
      earn(12, 18500, 185, 3, "บิล IV-690402 · เมทัลชีท 120 เมตร"),
      { id: 11, purchase_amount: 0, points_earned: 300, type: "redeem", note: "แลกส่วนลด 300 บาท", created_at: iso(-16), expires_at: null },
      earn(10, 32000, 320, 24, "บิล IV-690255 · เหล็กเส้น + ลวดผูก"),
      earn(9, 9600, 96, 40, "บิล IV-690180 · เครื่องมือช่าง"),
      { id: 8, purchase_amount: 0, points_earned: 160, type: "expire", note: "แต้มครบ 1 ปี", created_at: iso(-58), expires_at: null },
      earn(7, 40000, 400, 344, "บิล IV-689120 · เหล็กโครงหลังคา"),
    ],
  },

  // 5) ระดับสูงสุด — ต้องเห็นว่าจอไม่พังเมื่อไม่มีขั้นถัดไป
  diamond: {
    key: "diamond",
    label: "Diamond 12,400 แต้ม ระดับสูงสุด",
    registered: true,
    profile: profileOf("คุณประเสริฐ"),
    member: member({ id: 9002, phone: "0899887766", first_name: "ประเสริฐ", last_name: "รุ่งเรือง", company: "บจก. รุ่งเรืองการช่าง", points: 12400, total_earned: 14800, created_at: iso(-800) }),
    expiry: { earliest_expiry: iso(95), expiring_points: 1200 },
    transactions: [
      earn(30, 156000, 1560, 5, "บิล IV-690455 · เหล็กรูปพรรณ ล็อตใหญ่"),
      earn(29, 88000, 880, 21, "บิล IV-690333 · เมทัลชีท + อุปกรณ์"),
      { id: 28, purchase_amount: 0, points_earned: 1000, type: "redeem", note: "แลกบัตรเติมน้ำมัน 1,000 บาท", created_at: iso(-35), expires_at: null },
    ],
  },

  // 6) หายไปนาน ระดับลดชั่วคราว — ทดสอบกล่องเตือนสีแดง
  inactive: {
    key: "inactive",
    label: "หายไป 14 เดือน ระดับลดชั่วคราว",
    registered: true,
    profile: profileOf("ช่างมานพ"),
    member: member({ id: 9003, phone: "0867778888", first_name: "มานพ", last_name: "ทองดี", points: 260, total_earned: 2600, last_purchase_at: iso(-425), created_at: iso(-900) }),
    expiry: null,
    transactions: [earn(20, 26000, 260, 425, "บิล IV-688010 · วัสดุก่อสร้าง")],
  },

  // 7) วันเกิดวันนี้ — ทดสอบชิปวันเกิดและโบนัส
  birthday: {
    key: "birthday",
    label: "วันเกิดวันนี้ ได้แต้มโบนัส",
    registered: true,
    profile: profileOf("ช่างสมชาย"),
    member: member({ points: 820, total_earned: 820, birthday: dateOnly(-365 * 45) }),
    expiry: { earliest_expiry: iso(200), expiring_points: 500 },
    transactions: [
      { id: 40, purchase_amount: 0, points_earned: 200, type: "earn", note: "ของขวัญวันเกิด 2569", created_at: iso(-0.1), expires_at: iso(365) },
      earn(39, 62000, 620, 30, "บิล IV-690090 · เหล็ก + ปูน"),
    ],
  },
};

export const REVIEW_SCENARIO_KEYS = Object.keys(REVIEW_SCENARIOS);

// ของรางวัลจำลอง — ให้หน้า /liff/rewards มีของให้ดูแม้ไม่ได้ต่อฐานข้อมูลจริง
export const REVIEW_REWARDS = [
  { id: 101, name: "ส่วนลดเงินสด 100 บาท", description: "ใช้กับบิลถัดไป ไม่มีขั้นต่ำ", points_required: 100, image_url: null, stock: 999 },
  { id: 102, name: "ส่วนลดเงินสด 500 บาท", description: "ใช้กับบิลตั้งแต่ 3,000 บาทขึ้นไป", points_required: 450, image_url: null, stock: 120 },
  { id: 103, name: "ถุงมือช่างหนังแท้", description: "ไซซ์ L ทนคม ใช้งานหนัก", points_required: 300, image_url: null, stock: 24 },
  { id: 104, name: "ตลับเมตร 5 เมตร", description: "แบรนด์ร้าน ล็อกแน่น", points_required: 250, image_url: null, stock: 0 },
  { id: 105, name: "บัตรเติมน้ำมัน 1,000 บาท", description: "รับที่ร้าน แสดงบัตรสมาชิก", points_required: 1000, image_url: null, stock: 8 },
];

/** อ่านสถานการณ์จาก query string — คืน null ถ้าโหมดปิดอยู่ หรือรหัสไม่ตรง หรือไม่รู้จักสถานการณ์นั้น */
export function reviewScenarioFrom(url: URL | { searchParams: URLSearchParams }): ReviewScenario | null {
  if (!isReviewEnabled()) return null;
  const sp = "searchParams" in url ? url.searchParams : new URL(String(url)).searchParams;
  const secret = sp.get("review") ?? "";
  if (!secret || secret !== process.env.REVIEW_SECRET) return null;
  const key = sp.get("as") ?? "bronze120";
  return REVIEW_SCENARIOS[key] ?? null;
}
