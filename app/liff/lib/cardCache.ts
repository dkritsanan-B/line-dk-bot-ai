// บัตรล่าสุดที่โหลดสำเร็จ — เก็บไว้ในเครื่องของลูกค้าเอง ใช้ตอนระบบล่มเท่านั้น
// เหตุผล (ผู้ตรวจ c1): วันระบบล่ม ลูกค้ายืนหน้าเคาน์เตอร์แล้วไม่มีอะไรให้โชว์พนักงานเลย
// เป็นแค่ "ของช่วยจำ" ต่อเครื่อง: เปิดโหมดส่วนตัว/ลบข้อมูลเว็บแล้วหายได้ หน้าเว็บต้องทำงานได้โดยไม่มีมัน
export interface CardSnapshot {
  name: string;
  phone: string;
  tier: string;
  points: number;
  savedAt: string;
}

const KEY = "dk_member_card_v1";

export function saveCard(s: Omit<CardSnapshot, "savedAt">): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, savedAt: new Date().toISOString() })); } catch {}
}

export function loadCard(): CardSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CardSnapshot>;
    if (typeof v.phone !== "string" || typeof v.points !== "number" || typeof v.savedAt !== "string") return null;
    return { name: String(v.name ?? ""), phone: v.phone, tier: String(v.tier ?? ""), points: v.points, savedAt: v.savedAt };
  } catch {
    return null;
  }
}
