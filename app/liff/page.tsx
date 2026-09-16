"use client";
import { useEffect, useState } from "react";
import { Shell, Loading, Field } from "./ui";
import { isReview, reviewQS } from "./review";

// หน้าสมาชิก LINE — สมัคร / บัตรสมาชิก / ประวัติแต้ม · ตรรกะเดิม (14 ก.ย. 69 รื้อเฉพาะหน้าตา — สไตล์อยู่ liff.css, ชิ้นส่วนร่วม ui.tsx)
interface TxItem {
  id: number;
  purchase_amount: number;
  points_earned: number;
  type: string;
  note: string | null;
  created_at: string;
  expires_at: string | null;
}

interface Profile {
  userId: string;
  displayName: string;
  pictureUrl: string;
}

interface Member {
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

interface Expiry {
  earliest_expiry: string | null;
  expiring_points: number | null;
}

const TIERS = [
  { name: "Diamond",  emoji: "💎", min: 10000, cardGrad: "linear-gradient(135deg, #0D47A1 0%, #1565C0 45%, #82B1FF 100%)" },
  { name: "Platinum", emoji: "🔱", min: 5000,  cardGrad: "linear-gradient(135deg, #37474F 0%, #607D8B 45%, #CFD8DC 100%)" },
  { name: "Gold",     emoji: "🥇", min: 2000,  cardGrad: "linear-gradient(135deg, #F57F17 0%, #FFD600 50%, #F9A825 100%)" },
  { name: "Silver",   emoji: "🥈", min: 500,   cardGrad: "linear-gradient(135deg, #37474F 0%, #78909C 50%, #B0BEC5 100%)" },
  { name: "Bronze",   emoji: "🥉", min: 100,   cardGrad: "linear-gradient(135deg, #6D4C41 0%, #A1887F 50%, #D7A27C 100%)" },
  { name: "Welcome",  emoji: "👋", min: 0,     cardGrad: "linear-gradient(135deg, #1B3B7A 0%, #2B5FB8 55%, #5C8EE6 100%)" },
];

function getTierFromPoints(points: number) {
  return TIERS.find(t => points >= t.min) ?? TIERS[TIERS.length - 1];
}

function getEffectiveTier(totalEarned: number, currentPoints: number, lastPurchaseAt: string | null) {
  const isActive = lastPurchaseAt !== null &&
    Date.now() - new Date(lastPurchaseAt).getTime() < 365 * 24 * 60 * 60 * 1000;
  return getTierFromPoints(isActive ? totalEarned : currentPoints);
}

function getNextTier(tier: typeof TIERS[number]) {
  const idx = TIERS.findIndex(t => t.name === tier.name);
  return idx > 0 ? TIERS[idx - 1] : null;
}

function monthsSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (30 * 24 * 60 * 60 * 1000));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

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
  const [txFilter, setTxFilter]   = useState<"all"|"earn"|"redeem"|"expire">("all");

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

  /* ── Loading ── */
  if (loading) return <Loading />;

  /* ── Error (ไม่มี profile) ── */
  if (error && !profile) return (
    <Shell sub="ระบบสมาชิกสะสมแต้ม" short>
      <div className="lf-card lf-center" style={{ marginTop: 16 }}><i>⚠️</i>{error}</div>
    </Shell>
  );

  /* ── ฟอร์ม (ใช้ทั้งสมัครและแก้ไข) ── */
  const form = (isEdit: boolean) => (
    <div className="lf-form">
      <div className="lf-row">
        <Field label="ชื่อ">
          <input className="lf-input" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="สมชาย" autoComplete="given-name" />
        </Field>
        <Field label="นามสกุล">
          <input className="lf-input" type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="ใจดี" autoComplete="family-name" />
        </Field>
      </div>
      <Field label="เบอร์มือถือ" hint={isEdit ? "เปลี่ยนเบอร์ได้ที่ร้าน — พนักงานจะแก้ให้ค่ะ" : "ใช้ยืนยันตัวตนและรับแต้มจากบิลที่ร้าน"}>
        <input className="lf-input lf-input--num" type="tel" inputMode="numeric" maxLength={10} value={phone} readOnly={isEdit}
          onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="08X XXX XXXX" autoComplete="tel" />
      </Field>
      <Field label="วันเกิด" hint="รับคูปองวันเกิดทุกปี 🎂">
        <input className="lf-input" type="date" value={birthday} onChange={e => setBirthday(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
      </Field>
      <Field label="บริษัท / ร้านค้า" optional>
        <input className="lf-input" type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="เช่น หจก. ก่อสร้างดี" autoComplete="organization" />
      </Field>
      {error && <div className="lf-alert lf-alert--err"><span>⚠️</span><span>{error}</span></div>}
      <button className="lf-btn lf-btn--primary" onClick={handleRegister} disabled={submitting}>
        {submitting ? "กำลังบันทึก…" : isEdit ? "บันทึกข้อมูล" : "สมัครสมาชิกฟรี"}
      </button>
      {isEdit && <button className="lf-btn lf-btn--ghost" onClick={() => { setEditing(false); setError(""); }}>ยกเลิก</button>}
    </div>
  );

  /* ── สมัครสมาชิก ── */
  if (!registered) return (
    <Shell sub="สมัครสมาชิก · สะสมแต้ม · รับส่วนลด">
      <div className="lf-card">
        <div className="lf-who">
          {profile?.pictureUrl ? <img src={profile.pictureUrl} alt="" /> : <div className="ph">👤</div>}
          <div><b>สวัสดีค่ะ {profile?.displayName}</b><span>สมัครสมาชิกฟรี ใช้เวลาไม่ถึง 1 นาที</span></div>
        </div>
        {form(false)}
        <div className="lf-perks">
          <div className="lf-perk"><i>⭐</i><b>สะสมแต้ม</b><span>ทุก 100 บาท = 1 แต้ม</span></div>
          <div className="lf-perk"><i>🏷️</i><b>ส่วนลดสมาชิก</b><span>ตามระดับที่ร้าน</span></div>
          <div className="lf-perk"><i>🎁</i><b>แลกของรางวัล</b><span>+ คูปองวันเกิด</span></div>
        </div>
        <div className="lf-ladder">
          {[...TIERS].reverse().map(t => <div key={t.name}><i>{t.emoji}</i><b>{t.name}</b>{t.min > 0 ? `${t.min.toLocaleString()} แต้ม` : "เริ่มต้น"}</div>)}
        </div>
      </div>
      <div className="lf-foot">สมัครแล้วบอกเบอร์โทรที่แคชเชียร์ทุกครั้งที่ซื้อ แต้มจะเข้าอัตโนมัติค่ะ</div>
    </Shell>
  );

  /* ── แก้ไขข้อมูล ── */
  if (registered && editing) return (
    <Shell sub="แก้ไขข้อมูลสมาชิก">
      <div className="lf-card">
        <h2 className="lf-title">แก้ไขข้อมูล</h2>
        <p className="lf-sub" style={{ marginBottom: 16 }}>ชื่อ วันเกิด และบริษัท แก้ได้เลย</p>
        {form(true)}
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
  const filtered = txFilter === "all" ? txList : txList.filter(t => t.type === txFilter);

  return (
    <Shell sub="บัตรสมาชิกสะสมแต้ม">
      {/* บัตร */}
      <div className="lf-mcard" style={{ background: tier.cardGrad }}>
        <div className="lf-mcard-top">
          <div className="lf-mcard-label">MEMBER CARD</div>
          <div className="lf-tier">{tier.emoji} {tier.name}</div>
        </div>
        <div className="lf-mcard-who">
          {profile?.pictureUrl ? <img src={profile.pictureUrl} alt="" /> : <div className="ph">👤</div>}
          <div style={{ minWidth: 0 }}>
            <div className="lf-mcard-name">{name}</div>
            {member?.company && <div className="lf-mcard-meta">🏢 {member.company}</div>}
            <div className="lf-mcard-meta">📞 {formattedPhone}</div>
          </div>
        </div>
        <div className="lf-mcard-points">
          <div>
            <div className="lf-points-lbl">แต้มสะสม</div>
            <div className="lf-points-num">{points.toLocaleString()}</div>
          </div>
          {member?.birthday && (
            <div className="lf-chip">🎂 {new Date(member.birthday).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</div>
          )}
        </div>
        {nextTier ? (
          <div className="lf-prog">
            <div className="lf-prog-txt">
              <span>{tier.emoji} {tier.name}</span>
              <span>อีก {(nextTier.min - totalEarned).toLocaleString()} แต้ม → {nextTier.emoji} {nextTier.name}</span>
            </div>
            <div className="lf-prog-bar"><i style={{ width: `${progress}%` }} /></div>
          </div>
        ) : (
          <div className="lf-prog" style={{ textAlign: "center", fontSize: 12.5, opacity: .9 }}>🏆 ระดับสูงสุดแล้ว ขอบคุณที่ไว้วางใจ DK ค่ะ</div>
        )}
        <div className="lf-mcard-foot">สมาชิกตั้งแต่ {member?.created_at ? formatDate(member.created_at) : "-"}</div>
      </div>

      {/* เตือน */}
      {isInactive && (
        <div className="lf-note lf-note--danger">
          <b>🔴 ระดับลดชั่วคราว</b>
          ระดับจริงของคุณคือ {baseTier.emoji} <strong>{baseTier.name}</strong> — กลับมาซื้อสินค้าครั้งเดียว ระดับกลับมาทันที ไม่ต้องสะสมใหม่ค่ะ
        </div>
      )}
      {!isInactive && isNearDrop && (
        <div className="lf-note lf-note--warn">
          <b>⚠️ ระดับใกล้ลด</b>
          ไม่ได้ซื้อสินค้ามา {months} เดือน อีก {12 - (months ?? 0)} เดือน ระดับ {tier.emoji} <strong>{tier.name}</strong> จะลดลง — แวะมาซื้อเพื่อรักษาระดับนะคะ 🛒
        </div>
      )}
      {expiry?.earliest_expiry && (expiry.expiring_points ?? 0) > 0 && (() => {
        const expDate = formatDate(expiry.earliest_expiry);
        const daysLeft = Math.ceil((new Date(expiry.earliest_expiry).getTime() - Date.now()) / 86400000);
        const urgent = daysLeft <= 30;
        return (
          <div className={`lf-note ${urgent ? "lf-note--danger" : "lf-note--warn"}`}>
            <div className="lf-note-row">
              <div>
                <b>{(expiry.expiring_points ?? 0).toLocaleString()} แต้ม จะหมดอายุ</b>
                {expDate}{daysLeft <= 90 ? ` (อีก ${daysLeft} วัน)` : ""}
              </div>
              <button className="lf-link" onClick={() => { if (!txOpen) loadTransactions(); setTxFilter("expire"); setTxOpen(true); }}>ดูรายการ ›</button>
            </div>
          </div>
        );
      })()}

      {/* ปุ่มลัด */}
      <div className="lf-actions" style={{ marginTop: 14 }}>
        <button className="lf-action lf-action--accent" onClick={() => (window.location.href = "/liff/rewards" + reviewQS())}>
          <i>🎁</i><b>ของรางวัล</b><span>แลกแต้ม</span>
        </button>
        <button className="lf-action" onClick={() => { if (!txOpen) loadTransactions(); else setTxOpen(false); }}>
          <i>{txLoading ? "⏳" : "📋"}</i><b>{txOpen ? "ซ่อนประวัติ" : "ประวัติแต้ม"}</b><span>ได้รับ / ใช้ไป</span>
        </button>
        <button className="lf-action" onClick={() => {
          setFirstName(member?.first_name ?? ""); setLastName(member?.last_name ?? ""); setPhone(member?.phone ?? "");
          setCompany(member?.company ?? ""); setBirthday(member?.birthday ? member.birthday.substring(0, 10) : ""); setError(""); setEditing(true);
        }}>
          <i>✏️</i><b>แก้ไขข้อมูล</b><span>ชื่อ / วันเกิด</span>
        </button>
      </div>

      {/* ประวัติ */}
      {txOpen && (
        <div className="lf-card" style={{ marginTop: 12 }}>
          <div className="lf-tabs">
            {([{ key: "all", label: "ทั้งหมด" }, { key: "earn", label: "ได้รับ" }, { key: "redeem", label: "ใช้แล้ว" }, { key: "expire", label: "หมดอายุ" }] as const).map(tab => (
              <button key={tab.key} className={`lf-tab${txFilter === tab.key ? " on" : ""}`} onClick={() => setTxFilter(tab.key)}>{tab.label}</button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="lf-empty">ยังไม่มีรายการในหมวดนี้</div>
          ) : filtered.map(t => {
            const isEarn = t.type === "earn", isRedeem = t.type === "redeem";
            const color = isEarn ? "#1E8E3E" : isRedeem ? "#C62828" : "#8A94A6";
            return (
              <div key={t.id} className="lf-tx">
                <div className="lf-tx-ic">{isEarn ? "⭐" : isRedeem ? "🎁" : "⏳"}</div>
                <div className="lf-tx-main">
                  <b>{isEarn ? "สะสมแต้ม" : isRedeem ? "แลกของรางวัล" : "แต้มหมดอายุ"}</b>
                  {t.note && <span>{t.note}</span>}
                  <span>{formatDate(t.created_at)}{isEarn && t.expires_at ? ` · ใช้ได้ถึง ${formatDate(t.expires_at)}` : ""}</span>
                </div>
                <div className="lf-tx-amt" style={{ color }}>{isEarn ? "+" : "−"}{t.points_earned.toLocaleString()}<small>แต้ม</small></div>
              </div>
            );
          })}
        </div>
      )}

      <div className="lf-foot">ทุก 100 บาท = 1 แต้ม · แต้มมีอายุ 1 ปี · บอกเบอร์โทรที่แคชเชียร์ทุกครั้ง</div>
    </Shell>
  );
}
