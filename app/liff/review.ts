"use client";
// ตัวช่วยฝั่งหน้าเว็บสำหรับโหมดรีวิว — ถ้า URL มี ?review=<secret> ให้ข้ามการล็อกอิน LINE
// แล้วต่อพารามิเตอร์เดียวกันไปกับทุก fetch เพื่อให้ API คืนข้อมูลจำลอง (ดู lib/review-mode.ts)
// บน production ฝั่งเซิร์ฟเวอร์จะไม่ยอมรับพารามิเตอร์นี้ ต่อให้ใส่มาก็ตาม

export function reviewQS(): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search);
  const secret = q.get("review");
  if (!secret) return "";
  return `?review=${encodeURIComponent(secret)}&as=${encodeURIComponent(q.get("as") ?? "bronze120")}`;
}

export function isReview(): boolean {
  return reviewQS() !== "";
}
