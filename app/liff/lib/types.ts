// ชนิดข้อมูลของหน้าสมาชิก LINE (LIFF) — ย้ายออกจาก page.tsx เพื่อให้คอมโพเนนต์ย่อยใช้ร่วมกันได้
export interface TxItem {
  id: number;
  purchase_amount: number;
  points_earned: number;
  type: string;
  note: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface Profile {
  userId: string;
  displayName: string;
  pictureUrl: string;
}

export interface Member {
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
}

export interface Expiry {
  earliest_expiry: string | null;
  expiring_points: number | null;
}

/** สถานะการผูกรหัสลูกค้าที่ API ส่งให้หน้าเว็บ (lib/points.ts toClientLink)
 *  ตั้งใจไม่มีจำนวนบิลค้าง/รหัสที่ระบบเดา — คนสวมเบอร์คนอื่นสมัครได้ ห้ามพยายามแสดงข้อมูลพวกนั้น */
export interface ClientLink {
  status: "linked" | "pending";
  earns_points: boolean;
  customer_id: string | null;
  waiting_days: number | null;
  overdue: boolean;
  headline: string;
  detail: string;
  action: string | null;
}

export interface MemberResponse {
  registered: boolean;
  code?: string;
  profile?: Profile;
  user?: Member | null;
  expiry?: Expiry | null;
  expiryUnavailable?: boolean;
  link?: ClientLink | null;
}

export interface PendingRedemption {
  id: number;
  reward_id: number;
  reward_name: string | null;
  points_required: number;
  created_at: string;
}

/** GET /api/liff/redeem — available_points อาจติดลบในเคสขอบ ให้แสดงเป็น 0 */
export interface RedeemSummary {
  registered?: boolean;
  code?: string;
  points: number;
  pending_points: number;
  available_points: number;
  pending: PendingRedemption[];
  reserved_by_reward: Record<string, number>;
  /** บัญชีของตัวเองผูกรหัสลูกค้าแล้วหรือยัง (ไม่มีในคำตอบเก่า = ถือว่าไม่ทราบ) */
  earns_points?: boolean;
}
