"use client";
import { useEffect, useState } from "react";
import { Shell, Loading } from "./ui";
import Icon from "./components/Icon";
import { isReview, reviewQS } from "./review";
import { getEffectiveTier, getNextTier, getTierFromPoints, monthsSince } from "./lib/tiers";
import type { Expiry, Member, Profile, TxItem } from "./lib/types";
import SignupCard from "./components/SignupCard";
import MemberForm from "./components/MemberForm";
import MemberCard from "./components/MemberCard";
import AlertNotes from "./components/AlertNotes";
import QuickActions from "./components/QuickActions";
import HistoryList, { type TxFilter } from "./components/HistoryList";
import TierPerks from "./components/TierPerks";

// หน้าสมาชิก LINE — สมัคร / บัตรสมาชิก / ประวัติแต้ม · ตรรกะเดิม (16 ก.ย. 69 ผ่าเป็นคอมโพเนนต์ย่อยใน components/ หน้าตาเท่าเดิม)
// ไฟล์นี้เหลือแค่ state + โหลดข้อมูล + ประกอบคอมโพเนนต์
export default function LiffPage() {
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [member, setMember]       = useState<Member | null>(null);
  const [expiry, setExpiry]       = useState<Expiry | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [phone, setPhone]         = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [company, setCompany]     = useState("");
  const [birthday, setBirthday]   = useState("");
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");
  const [editing, setEditing]     = useState(false);
  const [txList, setTxList]       = useState<TxItem[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txOpen, setTxOpen]       = useState(false);
  const [token, setToken]         = useState("");   // LIFF access token — ใช้ยืนยันตัวตนกับ API
  const [txFilter, setTxFilter]   = useState<TxFilter>("all");

  useEffect(() => {
    (async () => {
      try {
        // โหมดรีวิว — ข้ามการล็อกอิน LINE ทั้งหมด ใช้ข้อมูลจำลองจากเซิร์ฟเวอร์ (ปิดตายบน production)
        if (isReview()) {
          const res = await fetch("/api/member" + reviewQS());
          const data = await res.json();
          setProfile(data.profile ?? { userId: "review", displayName: "ผู้ตรวจ", pictureUrl: "" });
          setRegistered(data.registered);
          if (data.registered) { setMember(data.user); setExpiry(data.expiry ?? null); }
          setLoading(false);
          return;
        }

        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
        if (!liff.isLoggedIn()) { liff.login(); return; }

        const p = await liff.getProfile();
        setProfile({ userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl ?? "" });
        // ตัวตนส่งเป็น LIFF access token ให้เซิร์ฟเวอร์ตรวจกับ LINE เอง (ไม่ส่ง userId ดิบ ๆ อีกแล้ว)
        const tok = liff.getAccessToken() ?? "";
        setToken(tok);
        sessionStorage.setItem("liff_token", tok);

        const res  = await fetch("/api/member", { headers: { Authorization: `Bearer ${tok}` } });
        const data = await res.json();
        setRegistered(data.registered);
        if (data.registered) { setMember(data.user); setExpiry(data.expiry ?? null); }
      } catch {
        setError("กรุณาเปิดใน LINE เท่านั้นค่ะ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadTransactions() {
    if (!profile) return;
    setTxLoading(true);
    try {
      const res  = await fetch("/api/member/transactions" + reviewQS(), { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setTxList(data.transactions ?? []);
      setTxOpen(true);
    } finally { setTxLoading(false); }
  }

  async function handleRegister() {
    if (!firstName.trim())          { setError("กรุณากรอกชื่อ"); return; }
    if (!lastName.trim())           { setError("กรุณากรอกนามสกุล"); return; }
    if (!/^0\d{9}$/.test(phone))    { setError("เบอร์มือถือไม่ถูกต้อง (10 หลัก)"); return; }
    if (!birthday)                  { setError("กรุณาเลือกวันเกิด"); return; }
    setSubmitting(true); setError("");
    try {
      const res  = await fetch("/api/member" + reviewQS(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          phone,
          displayName: profile!.displayName,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          company: company.trim() || null,
          birthday,
        }),
      });
      const data = await res.json();
      if (data.success) { setRegistered(true); setMember(data.user); setEditing(false); }
      else setError(data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่");   // 409 = เบอร์เป็นของคนอื่น/ผูก LINE อื่น — บอกลูกค้าตรง ๆ
    } catch { setError("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    finally { setSubmitting(false); }
  }

  // props ของฟอร์ม — ชุดเดียวใช้ทั้งจอสมัครและจอแก้ไข (เหมือนตอนที่ยังเป็นฟังก์ชัน form(isEdit) ในไฟล์เดียว)
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

  /* ── Error (ไม่มี profile) ── */
  if (error && !profile) return (
    <Shell sub="ระบบสมาชิกสะสมแต้ม" short>
      <div className="lf-card lf-center"><i><Icon name="alert" size={40} /></i>{error}</div>
    </Shell>
  );

  /* ── สมัครสมาชิก ── */
  if (!registered) return <SignupCard profile={profile} form={formProps} />;

  /* ── แก้ไขข้อมูล ── */
  if (registered && editing) return (
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
  const isNearDrop = months !== null && months >= 11 && months < 12;
  const nextTier = getNextTier(tier);
  const progress = nextTier ? Math.min(100, ((totalEarned - tier.min) / (nextTier.min - tier.min)) * 100) : 100;
  const name = member?.first_name ? `${member.first_name} ${member.last_name}` : (profile?.displayName ?? member?.display_name ?? "");
  const formattedPhone = member?.phone?.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3") ?? "";

  return (
    <Shell sub="บัตรสมาชิกสะสมแต้ม" layout="split">
      {/* มือถือ: คอลัมน์เดียว เรียงตาม order ใน liff.css → บัตร · ปุ่มลัด · คำเตือน · ประวัติ · สิทธิ์ · กติกา
          เดสก์ท็อป: ซ้าย = บัตร+ปุ่มลัด+คำเตือน (ของที่ต้องเห็นก่อน) · ขวา = ประวัติ+สิทธิ์+กติกา
          (ผู้ตรวจ r5: ซ้ายมีบัตรก้อนเดียวแล้วว่าง ขวายาวเกิน → สองคอลัมน์ไม่สมดุล) */}
      <div className="lf-col lf-col--main">
        <MemberCard
          tier={tier} nextTier={nextTier} totalEarned={totalEarned} points={points} progress={progress}
          name={name} formattedPhone={formattedPhone} member={member} profile={profile}
        />
        <QuickActions
          txLoading={txLoading} txOpen={txOpen}
          onToggleHistory={() => { if (!txOpen) loadTransactions(); else setTxOpen(false); }}
          onEdit={() => {
            setFirstName(member?.first_name ?? ""); setLastName(member?.last_name ?? ""); setPhone(member?.phone ?? "");
            setCompany(member?.company ?? ""); setBirthday(member?.birthday ? member.birthday.substring(0, 10) : ""); setError(""); setEditing(true);
          }}
        />
        <AlertNotes
          isInactive={isInactive} isNearDrop={isNearDrop} tier={tier} baseTier={baseTier} months={months} expiry={expiry} points={points}
          onViewExpiring={() => { if (!txOpen) loadTransactions(); setTxFilter("expire"); setTxOpen(true); }}
        />
      </div>

      <div className="lf-col lf-col--side">
        {txOpen &&<HistoryList txList={txList} txFilter={txFilter} onFilter={setTxFilter} />}
        {/* เปิดประวัติอยู่ → บนมือถือซ่อนการ์ดสิทธิ์ (หน้ายาวเกิน ผู้ตรวจ r5) · ปิดประวัติแล้วกลับมา */}
        <TierPerks tier={isInactive ? baseTier : tier} restore={isInactive} hideOnMobile={txOpen} />
        <div className="lf-foot">
          {/* กติกา 3 ข้อ บรรทัดละข้อ — ไม่ต่อกันด้วย · ที่ตัดบรรทัดกลางข้อ */}
          <div>ซื้อทุก 100 บาท = 1 แต้ม</div>
          <div>แต้มใช้ได้ 1 ปี นับจากวันที่ได้</div>
          <div className="lf-foot-key"><span className="lf-nw">ซื้อของทุกครั้ง</span> <span className="lf-nw">บอกเบอร์โทรที่แคชเชียร์นะคะ</span></div>
        </div>
      </div>
    </Shell>
  );
}
