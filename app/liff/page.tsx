"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Shell, Loading } from "./ui";
import { isReview, reviewQS } from "./review";
import { getEffectiveTier, getNextTier, getTierFromPoints, monthsSince } from "./lib/tiers";
import type { ClientLink, Expiry, Member, MemberResponse, Profile, TxItem } from "./lib/types";
import { callApi, problemOf, SHOP_PHONE, type Problem } from "./lib/api";
import SignupCard from "./components/SignupCard";
import SignupSuccess from "./components/SignupSuccess";
import MemberForm from "./components/MemberForm";
import MemberCard from "./components/MemberCard";
import AlertNotes from "./components/AlertNotes";
import QuickActions from "./components/QuickActions";
import HistoryList, { type TxFilter } from "./components/HistoryList";
import TierPerks from "./components/TierPerks";
import { ProblemScreen } from "./components/ProblemNotice";
import { saveCard } from "./lib/cardCache";
import "./styles/content.css";
import { BAHT_PER_POINT, birthdayPointsOf, daysToBirthday } from "./lib/perks";

// หน้าสมาชิก LINE — สมัคร / บัตรสมาชิก / ประวัติแต้ม
// ไฟล์นี้เหลือแค่ state + โหลดข้อมูล + ประกอบคอมโพเนนต์ (คอมโพเนนต์ย่อยอยู่ใน components/)
//
// 16 ก.ย. 69 — ระบบล่ม ≠ ยังไม่สมัคร:
//   จอสมัครขึ้นได้เฉพาะเมื่อ API ตอบ registered:false + code:"NOT_REGISTERED" เท่านั้น
//   อย่างอื่นที่ไม่ใช่ "สมาชิก" หรือ "ยังไม่สมัคร" → จอแจ้งปัญหา (ProblemScreen) พร้อมปุ่มลองใหม่
const HISTORY_ID = "lf-history";
const DEFAULT_REVIEW_PROFILE: Profile = { userId: "review", displayName: "ผู้ตรวจ", pictureUrl: "" };

function registerErrorText(p: Problem): string {
  if (["PHONE_TAKEN", "INVALID_PHONE", "BAD_REQUEST"].includes(p.code) && p.serverMessage) return p.serverMessage;
  if (p.kind === "auth") return "หมดเวลาใช้งาน กรุณาปิดหน้านี้แล้วเปิดใหม่จาก LINE";
  if (p.kind === "offline") return "ส่งข้อมูลไม่ได้ อินเทอร์เน็ตอาจหลุด เช็คสัญญาณแล้วกดใหม่อีกครั้ง";
  return `ระบบขัดข้องชั่วคราว ยังบันทึกไม่ได้ กรุณากดใหม่อีกครั้ง หรือโทร ${SHOP_PHONE}`;
}

export default function LiffPage() {
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [member, setMember]       = useState<Member | null>(null);
  const [expiry, setExpiry]       = useState<Expiry | null>(null);
  const [expiryUnavailable, setExpiryUnavailable] = useState(false);
  const [link, setLink]           = useState<ClientLink | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [problem, setProblem]     = useState<Problem | null>(null);
  const [retrying, setRetrying]   = useState(false);
  const [phone, setPhone]         = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [company, setCompany]     = useState("");
  const [birthday, setBirthday]   = useState("");
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");
  const [editing, setEditing]     = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [txList, setTxList]       = useState<TxItem[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txProblem, setTxProblem] = useState<Problem | null>(null);
  const [txOpen, setTxOpen]       = useState(false);
  const [token, setToken]         = useState("");   // LIFF access token — ใช้ยืนยันตัวตนกับ API
  const [txFilter, setTxFilter]   = useState<TxFilter>("all");
  const liffReady = useRef(false);
  const scrollToHistory = useRef(false);   // กดเปิดประวัติ → เลื่อนไปที่รายการเลย ไม่ต้องไถผ่านบัตร

  /** รับคำตอบ /api/member แล้วตัดสินว่าเป็นจอไหน — ไม่มีทางตกไปจอสมัครเพราะระบบล่ม */
  const fetchMember = useCallback(async (tok: string) => {
    const r = await callApi<MemberResponse>("/api/member" + reviewQS(), { headers: { Authorization: `Bearer ${tok}` } });
    if (!r.ok) { setProblem(r.problem); return; }
    const d = r.data;
    if (isReview()) setProfile(d.profile ?? DEFAULT_REVIEW_PROFILE);
    if (d.registered === false && d.code === "NOT_REGISTERED") {
      setProblem(null); setRegistered(false);
      return;
    }
    if (d.registered === true && d.user) {
      setProblem(null); setRegistered(true);
      setMember(d.user);
      setExpiry(d.expiry ?? null);
      setExpiryUnavailable(!!d.expiryUnavailable);
      setLink(d.link ?? null);
      return;
    }
    // ตอบ 200 แต่รูปแบบไม่ครบ — ไม่เดาว่าเป็นใคร
    setProblem(problemOf("SERVER_ERROR"));
  }, []);

  const boot = useCallback(async () => {
    // โหมดรีวิว — ข้ามการล็อกอิน LINE ทั้งหมด ใช้ข้อมูลจำลองจากเซิร์ฟเวอร์ (ปิดตายบน production)
    if (isReview()) {
      if (!liffReady.current) { setProfile(DEFAULT_REVIEW_PROFILE); liffReady.current = true; }
      await fetchMember("review");
      return;
    }
    let tok = token;
    if (!liffReady.current) {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const p = await liff.getProfile();
        setProfile({ userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl ?? "" });
        // ตัวตนส่งเป็น LIFF access token ให้เซิร์ฟเวอร์ตรวจกับ LINE เอง (ไม่ส่ง userId ดิบ ๆ)
        tok = liff.getAccessToken() ?? "";
        setToken(tok);
        try { sessionStorage.setItem("liff_token", tok); } catch {}
        liffReady.current = true;
      } catch {
        // เปิดนอก LINE / LIFF เริ่มไม่ได้ — ให้ปิดแล้วเปิดใหม่จากเมนู LINE
        setProblem({ kind: "auth", code: "LIFF_INIT", serverMessage: null });
        return;
      }
    }
    await fetchMember(tok);
  }, [fetchMember, token]);

  useEffect(() => {
    boot().finally(() => setLoading(false));
    // โหลดครั้งเดียวตอนเปิดหน้า
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function retry() {
    // token หมดอายุ → ต้องให้ LINE ออก token ใหม่ = โหลดหน้าใหม่ทั้งหน้า
    if (problem?.kind === "auth") { window.location.reload(); return; }
    setRetrying(true);
    try { await boot(); } finally { setRetrying(false); }
  }

  // จำบัตรล่าสุดไว้ในเครื่อง — วันระบบล่มยังมีข้อมูลให้โชว์พนักงาน (ดู components/ProblemNotice)
  useEffect(() => {
    if (!member || registered !== true) return;
    const t = getEffectiveTier(member.total_earned ?? 0, member.points ?? 0, member.last_purchase_at ?? null);
    saveCard({
      name: member.first_name ? `${member.first_name} ${member.last_name ?? ""}`.trim() : (member.display_name ?? ""),
      phone: member.phone?.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3") ?? "",
      tier: t.name,
      points: link?.status === "pending" ? 0 : (member.points ?? 0),
    });
  }, [member, registered, link]);

  useEffect(() => {
    if (!txOpen || !scrollToHistory.current) return;
    // ระหว่างโหลด หน้ายังสั้น เลื่อนไม่ถึง → เลื่อนอีกครั้งตอนรายการมาแล้ว
    if (!txLoading) scrollToHistory.current = false;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => document.getElementById(HISTORY_ID)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  }, [txOpen, txLoading]);

  async function loadTransactions() {
    setTxOpen(true);
    setTxLoading(true);
    setTxProblem(null);
    try {
      const r = await callApi<{ transactions?: TxItem[] }>("/api/member/transactions" + reviewQS(), { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok && Array.isArray(r.data.transactions)) setTxList(r.data.transactions);
      else setTxProblem(r.ok ? problemOf("SERVER_ERROR") : r.problem);   // ห้ามตีความว่า "ยังไม่มีรายการ"
    } finally { setTxLoading(false); }
  }

  async function handleRegister() {
    if (!firstName.trim())          { setError("กรุณากรอกชื่อ"); return; }
    if (!lastName.trim())           { setError("กรุณากรอกนามสกุล"); return; }
    if (!/^0\d{9}$/.test(phone))    { setError("เบอร์มือถือไม่ถูกต้อง (10 หลัก)"); return; }
    if (!birthday)                  { setError("กรุณาเลือกวันเกิด"); return; }
    setSubmitting(true); setError("");
    try {
      const r = await callApi<{ success?: boolean; user?: Member; link?: ClientLink | null }>("/api/member" + reviewQS(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          phone,
          displayName: profile?.displayName ?? "",
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          company: company.trim() || null,
          birthday,
        }),
      });
      if (!r.ok) { setError(registerErrorText(r.problem)); return; }
      if (!r.data.success || !r.data.user) { setError(registerErrorText(problemOf("SERVER_ERROR"))); return; }
      const wasNew = !registered;
      setRegistered(true);
      setMember(r.data.user);
      // สมัครเสร็จ → เซิร์ฟเวอร์ส่งสถานะการผูกมาด้วย → ขึ้นจอ "รอพนักงานยืนยันตัวตน" ทันที
      if (r.data.link !== undefined) setLink(r.data.link ?? null);
      if (wasNew) { setExpiry(null); setExpiryUnavailable(false); }
      if (wasNew) setSignupComplete(true);
      setEditing(false);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    } finally { setSubmitting(false); }
  }

  // props ของฟอร์ม — ชุดเดียวใช้ทั้งจอสมัครและจอแก้ไข
  const formProps = {
    firstName, lastName, phone, birthday, company,
    onFirstName: setFirstName,
    onLastName: setLastName,
    onPhone: setPhone,
    onBirthday: setBirthday,
    onCompany: setCompany,
    error, submitting,
    onSubmit: handleRegister,
    onCancel: () => { setEditing(false); setError(""); },
  };

  /* ── Loading ── */
  if (loading) return <Loading />;

  /* ── มีปัญหา (ระบบล่ม / token หมดอายุ / เน็ตหลุด) — ห้ามตกไปจอสมัคร ── */
  if (problem) return (
    <ProblemScreen sub="บัตรสมาชิกสะสมแต้ม" what="บัตรสมาชิก" problem={problem} onRetry={retry} retrying={retrying} />
  );

  /* ── สมัครสมาชิก — เฉพาะ registered:false ที่เซิร์ฟเวอร์ยืนยันแล้วเท่านั้น ── */
  if (registered === false) return <SignupCard profile={profile} form={formProps} />;

  /* ── ยังไม่รู้สถานะ (ไม่ควรเกิด) — ถือเป็นปัญหา ไม่ใช่จอสมัคร ── */
  if (registered !== true) return (
    <ProblemScreen sub="บัตรสมาชิกสะสมแต้ม" what="บัตรสมาชิก" problem={problemOf("SERVER_ERROR")} onRetry={retry} retrying={retrying} />
  );

  /* ── สมัครสำเร็จ — ให้ลูกค้าเห็นผลสำเร็จและขั้นต่อไปก่อนบัตรรอยืนยัน ── */
  if (signupComplete) return (
    <SignupSuccess
      name={member?.first_name ?? firstName}
      phone={(member?.phone ?? phone).replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}
      onContinue={() => setSignupComplete(false)}
    />
  );

  /* ── แก้ไขข้อมูล ── */
  if (editing) return (
    <Shell sub="แก้ไขข้อมูลสมาชิก" layout="form">
      <div className="lf-card">
        <h2 className="lf-title">แก้ไขข้อมูล</h2>
        <p className="lf-sub">ชื่อ วันเกิด และบริษัท แก้ได้เลย</p>
        <MemberForm isEdit {...formProps} />
      </div>
    </Shell>
  );

  /* ── บัตรสมาชิก ── */
  const totalEarned = member?.total_earned ?? 0;
  const points = member?.points ?? 0;
  const lastPurchaseAt = member?.last_purchase_at ?? null;
  const tier = getEffectiveTier(totalEarned, points, lastPurchaseAt);
  const baseTier = getTierFromPoints(totalEarned);
  const isInactive = tier.name !== baseTier.name;
  const months = monthsSince(lastPurchaseAt);
  // เตือนล่วงหน้า 3 เดือนก่อนครบ 1 ปี (ผู้ตรวจ c1: ระดับลดโดยไม่ได้บอกล่วงหน้า) — กติกา 1 ปีเองไม่ได้เปลี่ยน
  const isNearDrop = months !== null && months >= 9 && months < 12;
  const nextTier = getNextTier(tier);
  // แถบ = ยอดสะสม ÷ เกณฑ์ระดับถัดไป (0 ถึงเกณฑ์ถัดไป) ให้ตรงกับตัวเลข "X / Y" บนบัตร
  const progress = nextTier && nextTier.min > 0 ? Math.max(0, Math.min(100, (totalEarned / nextTier.min) * 100)) : 100;
  const name = member?.first_name ? `${member.first_name} ${member.last_name}` : (profile?.displayName ?? member?.display_name ?? "");
  const formattedPhone = member?.phone?.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3") ?? "";
  const pendingLink = link?.status === "pending" ? link : null;
  // ผูกแล้วแต่ยังไม่เคยได้แต้ม = เพิ่งยืนยันตัวตน → แสดงข้อความยินดี (เดิมป้ายเตือนหายไปเงียบ ๆ)
  const justLinked = link?.status === "linked" && totalEarned === 0 && points === 0 && !lastPurchaseAt ? link : null;
  const birthdayIn = daysToBirthday(member?.birthday);
  // cron วันเกิดคิดจากระดับที่ใช้อยู่ (getEffectiveTier) ไม่ใช่ระดับตามยอดสะสม
  const expectedBirthdayBonus = birthdayIn === 0 ? birthdayPointsOf(tier.name) : 0;
  const birthdayBonus = expectedBirthdayBonus > 0 && points - totalEarned === expectedBirthdayBonus ? expectedBirthdayBonus : 0;

  return (
    <Shell sub="บัตรสมาชิกสะสมแต้ม" layout="split">
      {/* มือถือ: คอลัมน์เดียว เรียงตาม order ใน liff.css → บัตร · ปุ่มลัด · คำเตือน · ประวัติ · สิทธิ์ · กติกา
          เดสก์ท็อป (r5 ผู้ตรวจ: คอลัมน์ขวาจบก่อนซ้ายราว 500px): ซ้าย = บัตร+ปุ่มลัด · ขวา = คำเตือน+ประวัติ+สิทธิ์+กติกา */}
      <div className="lf-col lf-col--main">
        <MemberCard
          tier={tier} nextTier={nextTier} totalEarned={totalEarned} points={points} progress={progress}
          name={name} formattedPhone={formattedPhone} member={member} profile={profile} pendingLink={pendingLink}
          realTier={isInactive ? baseTier : null}
          birthdayBonus={birthdayBonus}
        />
        <QuickActions
          txLoading={txLoading} txOpen={txOpen} locked={!!pendingLink}
          onToggleHistory={() => { if (!txOpen) { scrollToHistory.current = true; loadTransactions(); } else setTxOpen(false); }}
          onEdit={() => {
            setFirstName(member?.first_name ?? ""); setLastName(member?.last_name ?? ""); setPhone(member?.phone ?? "");
            setCompany(member?.company ?? ""); setBirthday(member?.birthday ? member.birthday.substring(0, 10) : ""); setError(""); setEditing(true);
          }}
        />
      </div>

      <div className="lf-col lf-col--side">
        <AlertNotes
          isInactive={isInactive} isNearDrop={isNearDrop} tier={tier} baseTier={baseTier} expiry={expiry}
          totalEarned={totalEarned} lastPurchaseAt={lastPurchaseAt}
          expiryUnavailable={expiryUnavailable} justLinked={justLinked} birthdayIn={pendingLink ? null : birthdayIn}
          onViewExpiring={() => { if (!txOpen) { scrollToHistory.current = true; loadTransactions(); } setTxFilter("expire"); }}
        />
        {txOpen && (
          <HistoryList
            id={HISTORY_ID}
            txList={txList} txFilter={txFilter} onFilter={setTxFilter}
            loading={txLoading} problem={txProblem} onRetry={loadTransactions}
          />
        )}
        {/* เปิดประวัติอยู่ → บนมือถือซ่อนการ์ดสิทธิ์ (หน้ายาวเกิน) · ปิดประวัติแล้วกลับมา */}
        <TierPerks tier={isInactive ? baseTier : tier} currentTier={tier} restore={isInactive} hideOnMobile={txOpen} showHow={!txOpen} pending={!!pendingLink} />
        {/* ท้ายหน้าอยู่ท้ายคอลัมน์ขวา → เดสก์ท็อปตรงแนวคอลัมน์ (r5) · มือถือยังอยู่ท้ายสุดด้วย order */}
        <div className="lf-foot">
          {/* บรรทัดกติกาบรรทัดเดียว — "ยื่นบัตร/บอกเบอร์" อยู่บนบัตรที่เดียว · ตอนรอยืนยันก็ไม่บอกว่าแต้มเข้าเอง */}
          <div><span className="lf-nw">ซื้อทุก {BAHT_PER_POINT} บาท = 1 แต้ม</span> · <span className="lf-nw">แต้มใช้ได้ 1 ปี</span></div>
        </div>
      </div>
    </Shell>
  );
}
