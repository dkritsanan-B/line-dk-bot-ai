import { isReviewEnabled, REVIEW_ENABLED_NOTE } from "./review-mode";

const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();

export function isAdminReviewRequest(url: URL | { searchParams: URLSearchParams }): boolean {
  if (!isReviewEnabled()) return false;
  const params = "searchParams" in url ? url.searchParams : new URL(String(url)).searchParams;
  const supplied = params.get("review") ?? "";
  return Boolean(supplied && supplied === process.env.REVIEW_SECRET);
}

export const ADMIN_REVIEW_NOTE = REVIEW_ENABLED_NOTE;

export const ADMIN_REVIEW_MEMBERS = [
  { id: 8101, customer_id: null, suggested_customer_id: "CUS-00912", suggested_customer_name: "สมชาย ใจดี", line_user_id: "U-review-1", display_name: "ช่างชาย DK", first_name: "สมชาย", last_name: "ใจดี", phone: "0812345678", company: "หจก. สมชายก่อสร้าง", birthday: "1981-04-18", points: 0, created_at: ago(9), link_status: "suggested", waiting_days: 9, link_overdue: true, pending_bills: { count: 4, amount: 184500, estimated_points: 1845, first_bill_date: ago(7), last_bill_date: ago(1) } },
  { id: 8102, customer_id: null, suggested_customer_id: "CUS-01847", suggested_customer_name: "วิเชียร งานเหล็ก", line_user_id: "U-review-2", display_name: "เฮียเชียร", first_name: "วิเชียร", last_name: "คงมั่น", phone: "0895552468", company: "วิเชียรงานเหล็ก", birthday: "1978-11-02", points: 0, created_at: ago(4), link_status: "suggested", waiting_days: 4, link_overdue: false, pending_bills: { count: 2, amount: 32700, estimated_points: 327, first_bill_date: ago(3), last_bill_date: ago(1) } },
  { id: 8103, customer_id: null, suggested_customer_id: null, suggested_customer_name: null, line_user_id: "U-review-3", display_name: "คุณแอน", first_name: "อรทัย", last_name: "แสงทอง", phone: "0867778888", company: null, birthday: "1986-08-12", points: 0, created_at: ago(2), link_status: "pending", waiting_days: 2, link_overdue: false, pending_bills: null },
  { id: 8104, customer_id: "CUS-00421", suggested_customer_id: null, suggested_customer_name: null, line_user_id: "U-review-4", display_name: "ช่างเอก", first_name: "เอกชัย", last_name: "บุญส่ง", phone: "0821119876", company: "ทีมช่างเอก", birthday: "1983-02-20", points: 2380, created_at: ago(180), link_status: "linked", waiting_days: 0, link_overdue: false, pending_bills: null },
];

export const ADMIN_REVIEW_REDEMPTIONS = [
  { id: 5042, status: "pending", points_required: 300, created_at: ago(0.02), confirmed_at: null, first_name: "สมชาย", last_name: "ใจดี", display_name: "ช่างชาย DK", phone: "0812345678", line_user_id: "U-review-1", reward_name: "ถุงมือช่างหนังแท้", image_url: null, stock: 24 },
  { id: 5041, status: "pending", points_required: 250, created_at: ago(0.2), confirmed_at: null, first_name: "เอกชัย", last_name: "บุญส่ง", display_name: "ช่างเอก", phone: "0821119876", line_user_id: "U-review-4", reward_name: "ตลับเมตร 5 เมตร", image_url: null, stock: 3 },
  { id: 5038, status: "confirmed", points_required: 100, created_at: ago(2), confirmed_at: ago(2), first_name: "วิเชียร", last_name: "คงมั่น", display_name: "เฮียเชียร", phone: "0895552468", line_user_id: "U-review-2", reward_name: "ส่วนลดเงินสด 100 บาท", image_url: null, stock: 99 },
];

export function filterAdminReviewMembers(search: string) {
  const needle = search.trim().toLocaleLowerCase("th").replace(/\D/g, "") || search.trim().toLocaleLowerCase("th");
  if (!needle) return ADMIN_REVIEW_MEMBERS;
  return ADMIN_REVIEW_MEMBERS.filter((u) => {
    const digits = search.replace(/\D/g, "");
    if (digits.length >= 3 && u.phone.endsWith(digits)) return true;
    return [u.display_name, u.first_name, u.last_name, u.company, u.customer_id, u.suggested_customer_id]
      .filter(Boolean).join(" ").toLocaleLowerCase("th").includes(search.trim().toLocaleLowerCase("th"));
  });
}
