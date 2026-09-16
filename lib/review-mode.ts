// โหมดรีวิว — ให้ผู้ตรวจ (และ Playwright) เปิดทุกหน้าของระบบสมาชิกได้ โดยไม่ต้องล็อกอิน LINE และไม่แตะข้อมูลลูกค้าจริงแม้แต่แถวเดียว
//
// เปิดได้ก็ต่อเมื่อครบ 3 อย่าง:
//   1) ไม่ใช่ production (VERCEL_ENV !== "production")   ← กันหลุดขึ้นของจริงเด็ดขาด
//   2) ตั้ง REVIEW_SECRET ไว้ใน env
//   3) URL มี ?review=<ค่าเดียวกับ REVIEW_SECRET>&as=<ชื่อสถานการณ์>
//
// ข้อมูลทั้งหมดในไฟล์นี้เป็นของปลอมที่แต่งขึ้น ไม่มีการอ่าน/เขียนฐานข้อมูลจริง
// วันที่ทั้งหมดคิดจาก "ตอนนี้" เพื่อให้ความหมายของสถานการณ์คงที่ (เช่น "อีก 21 วันหมดอายุ" ยังเป็น 21 วันเสมอ)

import { summarizeExpiring, type ExpirySummary, type PendingBillSummary } from "./points";

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

/**
 * อาการล่มจำลอง — ให้ทีมหน้าเว็บทดสอบ "จอแจ้งเตือน" ได้จริงโดยไม่ต้องรอระบบล่มจริง
 *   auth   = token หมดอายุ (401)            line = ติดต่อ LINE ไม่ได้ (503)
 *   db     = ต่อฐานข้อมูลไม่ได้ (503)        server = พังอย่างอื่น (500)
 *   expiry = ตัวสมาชิกอ่านได้ แต่ยอดแต้มใกล้หมดอายุอ่านไม่ได้ (บัตรขึ้นปกติ + ธง expiryUnavailable)
 */
export type ReviewFault = "auth" | "line" | "db" | "server" | "expiry";

/** คำขอแลกของรางวัลที่ยังรอรับของ — แต้มก้อนนี้ถูกจองไว้แล้ว เอาไปแลกชิ้นอื่นซ้ำไม่ได้ */
export interface ReviewPendingRedemption {
  reward_id: number;
  points_required: number;
}

export interface ReviewScenario {
  key: string;
  label: string;
  registered: boolean;
  profile: { userId: string; displayName: string; pictureUrl: string };
  member: ReviewMember | null;
  expiry: ExpirySummary;
  transactions: ReviewTx[];
  /** ปกติไม่ใส่ = ทุกอย่างทำงานดี · ใส่เมื่ออยากให้ API ตอบแบบระบบมีปัญหา */
  fault?: ReviewFault;
  /** คำขอแลกที่ยังค้าง = แต้มถูกจองไว้แล้ว (กติกาเดียวกับของจริง ดู app/api/liff/redeem/logic.ts) */
  pendingRedemptions?: ReviewPendingRedemption[];
  /** บิลที่ระบบเห็นแล้วแต่ยังให้แต้มไม่ได้ (มีได้เฉพาะสถานการณ์ที่ยังไม่ผูกรหัส) — /api/member เอาไปคิดเป็น link.pending_bills */
  pendingBills?: PendingBillSummary | null;
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

// ข้อมูลดิบของแต่ละสถานการณ์ — ไม่มีช่อง expiry เพราะคำนวณจาก transactions ด้วยกติกาเดียวกับของจริง (ดูท้ายไฟล์)
const SCENARIO_DATA: Record<string, Omit<ReviewScenario, "expiry">> = {
  // 1) ยังไม่สมัคร — จอแรกสุดที่ลูกค้าใหม่เห็นหลังสแกน QR
  new: {
    key: "new",
    label: "ลูกค้าใหม่ ยังไม่สมัคร",
    registered: false,
    profile: profileOf("ช่างวิชัย"),
    member: null,
    transactions: [],
  },

  // 2) สมัครแล้ว แต่พนักงานยังไม่ผูกรหัสลูกค้า Hero — แต้มยังไม่เข้า
  pending: {
    key: "pending",
    label: "สมัครแล้ว รอพนักงานผูกรหัส",
    registered: true,
    profile: profileOf("ช่างสมชาย"),
    member: member({ points: 0, total_earned: 0, last_purchase_at: null, created_at: iso(-0.02), customer_id: null, suggested_customer_id: "CUS-00912" }),
    transactions: [],
  },

  // 2.1) สมัครแล้ว 6 วัน ไม่มีแม้แต่รหัสที่ระบบเดาไว้ (เบอร์ไม่ตรงลูกค้า Hero คนไหน) — ซื้อของไปแล้วก็ยังไม่ได้แต้ม
  //      นี่คือเคสที่เงียบที่สุดและเป็นต้นเรื่องของงานนี้ · overdue = true (ค้างเกิน LINK_OVERDUE_DAYS)
  unlinked: {
    key: "unlinked",
    label: "สมัคร 6 วันแล้ว ยังไม่ผูกรหัส แต้มไม่เข้า",
    registered: true,
    profile: profileOf("ช่างสมชาย"),
    member: member({ points: 0, total_earned: 0, last_purchase_at: null, created_at: iso(-6), customer_id: null, suggested_customer_id: null }),
    transactions: [],
  },

  // 2.2) รอพนักงานกดยืนยันรหัสที่ระบบเดาไว้ และ "มีบิลค้าง" ที่ระบบเห็นแล้วแต่ให้แต้มไม่ได้
  //      ตัวเลขบิลค้างมาจากตาราง hero_pending_bills ของจริง (ที่นี่จำลองไว้ให้หน้าเว็บทำจอได้)
  //      ย้ำ: เป็นตัวเลขไว้บอกเท่านั้น ไม่ใช่คิวจ่ายแต้มย้อนหลัง
  waitingBills: {
    key: "waitingBills",
    label: "รอผูกรหัส มีบิลค้าง 3 ใบ ยังไม่ได้แต้ม",
    registered: true,
    profile: profileOf("ช่างสมชาย"),
    member: member({ points: 0, total_earned: 0, last_purchase_at: null, created_at: iso(-5), customer_id: null, suggested_customer_id: "CUS-00912" }),
    transactions: [],
    pendingBills: { count: 3, amount: 12450, estimated_points: 124, first_bill_date: dateOnly(-5), last_bill_date: dateOnly(-1) },
  },

  // 2.3) พนักงานเพิ่งกดผูกรหัสให้ ยังไม่มีบิลใหม่เข้ามา — ต้องไม่ขึ้นคำเตือนใด ๆ อีก
  linkedNew: {
    key: "linkedNew",
    label: "ผูกรหัสแล้ว รอบิลแรก",
    registered: true,
    profile: profileOf("ช่างสมชาย"),
    member: member({ points: 0, total_earned: 0, last_purchase_at: null, created_at: iso(-2), customer_id: "CUS-00912", suggested_customer_id: null }),
    transactions: [],
  },

  // 3) สมาชิกใหม่ที่เพิ่งได้แต้มก้อนแรก — เพิ่งขึ้น Bronze
  bronze120: {
    key: "bronze120",
    label: "Bronze 120 แต้ม เพิ่งได้แต้มแรก",
    registered: true,
    profile: profileOf("ช่างสมชาย"),
    member: member({ points: 120, total_earned: 120, company: "หจก. สมชายก่อสร้าง" }),
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
    transactions: [
      earn(12, 18500, 185, 3, "บิล IV-690402 · เมทัลชีท 120 เมตร"),
      { id: 11, purchase_amount: 0, points_earned: 300, type: "redeem", note: "แลกส่วนลด 300 บาท", created_at: iso(-16), expires_at: null },
      earn(10, 32000, 320, 24, "บิล IV-690255 · เหล็กเส้น + ลวดผูก"),
      earn(9, 9600, 96, 40, "บิล IV-690180 · เครื่องมือช่าง"),
      { id: 8, purchase_amount: 0, points_earned: 160, type: "expire", note: "แต้มครบ 1 ปี", created_at: iso(-58), expires_at: null },
      earn(7, 40000, 400, 344, "บิล IV-689120 · เหล็กโครงหลังคา"),
    ],
  },

  // 4.5) แต้มเยอะ แต่ก้อนที่ใกล้หมดอายุมีนิดเดียว — เคสที่เคยโชว์ผิดว่า "2,000 แต้มจะหมดใน 21 วัน" (16 ก.ย. 69)
  expiringSmall: {
    key: "expiringSmall",
    label: "Gold 2,000 แต้ม ใกล้หมดจริงแค่ 50",
    registered: true,
    profile: profileOf("ช่างสมชาย"),
    member: member({ id: 9004, phone: "0845556666", first_name: "อนุชา", last_name: "แก้วมณี", points: 2000, total_earned: 2000, company: "อนุชาการช่าง" }),
    transactions: [
      earn(52, 195000, 1950, 10, "บิล IV-690470 · เหล็กเส้น + ปูน ล็อตใหญ่"),
      earn(51, 5000, 50, 344, "บิล IV-689130 · ใบตัดเหล็ก + ลวดผูก"),
    ],
  },

  // 4.6) มีคำขอแลกค้างอยู่ 1 ใบ — แต้ม 300 ถูกจองไว้แล้ว เหลือใช้ได้จริง 300
  //      เคสนี้คือบั๊ก "แลกซ้อนจนแต้มไม่พอตอนมารับของ" (16 ก.ย. 69) ที่เพิ่งปิดไป
  reserved: {
    key: "reserved",
    label: "มีคำขอแลกค้าง แต้มถูกจองไว้ 300",
    registered: true,
    profile: profileOf("ช่างสุชาติ"),
    member: member({ id: 9005, phone: "0861112222", first_name: "สุชาติ", last_name: "พูนทรัพย์", points: 600, total_earned: 600 }),
    transactions: [earn(61, 62000, 620, 12, "บิล IV-690410 · เหล็กกล่อง + ตะแกรง")],
    pendingRedemptions: [{ reward_id: 103, points_required: 300 }],
  },

  // 5) ระดับสูงสุด — ต้องเห็นว่าจอไม่พังเมื่อไม่มีขั้นถัดไป
  diamond: {
    key: "diamond",
    label: "Diamond 12,400 แต้ม ระดับสูงสุด",
    registered: true,
    profile: profileOf("คุณประเสริฐ"),
    member: member({ id: 9002, phone: "0899887766", first_name: "ประเสริฐ", last_name: "รุ่งเรือง", company: "บจก. รุ่งเรืองการช่าง", points: 12400, total_earned: 14800, created_at: iso(-800) }),
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
    transactions: [earn(20, 26000, 260, 425, "บิล IV-688010 · วัสดุก่อสร้าง")],
  },

  // 7) วันเกิดวันนี้ — ทดสอบชิปวันเกิดและโบนัส
  birthday: {
    key: "birthday",
    label: "วันเกิดวันนี้ ได้แต้มโบนัส",
    registered: true,
    profile: profileOf("ช่างสมชาย"),
    member: member({ points: 820, total_earned: 820, birthday: dateOnly(-365 * 45) }),
    transactions: [
      { id: 40, purchase_amount: 0, points_earned: 200, type: "earn", note: "ของขวัญวันเกิด 2569", created_at: iso(-0.1), expires_at: iso(365) },
      earn(39, 62000, 620, 30, "บิล IV-690090 · เหล็ก + ปูน"),
    ],
  },

  // ── สถานการณ์ "ระบบมีปัญหา" ────────────────────────────────────────────────
  // มีไว้ให้ทีมหน้าเว็บสร้างจอแจ้งเตือนได้จริงโดยไม่ต้องรอระบบล่มจริง
  // ทุกตัวนี้ "เป็นสมาชิกอยู่แล้ว" ทั้งนั้น — ถ้าจอไหนขึ้นคำว่า "สมัครสมาชิกฟรี" แปลว่ายังพังอยู่
  fail_db: {
    key: "fail_db", label: "ฐานข้อมูลล่ม (ทุกเส้นตอบ DB_UNAVAILABLE 503)",
    registered: true, profile: profileOf("ช่างสมชาย"), member: null, transactions: [], fault: "db",
  },
  fail_auth: {
    key: "fail_auth", label: "token หมดอายุ (ทุกเส้นตอบ AUTH_REQUIRED 401)",
    registered: true, profile: profileOf("ช่างสมชาย"), member: null, transactions: [], fault: "auth",
  },
  fail_line: {
    key: "fail_line", label: "ติดต่อ LINE ไม่ได้ (LINE_UNAVAILABLE 503)",
    registered: true, profile: profileOf("ช่างสมชาย"), member: null, transactions: [], fault: "line",
  },
  fail_server: {
    key: "fail_server", label: "พังไม่ทราบสาเหตุ (SERVER_ERROR 500)",
    registered: true, profile: profileOf("ช่างสมชาย"), member: null, transactions: [], fault: "server",
  },
  fail_expiry: {
    key: "fail_expiry", label: "บัตรขึ้นปกติ แต่ดูวันหมดอายุแต้มไม่ได้ (expiryUnavailable)",
    registered: true, profile: profileOf("ช่างสมชาย"),
    member: member({ points: 2300, total_earned: 2760, company: "หจก. สมชายก่อสร้าง" }),
    transactions: [earn(12, 40000, 400, 344, "บิล IV-689120 · เหล็กโครงหลังคา")],
    fault: "expiry",
  },
};

// แต้มใกล้หมดอายุของโหมดรีวิว ต้องคิดด้วยกติกาเดียวกับลูกค้าจริง (lib/points.ts) ไม่ใช่พิมพ์ตัวเลขไว้เอง
// ไม่งั้นผู้ตรวจเห็นกล่องเตือนที่ลูกค้าจริงไม่มีวันเห็น (และนั่นคือหน้าตาของบั๊กที่เพิ่งแก้ไป)
export const REVIEW_SCENARIOS: Record<string, ReviewScenario> = Object.fromEntries(
  Object.entries(SCENARIO_DATA).map(([key, s]) => [key, { ...s, expiry: summarizeExpiring(s.transactions, s.member?.points ?? 0) }]),
) as Record<string, ReviewScenario>;

export const REVIEW_SCENARIO_KEYS = Object.keys(REVIEW_SCENARIOS);

// ของรางวัลจำลอง — ให้หน้า /liff/rewards มีของให้ดูแม้ไม่ได้ต่อฐานข้อมูลจริง
export const REVIEW_REWARDS = [
  { id: 101, name: "ส่วนลดเงินสด 100 บาท", description: "ใช้กับบิลถัดไป ไม่มีขั้นต่ำ", points_required: 100, image_url: null, stock: 999 },
  { id: 102, name: "ส่วนลดเงินสด 500 บาท", description: "ใช้กับบิลตั้งแต่ 3,000 บาทขึ้นไป", points_required: 450, image_url: null, stock: 120 },
  { id: 103, name: "ถุงมือช่างหนังแท้", description: "ไซซ์ L ทนคม ใช้งานหนัก", points_required: 300, image_url: null, stock: 24 },
  { id: 104, name: "ตลับเมตร 5 เมตร", description: "แบรนด์ร้าน ล็อกแน่น", points_required: 250, image_url: null, stock: 0 },
  { id: 105, name: "บัตรเติมน้ำมัน 1,000 บาท", description: "รับที่ร้าน แสดงบัตรสมาชิก", points_required: 1000, image_url: null, stock: 8 },
];

/**
 * จำนวนที่ "สมาชิกท่านอื่น" จองของรางวัลชิ้นนั้นค้างไว้ (ข้อมูลจำลอง)
 * มีไว้ให้ผู้ตรวจเห็นเคส "ของยังไม่หมด แต่ถูกจองครบแล้ว" ซึ่งฝั่งจริงนับจากคำขอสถานะ pending
 * บัตรเติมน้ำมัน (105) เหลือ 8 ชิ้น ถูกจองไว้ครบ 8 → แลกเพิ่มไม่ได้จนกว่าจะมีคนมารับหรือถูกยกเลิก
 */
export const REVIEW_REWARD_RESERVED: Record<number, number> = { 105: 8 };

/** อ่านสถานการณ์จาก query string — คืน null ถ้าโหมดปิดอยู่ หรือรหัสไม่ตรง หรือไม่รู้จักสถานการณ์นั้น */
export function reviewScenarioFrom(url: URL | { searchParams: URLSearchParams }): ReviewScenario | null {
  if (!isReviewEnabled()) return null;
  const sp = "searchParams" in url ? url.searchParams : new URL(String(url)).searchParams;
  const secret = sp.get("review") ?? "";
  if (!secret || secret !== process.env.REVIEW_SECRET) return null;
  const key = sp.get("as") ?? "bronze120";
  return REVIEW_SCENARIOS[key] ?? null;
}
