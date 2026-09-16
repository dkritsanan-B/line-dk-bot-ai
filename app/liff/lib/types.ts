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
