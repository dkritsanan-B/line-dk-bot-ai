"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isReview, reviewQS } from "../review";
import { Shell, Loading } from "../ui";
import Icon, { type IconName } from "../components/Icon";
import { BAHT_PER_POINT, PENDING_POINTS_DAYS, birthdayFrom, firstTierOf, reactivateText } from "../lib/perks";
import { ProblemScreen } from "../components/ProblemNotice";
import { callApi, problemOf, redeemErrorText, SHOP_PHONE, SHOP_TEL, type Problem } from "../lib/api";
import { formatDate, getEffectiveTier, getTierFromPoints, type Tier } from "../lib/tiers";
import type { MemberResponse, PendingRedemption, RedeemSummary } from "../lib/types";
import TierMark from "../components/TierMark";
import { ReactivateRule } from "../components/MemberCard";
import "../styles/rewards.css";

// หน้าของรางวัล — ตัวตน = LIFF access token · สไตล์อยู่ ../liff.css
//
// 16 ก.ย. 69 — บอกความจริงก่อนกด:
//   ตัวเลขแต้มมาจาก GET /api/liff/redeem (ไม่ใช่ /api/member) เพราะต้องรู้ว่าจองไว้เท่าไหร่แล้ว
//   แต้มใช้ได้ = available_points (ติดลบได้ในเคสขอบ → แสดง 0) · จองไว้แล้ว = pending_points
//   การ์ดของรางวัลบอกเหตุผลที่แลกไม่ได้ก่อนกด: มีคำขอรออยู่แล้ว / ของหมด / ขาดอีกกี่แต้ม
//   ระบบล่ม → จอแจ้งปัญหา ห้ามขึ้น "ยังไม่มีของรางวัล" หรือ "แต้มของคุณ 0"
interface Reward {
  id: number;
  name: string;
  description: string | null;
  points_required: number;
  image_url: string | null;
  stock: number | null;
}

interface RewardCopy {
  detail: string | null;
  condition: string | null;
}

/** แยกเฉพาะเงื่อนไขที่อ่านจากข้อความได้แน่นอน ที่เหลือคงเป็นคำอธิบายตามที่ร้านเขียน */
function rewardCopy(description: string | null): RewardCopy {
  if (!description) return { detail: null, condition: null };
  const minimum = description.match(/^ใช้กับบิลตั้งแต่\s*([0-9,]+)\s*บาทขึ้นไป$/);
  // r6: ทุกใบมีบรรทัดคำอธิบาย (บรรทัด 1) + ป้ายเงื่อนไข (บรรทัด 2) — ข้อความ "ใช้กับบิล…" ของร้านบอกว่าเป็นส่วนลดในบิล
  if (minimum) return { detail: "ใช้เป็นส่วนลดในบิล", condition: `บิลขั้นต่ำ ${minimum[1]} บาท` };
  if (/ไม่มีขั้นต่ำ\s*$/.test(description)) {
    const detail = description.replace(/[,·]?\s*ไม่มีขั้นต่ำ\s*$/, "").trim();
    return { detail: detail || null, condition: "ไม่มีขั้นต่ำ" };
  }
  return { detail: description, condition: null };
}

/** แต้มลดลงสั้น ๆ หลังส่งคำขอสำเร็จ และหยุดภาพเคลื่อนไหวเมื่อผู้ใช้ตั้งค่าไว้ */
function useAnimatedAvailable(value: number): number {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const previousTarget = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    const previous = previousTarget.current;
    previousTarget.current = value;
    if (value >= previous || typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 300);
      const next = Math.round(from + (value - from) * (1 - Math.pow(1 - progress, 3)));
      shownRef.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return shown;
}

// กติกา — c2 (ผู้ตรวจ c1): เดิมเป็นภาษาทางการ ("คะแนน" "บริษัทขอสงวนสิทธิ์") และขัดกับหน้าอื่น
// (บอกให้เปิดบัตรตอนสะสม / บอกว่าหักแต้มทันที) · ตอนนี้พูดภาษาเดียวกับทุกหน้า และตรงกับระบบจริง:
//   สะสม = บอกเบอร์ที่แคชเชียร์ · แลก = กดแล้วแต้ม "ถูกจอง" · หักจริงตอนรับของ · ยกเลิกได้ที่ร้าน
//   บิลเงินเชื่อไม่สะสมแต้ม (บอทฝั่งร้าน hero_points_watch.js ข้ามลูกค้าเครดิต)
// มูลค่าแต้มต้องมาจากของรางวัลที่ร้านตั้งไว้จริง (17 ก.ย. 69) — เดิมพิมพ์อัตราตายตัว 1 แต้ม = 1 บาท ซึ่งร้านอาจไม่ได้ตั้งของรางวัลแบบนั้น
function valueExample(rewards: Reward[]): string | null {
  const cash = rewards
    .map(r => ({ r, baht: Number((r.name.match(/ส่วนลด[^0-9]*([0-9][0-9,]*)\s*บาท/) || [])[1]?.replace(/,/g, "")) }))
    .filter(x => x.baht > 0 && x.r.points_required > 0)
    .sort((a, b) => a.r.points_required - b.r.points_required)[0];
  return cash ? `ตัวอย่าง: ${cash.r.points_required.toLocaleString()} แต้ม แลก${cash.r.name}` : null;
}

function rulesText(minReward: number | null, example: string | null): string[] {
  return [
    ...(example ? [example] : []),
    `ซื้อทุก ${BAHT_PER_POINT} บาท ได้ 1 แต้ม คิดต่อบิล เศษที่ไม่ครบ ${BAHT_PER_POINT} บาทปัดทิ้ง · ซื้อทุกครั้งบอกเบอร์โทรที่แคชเชียร์ แต้มเข้าเองภายในวันที่ซื้อ`,
    `สมัครแล้วต้องยืนยันตัวตนที่ร้านครั้งเดียว แต้มเริ่มเข้าหลังยืนยัน · บิลตั้งแต่วันสมัครได้แต้มย้อนหลังอัตโนมัติ (ไม่เกิน ${PENDING_POINTS_DAYS} วัน) · บิลเงินเชื่อ (เครดิต) ไม่สะสมแต้ม`,
    "แต้มใช้ได้ 1 ปี นับจากวันที่ได้ แต้มก้อนที่ใกล้หมดอายุจะขึ้นเตือนที่หน้าบัตร",
    `ตั้งแต่ระดับ ${firstTierOf("steel")} ซื้อเหล็กหรือเมทัลชีทราคาป้าย ได้แต้มพิเศษเพิ่ม (คิดทีละรายการ รายการที่ขอลดราคาได้แต้มปกติ) และมีคูปองวันเกิดเป็นแต้มตั้งแต่ระดับ ${birthdayFrom()}`,
    `ไม่มีบิลเกิน 1 ปี ระดับจะพักไว้ ยอดสะสมไม่หาย ${reactivateText().join(" ")} กลับระดับเดิมทันที · ร้านเตือนที่หน้าบัตรล่วงหน้า 3 เดือน`,
    `กด "แลก" แล้วกดยืนยัน แต้มจะถูกจองไว้ให้ ยังไม่หัก${minReward ? ` · ของรางวัลเริ่มที่ ${minReward.toLocaleString()} แต้ม` : ""}`,
    "ส่วนลดจากแต้มต้องกดแลกก่อนจ่าย · จำนวนคูปองหรือของรางวัลที่ใช้ต่อบิล ให้ดูเงื่อนไขของแต่ละรายการก่อนกด",
    "มารับของที่ร้าน เปิดหน้าบัตรสมาชิกในแอปให้พนักงานดู พร้อมบอกเลขคำขอ (#REQ-…) พนักงานหักแต้มตอนส่งของให้",
    "เปลี่ยนใจก่อนรับของ แจ้งพนักงานหรือโทรร้านให้ยกเลิกคำขอได้ แต้มที่จองไว้คืนครบ · รับของแล้วคืนแต้มไม่ได้ค่ะ",
    "ถ้าร้านปรับกติกา จะแจ้งไว้ในหน้านี้ค่ะ",
  ];
}

/** รูปแทนของรางวัลที่ไม่มีรูป — เดาจากชื่อ ให้แต่ละชิ้นหน้าตาไม่ซ้ำกัน */
function rewardIcon(name: string): IconName {
  // r6: ส่วนลดเป็นจำนวนบาท → คูปองสัญลักษณ์บาท (เดิมตั๋ว % ชวนเข้าใจว่าลดเป็นเปอร์เซ็นต์)
  if (/ส่วนลด|คูปอง|เงินสด/.test(name)) return "coupon";
  if (/น้ำมัน/.test(name)) return "fuel";
  if (/ตลับเมตร|ไม้บรรทัด|ฉาก/.test(name)) return "ruler";
  if (/ถุงมือ/.test(name)) return "glove";
  return "gift";
}

type CardState =
  | { kind: "mine"; req: PendingRedemption }
  | { kind: "out"; reservedFull: boolean }
  | { kind: "lack"; lacking: number }
  | { kind: "signup" }
  | { kind: "can" };

function cardState(r: Reward, summary: RedeemSummary | null, available: number): CardState {
  if (!summary) return { kind: "signup" };
  const req = summary.pending.find(p => p.reward_id === r.id);
  if (req) return { kind: "mine", req };
  if (r.stock !== null) {
    const reserved = summary.reserved_by_reward[String(r.id)] ?? 0;
    if (r.stock <= 0) return { kind: "out", reservedFull: false };
    if (r.stock - reserved <= 0) return { kind: "out", reservedFull: true };
  }
  if (available < r.points_required) return { kind: "lack", lacking: r.points_required - available };
  return { kind: "can" };
}

/** ลำดับการ์ด (17 ก.ย. 69 ผู้ตรวจนักออกแบบ): แลกได้ตอนนี้ → รอรับของ → แต้มยังไม่พอ (ใกล้ครบก่อน) → ของหมด/จองครบ ท้ายสุด
 *  เรียงครั้งเดียวตอนโหลด ไม่เรียงใหม่ตอนกดแลกสำเร็จ — การ์ดที่เพิ่งกดต้องอยู่ที่เดิมพร้อมข้อความยืนยัน ไม่กระโดดหนี */
function rankOf(st: CardState): number {
  return st.kind === "can" ? 0 : st.kind === "mine" ? 1 : st.kind === "out" ? 3 : 2;
}
function sortRewards(list: Reward[], summary: RedeemSummary | null): Reward[] {
  const available = Math.max(0, summary?.available_points ?? 0);
  return list
    .map(r => ({ r, st: cardState(r, summary, available) }))
    .sort((a, b) =>
      rankOf(a.st) - rankOf(b.st)
      || (a.st.kind === "lack" && b.st.kind === "lack" ? a.st.lacking - b.st.lacking : 0)
      || a.r.points_required - b.r.points_required)
    .map(x => x.r);
}

// หมวดของรางวัล — เดาจากชื่อ (ตารางของรางวัลไม่มีช่องหมวด) · ชิปหมวดขึ้นเฉพาะเมื่อมีของทั้งสองหมวด
type RewardCat = "cash" | "tool";
const CAT_LABEL: Record<RewardCat, string> = { cash: "ส่วนลดและบัตร", tool: "ของใช้ช่าง" };
function rewardCat(name: string): RewardCat {
  return /ส่วนลด|คูปอง|เงินสด|บัตรเติม|บัตรกำนัล|บัตรของขวัญ/.test(name) ? "cash" : "tool";
}
type Filter = "all" | "can" | RewardCat;

export default function RewardsPage() {
  const [token, setToken]     = useState("");
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [summary, setSummary] = useState<RedeemSummary | null>(null);   // null = ยังไม่สมัคร (เซิร์ฟเวอร์ยืนยันแล้ว)
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [redeemMsg, setRedeemMsg]     = useState<{ id: number; ok: boolean; text: string } | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<{ reward: Reward; requestId: number } | null>(null);
  // กดแลกครั้งแรก = เปิดกล่องยืนยัน (ผู้ตรวจ c1: กดครั้งเดียวแต้มโดนจองทันที ไม่มีจังหวะให้คิด)
  const [confirmId, setConfirmId]     = useState<number | null>(null);
  const tokenRef = useRef<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  // id ที่แลกได้ ณ ตอนโหลด — ชิป "แลกได้ตอนนี้" ใช้ชุดนี้ กดแลกแล้วการ์ดยังอยู่ในชิปเดิม (ข้อความยืนยันไม่หายไปต่อหน้า)
  const [canIds, setCanIds] = useState<Set<number>>(() => new Set());
  const requestsRef = useRef<HTMLElement | null>(null);
  // r5: ระดับที่พักไว้ (ไม่มีบิลเกิน 1 ปี) — ตัวสรุปแต้มไม่มีข้อมูลระดับ จึงอ่านจาก /api/member แยก
  //     ข้อมูลเสริมเท่านั้น: โหลดไม่ได้ = ไม่ขึ้นแถบ ไม่ขึ้นจอแจ้งปัญหา
  const [paused, setPaused] = useState<Tier | null>(null);
  // r5: กดยืนยันแลกแล้วไม่ผ่านเพราะหมดเวลา/เน็ตหลุด/ระบบขัดข้อง → บอกในกล่องยืนยันเลย (แต้มยังไม่ถูกหัก)
  const [sheetError, setSheetError] = useState<{ id: number; problem: Problem } | null>(null);
  // r6: ชิปเลื่อนข้างแถวเดียว — จางขอบด้านที่ยังมีชิปซ่อนอยู่
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const [chipFade, setChipFade] = useState({ start: false, end: false });
  const syncChipFade = useCallback(() => {
    const el = chipsRef.current;
    if (!el) return;
    const start = el.scrollLeft > 2;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setChipFade(prev => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  /** โหลดของรางวัล + แต้มที่ใช้ได้พร้อมกัน — ถ้าอย่างใดอย่างหนึ่งล้ม ขึ้นจอแจ้งปัญหา (ไม่โชว์ตัวเลขที่ไม่จริง) */
  const loadAll = useCallback(async (tok: string): Promise<boolean> => {
    const auth = { headers: { Authorization: `Bearer ${tok}` } };
    const [rw, sm] = await Promise.all([
      callApi<{ rewards?: Reward[] }>("/api/rewards" + reviewQS()),
      callApi<RedeemSummary>("/api/liff/redeem" + reviewQS(), auth),
    ]);
    // สรุปแต้มล้มก่อน (บอกเรื่อง token ได้ตรงกว่า) แล้วค่อยของรางวัล
    if (!sm.ok) { setProblem(sm.problem); return false; }
    if (!rw.ok) { setProblem(rw.problem); return false; }
    if (!Array.isArray(rw.data.rewards)) { setProblem(problemOf("SERVER_ERROR")); return false; }
    const s = sm.data;
    let nextSummary: RedeemSummary | null;
    if (s.registered === false && s.code === "NOT_REGISTERED") nextSummary = null;
    else if (typeof s.points === "number" && Array.isArray(s.pending)) nextSummary = { ...s, reserved_by_reward: s.reserved_by_reward ?? {} };
    else { setProblem(problemOf("SERVER_ERROR")); return false; }
    setProblem(null);
    const avail = Math.max(0, nextSummary?.available_points ?? 0);
    setRewards(sortRewards(rw.data.rewards, nextSummary));
    setCanIds(new Set(rw.data.rewards.filter(r => cardState(r, nextSummary, avail).kind === "can").map(r => r.id)));
    setSummary(nextSummary);
    return true;
  }, []);

  const loadPaused = useCallback(async (tok: string) => {
    const r = await callApi<MemberResponse>("/api/member" + reviewQS(), { headers: { Authorization: `Bearer ${tok}` } });
    if (!r.ok || r.data.registered !== true || !r.data.user) return;
    const u = r.data.user;
    // รอยืนยันตัวตน = ยังไม่มีระดับให้พัก
    if (r.data.link?.status === "pending") return;
    const eff = getEffectiveTier(u.total_earned ?? 0, u.points ?? 0, u.last_purchase_at ?? null);
    const real = getTierFromPoints(u.total_earned ?? 0);
    setPaused(eff.name !== real.name ? real : null);
  }, []);

  const boot = useCallback(async () => {
    let tok = tokenRef.current;
    if (tok === null) {
      // ตัวตน = LIFF access token เท่านั้น (ไม่รับ uid จาก URL — ใครรู้ U-id คนอื่นก็กดแลกของแทนได้)
      if (isReview()) tok = "review";
      else {
        try { tok = sessionStorage.getItem("liff_token") ?? ""; } catch { tok = ""; }
        try {
          const liff = (await import("@line/liff")).default;
          await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
          if (!liff.isLoggedIn()) { liff.login(); return; }
          tok = liff.getAccessToken() ?? tok;
        } catch {}
      }
      tokenRef.current = tok;
      setToken(tok);
    }
    if (!tok) { setProblem({ kind: "auth", code: "AUTH_REQUIRED", serverMessage: null }); return; }
    void loadPaused(tok);
    await loadAll(tok);
  }, [loadAll, loadPaused]);

  useEffect(() => {
    boot().finally(() => setLoading(false));
  }, [boot]);

  async function retry() {
    if (problem?.kind === "auth") { window.location.reload(); return; }
    setRetrying(true);
    try { await boot(); } finally { setRetrying(false); }
  }

  async function handleRedeem(reward: Reward) {
    if (!token) {
      setConfirmId(null);
      setRedeemMsg({ id: reward.id, ok: false, text: redeemErrorText(problemOf("AUTH_REQUIRED")) });
      return;
    }
    setRedeemingId(reward.id);
    setRedeemMsg(null);
    setSheetError(null);
    try {
      const r = await callApi<{ success?: boolean; requestId?: number; available_points?: number }>("/api/liff/redeem" + reviewQS(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rewardId: reward.id }),
      });
      if (!r.ok || !r.data.success || typeof r.data.requestId !== "number") {
        const p = r.ok ? problemOf("SERVER_ERROR") : r.problem;
        // ปัญหาที่ไม่เกี่ยวกับของชิ้นนี้ (หมดเวลา/เน็ต/ระบบ) → ค้างกล่องยืนยันไว้ บอกในกล่อง ให้ลองใหม่ได้ทันที
        if (p.kind === "auth" || p.kind === "offline" || p.code === "SERVER_ERROR" || p.code === "DB_UNAVAILABLE") {
          setSheetError({ id: reward.id, problem: p });
          return;
        }
        setConfirmId(null);
        setRedeemMsg({ id: reward.id, ok: false, text: redeemErrorText(p) });
        // สถานะบนจออาจเก่าแล้ว (มีคนจองตัดหน้า / ขอไว้จากอีกเครื่อง) → ดึงตัวเลขจริงมาใหม่เงียบ ๆ
        if (["NOT_ENOUGH_POINTS", "REWARD_OUT_OF_STOCK", "DUPLICATE_REQUEST", "RACE_LOST", "REWARD_NOT_FOUND"].includes(p.code)) {
          await loadAll(token);
        }
        return;
      }
      const requestId = r.data.requestId;
      // อัปเดตตัวเลขและรายการคำขอทันที ไม่ต้องรีเฟรช
      setSummary(prev => {
        if (!prev) return prev;
        const key = String(reward.id);
        return {
          ...prev,
          pending_points: prev.pending_points + reward.points_required,
          available_points: typeof r.data.available_points === "number" ? r.data.available_points : prev.available_points - reward.points_required,
          pending: [...prev.pending, {
            id: requestId, reward_id: reward.id, reward_name: reward.name,
            points_required: reward.points_required, created_at: new Date().toISOString(),
          }],
          reserved_by_reward: { ...prev.reserved_by_reward, [key]: (prev.reserved_by_reward[key] ?? 0) + 1 },
        };
      });
      setConfirmId(null);
      setRedeemSuccess({ reward, requestId });
    } finally {
      setRedeemingId(null);
    }
  }

  // ชิปกรอง — "ทั้งหมด" · "แลกได้ตอนนี้" (เฉพาะสมาชิก) · หมวด (เฉพาะเมื่อมีของทั้งสองหมวด)
  const chips = useMemo(() => {
    const list: { key: Filter; label: string; count: number }[] = [{ key: "all", label: "ทั้งหมด", count: rewards.length }];
    if (summary) list.push({ key: "can", label: "แลกได้ตอนนี้", count: rewards.filter(r => canIds.has(r.id)).length });
    const cats = (Object.keys(CAT_LABEL) as RewardCat[]).map(c => ({ key: c, label: CAT_LABEL[c], count: rewards.filter(r => rewardCat(r.name) === c).length }));
    if (cats.every(c => c.count > 0)) list.push(...cats);
    return list;
  }, [rewards, summary, canIds]);
  const activeFilter: Filter = chips.some(c => c.key === filter) ? filter : "all";
  const shown = rewards.filter(r =>
    activeFilter === "all" ? true : activeFilter === "can" ? canIds.has(r.id) : rewardCat(r.name) === activeFilter);
  const available = Math.max(0, summary?.available_points ?? 0);
  const reservedPts = summary?.pending_points ?? 0;
  const animatedAvailable = useAnimatedAvailable(available);
  useEffect(() => {
    syncChipFade();
    window.addEventListener("resize", syncChipFade);
    return () => window.removeEventListener("resize", syncChipFade);
  }, [syncChipFade, chips, loading]);

  if (loading) return <Loading />;

  const back = { label: "บัตรสมาชิก", href: "/liff" + reviewQS() };
  if (problem) return (
    <ProblemScreen sub="ของรางวัล · แลกแต้มสะสม" what="ของรางวัลและแต้มของคุณ" problem={problem} onRetry={retry} retrying={retrying} back={back} />
  );

  const confirmReward = confirmId === null ? null : rewards.find(reward => reward.id === confirmId) ?? null;
  const confirmCopy = confirmReward ? rewardCopy(confirmReward.description) : null;
  const sheetErr = sheetError && sheetError.id === confirmId ? sheetError.problem : null;

  function closeSuccess() {
    setRedeemSuccess(null);
    requestAnimationFrame(() => requestAnimationFrame(() => requestsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })));
  }

  return (
    <Shell sub="ของรางวัล · แลกแต้มสะสม" back={back} short layout="catalog">
      {summary ? (
        <div className="lf-balance">
          <div className="lf-balance-line">
            <span>แต้มที่ใช้ได้</span>
            <b aria-label={`${available.toLocaleString()} แต้ม`}><span aria-hidden="true">{animatedAvailable.toLocaleString()}</span><small>แต้ม</small></b>
          </div>
          {reservedPts > 0 && (
            <div className="lf-balance-reserved">
              จองไว้แล้ว <b>{reservedPts.toLocaleString()} แต้ม</b> จากทั้งหมด {summary.points.toLocaleString()} แต้ม
            </div>
          )}
        </div>
      ) : (
        <div className="lf-balance lf-balance--signup">
          <div className="lf-balance-main">
            <span>ยังไม่ได้สมัครสมาชิก</span>
            <p>สมัครฟรีเพื่อสะสมแต้ม</p>
          </div>
          <button type="button" className="lf-btn lf-btn--primary lf-btn--sm lf-balance-cta" onClick={() => (window.location.href = "/liff" + reviewQS())}>
            สมัครสมาชิก <Icon name="chevron" size={18} />
          </button>
        </div>
      )}

      {summary && summary.earns_points === false && (
        <div className="lf-note lf-note--warn" role="status">
          <b>ยังไม่ได้ยืนยันตัวตน</b>
          ซื้อของตอนนี้แต้มยังไม่เข้า ครั้งหน้าที่มาร้าน แจ้งพนักงานว่า &quot;ยืนยันสมาชิก LINE&quot; พร้อมบอกเบอร์ที่สมัครไว้ หลังยืนยันแล้วบิลตั้งแต่วันสมัครได้แต้มย้อนหลังอัตโนมัติ (ไม่เกิน {PENDING_POINTS_DAYS} วัน)
        </div>
      )}

      {summary && paused && (
        <div className="lf-rw-paused" role="status">
          <Icon name="pause" size={20} />
          <TierMark tier={paused} />
          <span><b className="lf-nw">ระดับ {paused.name} พักไว้</b> <ReactivateRule /> <span className="lf-nw">กลับมาทันที</span></span>
        </div>
      )}

      {summary && summary.pending.length > 0 && (
        <section ref={requestsRef} className="lf-card lf-reqs" aria-label="คำขอที่รอรับของ">
          <h3><Icon name="hourglass" size={22} /> คำขอที่รอรับของ ({summary.pending.length})</h3>
          <p>เปิดหน้าบัตรสมาชิกให้พนักงานดู พร้อมบอกเลขคำขอ พนักงานหักแต้มตอนรับของ</p>
          <p className="lf-reqs-cancel">เปลี่ยนใจ? แจ้งพนักงานหรือโทร <a className="lf-note-tel" href={SHOP_TEL}>{SHOP_PHONE}</a> ให้ยกเลิก แต้มที่จองไว้คืนครบค่ะ</p>
          <ul>
            {summary.pending.map(p => (
              <li key={p.id}>
                <div className="lf-req-main">
                  <b title={p.reward_name ?? undefined}>{p.reward_name ?? "ของรางวัล"}</b>
                  <span><span className="lf-req-no">#REQ-{p.id}</span> · <span className="lf-nw">ขอเมื่อ {formatDate(p.created_at)}</span></span>
                </div>
                <div className="lf-req-pts">{p.points_required.toLocaleString()}<small>แต้ม</small></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rewards.length === 0 ? (
        // ลิสต์ว่างจริง (API ตอบสำเร็จ) — ไม่ใช่ระบบล่ม
        <div className="lf-card lf-center"><i><Icon name="gift" size={40} /></i>ยังไม่มีของรางวัลในขณะนี้</div>
      ) : <>
      {chips.length > 1 && (
        <div className={`lf-rw-chips-wrap${chipFade.start ? " fade-start" : ""}${chipFade.end ? " fade-end" : ""}`}>
          <div className="lf-rw-chips" role="group" aria-label="กรองของรางวัล" ref={chipsRef} onScroll={syncChipFade}>
            {chips.map(c => (
              <button key={c.key} type="button" className={`lf-rw-chip${activeFilter === c.key ? " on" : ""}`}
                aria-pressed={activeFilter === c.key}
                onClick={e => { setFilter(c.key); e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" }); }}>
                {c.label}<span className="lf-rw-chip-n">{c.count.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="lf-rw-grid">
      {shown.length === 0 && (() => {
        // ชิปว่าง — บอกว่าอีกนิดเดียวจะแลกอะไรได้ แทนหน้าโล่ง
        const next = rewards
          .map(r => ({ r, st: cardState(r, summary, available) }))
          .find((x): x is { r: Reward; st: { kind: "lack"; lacking: number } } => x.st.kind === "lack");
        return (
          <div className="lf-card lf-rw-empty" role="status">
            <i><Icon name="gift" size={36} /></i>
            <b>{activeFilter === "can" ? "ตอนนี้ยังไม่มีของที่แลกได้" : "หมวดนี้ยังไม่มีของรางวัล"}</b>
            {activeFilter === "can" && next && (
              <span>สะสมอีก <b className="lf-nw">{next.st.lacking.toLocaleString()} แต้ม</b> แลก{next.r.name}ได้ค่ะ</span>
            )}
            <button type="button" className="lf-btn lf-btn--ghost lf-btn--sm" onClick={() => setFilter("all")}>ดูของรางวัลทั้งหมด</button>
          </div>
        );
      })()}
      {shown.map(reward => {
        const st = cardState(reward, summary, available);
        const ok = st.kind === "can";
        const msg = redeemMsg?.id === reward.id ? redeemMsg : null;
        const reserved = summary?.reserved_by_reward[String(reward.id)] ?? 0;
        const left = reward.stock === null ? null : Math.max(0, reward.stock - reserved);
        const copy = rewardCopy(reward.description);
        const showPassiveStatus = Boolean(summary && summary.earns_points !== false);
        // r6: ยังไม่ยืนยันตัวตน / ยังไม่สมัคร → ป้ายกุญแจแทนที่ว่างด้านขวา (เดิมดูเหมือนการ์ดพัง)
        const lockText = !summary ? "สมัครสมาชิกก่อนแลก" : summary.earns_points === false ? "ยืนยันตัวตนก่อนแลก" : null;
        const outReason = st.kind === "out" ? (st.reservedFull ? "มีคนจองครบแล้ว" : "รอของเข้ารอบหน้า") : null;
        // r5: ของหมดมีรูปแบบเดียว — ข้อความด้านขวาของแถวล่าง (ไม่มีป้ายบนรูปแล้ว) · เป็นข้อเท็จจริงของร้าน แสดงกับทุกคน
        const progress = st.kind === "lack" && reward.points_required > 0
          ? Math.min(100, Math.max(0, available / reward.points_required * 100)) : 0;
        return (
          <div key={reward.id} className={`lf-rw-card${ok ? "" : st.kind === "mine" ? " is-mine" : " is-off"}${st.kind === "out" ? " is-out" : ""}`}>
            <div className="lf-rw-thumb">
              {reward.image_url ? <img src={reward.image_url} alt={reward.name} /> : <Icon name={rewardIcon(reward.name)} size={34} strokeWidth={1.75} />}
            </div>
            <div className="lf-rw-body">
              <div className="lf-rw-name">{reward.name}</div>
              {/* r6: บรรทัด 1 = คำอธิบาย · บรรทัด 2 = ป้ายเงื่อนไข · ของหมด = เหตุผลต่อท้าย */}
              {(copy.detail || copy.condition || outReason) && (
                <div className="lf-rw-copy">
                  {copy.detail && <span className="lf-rw-cond" title={copy.detail}>{copy.detail}</span>}
                  {copy.condition && <span className="lf-rw-condition">{copy.condition}</span>}
                  {outReason && <span className="lf-rw-reason">{outReason}</span>}
                </div>
              )}
            </div>
            {/* แถวล่างอยู่นอก .lf-rw-body (17 ก.ย. 69) — มือถือยังอยู่คอลัมน์ขวาเหมือนเดิม
                เดสก์ท็อปกินเต็มความกว้างการ์ดและติดขอบล่าง → แต้ม/ปุ่มตรงกันทุกใบในแถว */}
            <div className="lf-rw-foot">
              <div className="lf-rw-pts">
                <b>{reward.points_required.toLocaleString()}<small>แต้ม</small></b>
                {left !== null && left > 0 && left <= 10 && <span className="lf-rw-left">เหลือ {left.toLocaleString()} ชิ้น</span>}
              </div>
              {ok ? (
                <button type="button" className="lf-rw-btn" onClick={() => { setRedeemMsg(null); setConfirmId(reward.id); }} disabled={redeemingId !== null}>
                  แลก
                </button>
              ) : showPassiveStatus && st.kind === "mine" ? (
                <div className="lf-rw-status lf-rw-status--mine" title={`คำขอ #REQ-${st.req.id}`}><Icon name="hourglass" size={16} />รอรับของ</div>
              ) : showPassiveStatus && st.kind === "lack" ? (
                <div className="lf-rw-status lf-rw-status--lack">
                  <span>ขาดอีก {st.lacking.toLocaleString()} แต้ม</span>
                  <span className="lf-rw-progress" aria-label={`มี ${available.toLocaleString()} จาก ${reward.points_required.toLocaleString()} แต้ม`}><i style={{ width: `${progress}%` }} /></span>
                </div>
              ) : st.kind === "out" ? (
                <div className="lf-rw-pill">หมดชั่วคราว</div>
              ) : lockText ? (
                <div className="lf-rw-pill lf-rw-pill--lock"><Icon name="lock" size={16} strokeWidth={2.25} />{lockText}</div>
              ) : null}
            </div>
            {!msg && st.kind === "lack" && reservedPts > 0 && (summary?.points ?? 0) >= reward.points_required && (
              <div className="lf-rw-note">แต้มส่วนหนึ่งถูกจองไว้กับคำขอที่รอรับของ</div>
            )}
            {msg && <div className="lf-rw-extra">
              {msg && <div className={`lf-msg ${msg.ok ? "ok" : "err"}`} role={msg.ok ? "status" : "alert"}><i><Icon name={msg.ok ? "check" : "alert"} size={20} /></i><span>{msg.text}</span></div>}
            </div>}
          </div>
        );
      })}
      </div>
      </>}

      <details className="lf-card lf-rules">
        <summary>กติกาสะสมแต้มและแลกของรางวัล</summary>
        <div className="lf-rules-body">
          {rulesText(rewards.length ? Math.min(...rewards.map(r => r.points_required)) : null, valueExample(rewards)).map((item, i) => <div key={i} className="lf-rule"><i>{i + 1}</i><div>{item}</div></div>)}
        </div>
      </details>

      {confirmReward && !redeemSuccess && (
        <div className="lf-rw-modal" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget && redeemingId === null) { setConfirmId(null); setSheetError(null); }
        }}>
          <section className="lf-rw-sheet" role="dialog" aria-modal="true" aria-labelledby="lf-rw-confirm-title">
            <div className="lf-rw-sheet-handle" aria-hidden="true" />
            <div className="lf-rw-sheet-item">
              <div className="lf-rw-sheet-thumb">
                {confirmReward.image_url ? <img src={confirmReward.image_url} alt="" /> : <Icon name={rewardIcon(confirmReward.name)} size={34} strokeWidth={1.75} />}
              </div>
              <div>
                <span className="lf-rw-sheet-kicker">ยืนยันของรางวัล</span>
                <h2 id="lf-rw-confirm-title">{confirmReward.name}</h2>
                {confirmCopy?.detail && <p>{confirmCopy.detail}</p>}
                {confirmCopy?.condition && <span className="lf-rw-condition">{confirmCopy.condition}</span>}
              </div>
            </div>
            {/* r6: ส่งไม่สำเร็จ → ซ่อนตัวเลขหัก/คงเหลือ (ชวนเข้าใจว่าแต้มถูกหักไปแล้ว) */}
            {!sheetErr && (
              <div className="lf-rw-sheet-math">
                <span>หักจากแต้มที่ใช้ได้</span><b>−{confirmReward.points_required.toLocaleString()} แต้ม</b>
                <span>คงเหลือหลังแลก</span><b>{Math.max(0, available - confirmReward.points_required).toLocaleString()} แต้ม</b>
              </div>
            )}
            {sheetErr ? (
              <div className="lf-msg err lf-rw-sheet-err" role="alert">
                <i><Icon name="alert" size={20} /></i>
                <span>
                  <b>{sheetErr.kind === "auth" ? "หมดเวลาใช้งาน ยังไม่ได้ส่งคำขอ" : "ยังส่งคำขอไม่สำเร็จ"}</b>
                  <span className="lf-nw">แต้มยังไม่ถูกหักหรือจอง</span>{" "}
                  {sheetErr.kind === "auth"
                    ? <><span className="lf-nw">กดโหลดหน้าใหม่</span> <span className="lf-nw">แล้วกดแลกอีกครั้งค่ะ</span></>
                    : sheetErr.kind === "offline"
                      ? <><span className="lf-nw">เช็คอินเทอร์เน็ต</span> <span className="lf-nw">แล้วกดลองใหม่ค่ะ</span></>
                      : <><span className="lf-nw">กดลองใหม่</span> <span className="lf-nw">หรือโทร {SHOP_PHONE}</span></>}
                </span>
              </div>
            ) : (
              <p className="lf-rw-sheet-note">แต้มจะถูกจองไว้จนมารับของที่ร้าน เปลี่ยนใจแจ้งพนักงานให้ยกเลิกได้</p>
            )}
            <div className="lf-rw-sheet-actions">
              <button type="button" className="lf-btn lf-btn--ghost lf-btn--sm" onClick={() => { setConfirmId(null); setSheetError(null); }} disabled={redeemingId !== null}>ยกเลิก</button>
              {sheetErr?.kind === "auth" ? (
                // token หมดอายุ → ให้ LINE ออก token ใหม่ = โหลดหน้าใหม่ (เหมือนปุ่มลองใหม่ของจอแจ้งปัญหา)
                <button type="button" className="lf-rw-btn" onClick={() => window.location.reload()}>โหลดหน้าใหม่</button>
              ) : (
                <button type="button" className="lf-rw-btn" onClick={() => handleRedeem(confirmReward)} disabled={redeemingId !== null}>
                  {redeemingId === confirmReward.id ? "กำลังส่งคำขอ…" : sheetErr ? "ลองใหม่" : "ยืนยันแลก"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {redeemSuccess && (
        <div className="lf-rw-modal" role="presentation">
          <section className="lf-rw-sheet lf-rw-sheet--success" role="dialog" aria-modal="true" aria-labelledby="lf-rw-success-title">
            <div className="lf-rw-sheet-handle" aria-hidden="true" />
            <i className="lf-rw-success-icon"><Icon name="check" size={34} strokeWidth={2.5} /></i>
            <h2 id="lf-rw-success-title">ส่งคำขอแล้ว</h2>
            <div className="lf-rw-success-no">#REQ-{redeemSuccess.requestId}</div>
            {/* r5: ปิดแล้วเลขคำขอยังอยู่ในรายการ "คำขอที่รอรับของ" → ปุ่มหลักพาไปที่นั่น */}
            <p><span className="lf-nw">บอกเลขคำขอนี้กับพนักงานที่ร้าน</span> <span className="lf-nw">ดูเลขได้อีกในรายการคำขอของคุณ</span></p>
            <button type="button" className="lf-rw-btn" onClick={closeSuccess}>ดูคำขอของฉัน</button>
            <button type="button" className="lf-btn lf-btn--ghost lf-btn--sm lf-rw-success-card" onClick={() => (window.location.href = "/liff" + reviewQS())}>
              <Icon name="user" size={20} /> ไปที่บัตรสมาชิก
            </button>
          </section>
        </div>
      )}
    </Shell>
  );
}
