// ส่ง LINE push แบบรู้โควตา — ตัวส่งกลางของระบบสมาชิก (17 ก.ย. 69)
//
// LINE OA แพ็กเกจฟรีส่ง push ได้ 300 ข้อความ/เดือน (reply ฟรีไม่นับ) และบัญชีนี้ใช้ร่วมกับงานอื่นของร้าน
// ถ้าปล่อยให้ข้อความแจ้งเตือนทั่วไป (วันเกิด เลื่อนระดับ แต้มใกล้หมด) ใช้โควตาจนหมด
// ลูกค้าที่กดแลกของจะไม่ได้ข้อความยืนยัน และพนักงานไม่ได้ข่าวคำขอ → เกิดปัญหาหน้าเคาน์เตอร์
//
// จึงแบ่งความสำคัญ แล้วกันโควตาส่วนท้ายไว้ให้ข้อความที่สำคัญกว่า:
//   critical  = เกี่ยวกับของ/แต้มที่ลูกค้าเพิ่งทำ (ขอแลก ยืนยัน ยกเลิก แจ้งพนักงาน) → ส่งจนโควตาหมดจริง
//   notice    = แจ้งสิ่งที่กระทบแต้ม (แต้มหมดอายุแล้ว ใกล้หมด เลื่อนระดับ ใกล้ลดระดับ) → หยุดเมื่อเหลือ ≤ RESERVE_NOTICE
//   courtesy  = ของขวัญ/ทักทาย (วันเกิด) → หยุดเมื่อเหลือ ≤ RESERVE_COURTESY (แต้มวันเกิดยังเข้าตามปกติ แค่ไม่ทัก)
// ถ้าถามโควตาไม่ได้ (LINE ล่ม/token ผิด) → ยอมให้ critical ส่ง ที่เหลือส่งตามปกติ (ไม่ทำให้ระบบเงียบเพราะตัวนับล่ม)

export type PushPriority = "critical" | "notice" | "courtesy";

export const RESERVE_NOTICE = 30;
export const RESERVE_COURTESY = 80;
const QUOTA_CACHE_MS = 5 * 60_000;

const API = "https://api.line.me/v2/bot";
const token = () => process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

export interface QuotaStatus { limit: number | null; used: number; remaining: number | null; checkedAt: number }

let cached: QuotaStatus | null = null;
let localSent = 0;   // ส่งไปแล้วในเครื่องนี้หลังถามโควตาล่าสุด (ตัวเลขของ LINE อัปเดตช้า)

export function _resetQuotaCache() { cached = null; localSent = 0; }

export async function getQuota(fetchImpl: typeof fetch = fetch): Promise<QuotaStatus | null> {
  if (cached && Date.now() - cached.checkedAt < QUOTA_CACHE_MS) {
    return { ...cached, used: cached.used + localSent, remaining: cached.remaining === null ? null : Math.max(0, cached.remaining - localSent) };
  }
  try {
    const H = { Authorization: `Bearer ${token()}` };
    const [q, c] = await Promise.all([
      fetchImpl(`${API}/message/quota`, { headers: H }).then(r => (r.ok ? r.json() : null)),
      fetchImpl(`${API}/message/quota/consumption`, { headers: H }).then(r => (r.ok ? r.json() : null)),
    ]);
    if (!q || !c) return null;
    const limit = q.type === "limited" ? Number(q.value) : null;   // "none" = ไม่จำกัด (แพ็กเกจจ่ายเงิน)
    const used = Number(c.totalUsage) || 0;
    cached = { limit, used, remaining: limit === null ? null : Math.max(0, limit - used), checkedAt: Date.now() };
    localSent = 0;
    return { ...cached };
  } catch {
    return null;
  }
}

/** ตัดสินว่าควรส่งไหม — แยกออกมาให้ทดสอบได้ */
export function shouldSend(priority: PushPriority, quota: QuotaStatus | null, messageCount = 1): { ok: boolean; reason?: string } {
  if (!quota || quota.remaining === null) return { ok: true };           // ไม่รู้โควตา / ไม่จำกัด
  const left = quota.remaining - messageCount;
  if (left < 0) return { ok: false, reason: `โควตาหมด (เหลือ ${quota.remaining})` };
  if (priority === "notice" && left < RESERVE_NOTICE) return { ok: false, reason: `กันโควตาไว้ให้ข้อความสำคัญ (เหลือ ${quota.remaining})` };
  if (priority === "courtesy" && left < RESERVE_COURTESY) return { ok: false, reason: `กันโควตาไว้ให้ข้อความสำคัญ (เหลือ ${quota.remaining})` };
  return { ok: true };
}

export interface PushResult { sent: boolean; skipped?: string; status?: number }

/**
 * ส่ง push ตามความสำคัญ · ไม่ throw (คืนผลให้ผู้เรียกตัดสินเอง)
 * @param to        userId หรือ groupId
 * @param messages  ข้อความ LINE (object เดียวหรือหลายอัน สูงสุด 5)
 */
export async function pushLine(to: string, messages: object | object[], priority: PushPriority, fetchImpl: typeof fetch = fetch): Promise<PushResult> {
  const list = (Array.isArray(messages) ? messages : [messages]).slice(0, 5);
  if (!to || !list.length) return { sent: false, skipped: "ไม่มีผู้รับหรือข้อความ" };
  const decision = shouldSend(priority, await getQuota(fetchImpl), 1);   // LINE นับ 1 ต่อผู้รับ ไม่ใช่ต่อบับเบิล
  if (!decision.ok) {
    console.warn(`[line-push] ข้าม (${priority}) ถึง ${to.slice(0, 6)}… — ${decision.reason}`);
    return { sent: false, skipped: decision.reason };
  }
  try {
    const res = await fetchImpl(`${API}/message/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ to, messages: list }),
    });
    if (res.ok) { localSent += 1; return { sent: true, status: res.status }; }
    const body = await res.text().catch(() => "");
    console.error(`[line-push] ส่งไม่ผ่าน ${res.status} (${priority}) ถึง ${to.slice(0, 6)}… ${body.slice(0, 160)}`);
    if (res.status === 429) cached = cached ? { ...cached, remaining: 0 } : cached;   // LINE บอกว่าหมดแล้ว เชื่อ LINE
    return { sent: false, status: res.status, skipped: `LINE ตอบ ${res.status}` };
  } catch (e) {
    console.error(`[line-push] ส่งไม่ผ่าน (${priority})`, e);
    return { sent: false, skipped: "ติดต่อ LINE ไม่ได้" };
  }
}
