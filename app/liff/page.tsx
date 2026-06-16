"use client";
import { useEffect, useState } from "react";

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
  { name: "Platinum", emoji: "🔱", min: 4000,  cardGrad: "linear-gradient(135deg, #37474F 0%, #607D8B 45%, #CFD8DC 100%)" },
  { name: "Gold",     emoji: "🥇", min: 1000,  cardGrad: "linear-gradient(135deg, #F57F17 0%, #FFD600 50%, #F9A825 100%)" },
  { name: "Silver",   emoji: "🥈", min: 300,   cardGrad: "linear-gradient(135deg, #37474F 0%, #78909C 50%, #B0BEC5 100%)" },
  { name: "Bronze",   emoji: "🥉", min: 100,   cardGrad: "linear-gradient(135deg, #6D4C41 0%, #A1887F 50%, #D7A27C 100%)" },
  { name: "Welcome",  emoji: "👋", min: 0,     cardGrad: "linear-gradient(135deg, #455A64 0%, #607D8B 50%, #90A4AE 100%)" },
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
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
  });
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
  const [txFilter, setTxFilter]   = useState<"all"|"earn"|"redeem"|"expire">("all");

  useEffect(() => {
    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
        if (!liff.isLoggedIn()) { liff.login(); return; }

        const p = await liff.getProfile();
        setProfile({ userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl ?? "" });
        sessionStorage.setItem("liff_uid", p.userId);

        const res  = await fetch(`/api/member?lineUserId=${p.userId}`);
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
      const res  = await fetch(`/api/member/transactions?lineUserId=${profile.userId}`);
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
      const res  = await fetch("/api/member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile!.userId,
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
      else setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } catch { setError("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    finally { setSubmitting(false); }
  }

  /* ── Loading ── */
  if (loading) return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <div>กำลังโหลด...</div>
        </div>
      </div>
    </div>
  );

  /* ── Error (ไม่มี profile) ── */
  if (error && !profile) return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ textAlign: "center", padding: 40, color: "#e53935" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div>{error}</div>
        </div>
      </div>
    </div>
  );

  /* ── สมัครสมาชิก ── */
  if (!registered) return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.logo}>🏗️ DK STEEL AND TOOLS</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>ระบบสะสมแต้มสมาชิก</div>
      </div>
      <div style={s.card}>
        {profile?.pictureUrl && (
          <img src={profile.pictureUrl} alt="" style={s.avatar} />
        )}
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{profile?.displayName}</div>
        <div style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>ยังไม่ได้สมัครสมาชิก</div>

        <div style={{ width: "100%", display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={s.label}>ชื่อ *</label>
            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
              placeholder="สมชาย" style={s.input} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={s.label}>นามสกุล *</label>
            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
              placeholder="ใจดี" style={s.input} />
          </div>
        </div>

        <div style={{ width: "100%", marginBottom: 8 }}>
          <label style={s.label}>เบอร์มือถือ (10 หลัก) *</label>
          <input type="tel" inputMode="numeric" maxLength={10}
            value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="0812345678" style={s.input} />
        </div>

        <div style={{ width: "100%", marginBottom: 8 }}>
          <label style={s.label}>วันเกิด *</label>
          <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
            style={s.input} />
        </div>

        <div style={{ width: "100%", marginBottom: 8 }}>
          <label style={s.label}>บริษัท / ร้านค้า (ถ้ามี)</label>
          <input type="text" value={company} onChange={e => setCompany(e.target.value)}
            placeholder="บริษัท ABC จำกัด" style={s.input} />
        </div>

        {error && <div style={{ color: "#e53935", fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <button onClick={handleRegister} disabled={submitting} style={s.btn}>
          {submitting ? "กำลังสมัคร..." : "✅ สมัครสมาชิก"}
        </button>
        <div style={{ fontSize: 12, color: "#aaa", marginTop: 12 }}>ทุก 100 บาท = 1 แต้ม 🌟</div>
      </div>
    </div>
  );

  /* ── แก้ไขข้อมูล (เปิดฟอร์มเดิม) ── */
  if (registered && editing) return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.logo}>🏗️ DK STEEL AND TOOLS</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>แก้ไขข้อมูลสมาชิก</div>
      </div>
      <div style={s.card}>
        <div style={{ width: "100%", display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={s.label}>ชื่อ *</label>
            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
              placeholder="สมชาย" style={s.input} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={s.label}>นามสกุล *</label>
            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
              placeholder="ใจดี" style={s.input} />
          </div>
        </div>

        <div style={{ width: "100%", marginBottom: 8 }}>
          <label style={s.label}>เบอร์มือถือ (10 หลัก) *</label>
          <input type="tel" inputMode="numeric" maxLength={10}
            value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="0812345678" style={{ ...s.input, background: "#f9f9f9" }} readOnly />
        </div>

        <div style={{ width: "100%", marginBottom: 8 }}>
          <label style={s.label}>วันเกิด *</label>
          <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
            style={s.input} />
        </div>

        <div style={{ width: "100%", marginBottom: 8 }}>
          <label style={s.label}>บริษัท / ร้านค้า (ถ้ามี)</label>
          <input type="text" value={company} onChange={e => setCompany(e.target.value)}
            placeholder="บริษัท ABC จำกัด" style={s.input} />
        </div>

        {error && <div style={{ color: "#e53935", fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <button onClick={handleRegister} disabled={submitting} style={s.btn}>
          {submitting ? "กำลังบันทึก..." : "💾 บันทึกข้อมูล"}
        </button>
        <button onClick={() => setEditing(false)}
          style={{ ...s.btn, background: "transparent", color: "#888", border: "1.5px solid #ddd", marginTop: 10 }}>
          ยกเลิก
        </button>
      </div>
    </div>
  );

  /* ── การ์ดสมาชิก (Premium) ── */
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
    <div style={{ ...s.page, background: "#EEF2F7" }}>
      {/* Header */}
      <div style={{ width: "100%", background: "linear-gradient(160deg, #0D1B5E 0%, #1565C0 100%)", padding: "28px 20px 72px", textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "white", letterSpacing: 1.5 }}>🏗️ DK STEEL AND TOOLS</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 6, letterSpacing: 2 }}>─── ระบบสมาชิกสะสมแต้ม ───</div>
      </div>

      {/* Premium Card */}
      <div style={{ width: "calc(100% - 32px)", maxWidth: 420, marginTop: -52, position: "relative", zIndex: 1 }}>
        <div style={{ background: tier.cardGrad, borderRadius: 26, padding: "24px 22px 22px", boxShadow: "0 16px 48px rgba(0,0,0,0.28)", position: "relative", overflow: "hidden", minHeight: 260 }}>

          {/* Construction crane silhouette */}
          <svg style={{ position: "absolute", right: -8, bottom: -4, width: 170, height: 210, opacity: 0.13 }} viewBox="0 0 170 210" fill="white" xmlns="http://www.w3.org/2000/svg">
            <rect x="76" y="55" width="14" height="155" />
            <rect x="18" y="50" width="130" height="9" />
            <polygon points="83,12 74,55 92,55" />
            <rect x="18" y="50" width="5" height="80" />
            <rect x="143" y="50" width="5" height="50" />
            <line x1="125" y1="59" x2="100" y2="110" stroke="white" strokeWidth="2.5" />
            <rect x="96" y="108" width="10" height="8" rx="2" />
            <rect x="8"   y="135" width="34" height="75" opacity="0.5" />
            <rect x="8"   y="140" width="8"  height="7"  opacity="0.8" />
            <rect x="20"  y="140" width="8"  height="7"  opacity="0.8" />
            <rect x="8"   y="155" width="8"  height="7"  opacity="0.8" />
            <rect x="20"  y="155" width="8"  height="7"  opacity="0.8" />
            <rect x="50"  y="150" width="28" height="60" opacity="0.4" />
            <rect x="120" y="125" width="42" height="85" opacity="0.45" />
            <rect x="125" y="132" width="9"  height="8"  opacity="0.8" />
            <rect x="138" y="132" width="9"  height="8"  opacity="0.8" />
            <rect x="125" y="148" width="9"  height="8"  opacity="0.8" />
            <rect x="138" y="148" width="9"  height="8"  opacity="0.8" />
          </svg>

          {/* MEMBER CARD + level badge */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 700, letterSpacing: 2 }}>MEMBER CARD</div>
            <div style={{ background: "rgba(255,255,255,0.25)", borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 800, color: "white", letterSpacing: 1, backdropFilter: "blur(4px)" }}>
              {tier.emoji} {tier.name}
            </div>
          </div>

          {/* Profile */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            {profile?.pictureUrl ? (
              <img src={profile.pictureUrl} alt="" style={{ width: 68, height: 68, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.85)", boxShadow: "0 4px 14px rgba(0,0,0,0.3)", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>👤</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 19, color: "white", textShadow: "0 1px 6px rgba(0,0,0,0.25)", lineHeight: 1.25, wordBreak: "break-word" }}>{name}</div>
              {member?.company && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 3 }}>🏢 {member.company}</div>}
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 11 }}>📞</span> {formattedPhone}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.3)", marginBottom: 16 }} />

          {/* Points + Birthday */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", letterSpacing: 2, marginBottom: 3 }}>แต้มสะสม</div>
              <div style={{ fontSize: 54, fontWeight: 900, color: "white", lineHeight: 1, textShadow: "0 3px 10px rgba(0,0,0,0.2)", letterSpacing: -1 }}>
                {points.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 3, letterSpacing: 2 }}>POINTS</div>
            </div>
            {member?.birthday && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>วันเกิด</div>
                <div style={{ background: "rgba(255,255,255,0.22)", borderRadius: 14, padding: "7px 13px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <span style={{ fontSize: 14, color: "white", fontWeight: 700 }}>
                    {new Date(member.birthday).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {nextTier ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 5 }}>
                <span>{tier.emoji} {tier.name}</span>
                <span>อีก {(nextTier.min - totalEarned).toLocaleString()} แต้ม → {nextTier.emoji} {nextTier.name}</span>
              </div>
              <div style={{ height: 7, background: "rgba(255,255,255,0.22)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: "rgba(255,255,255,0.85)", borderRadius: 10, transition: "width 0.8s ease" }} />
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.8)", textAlign: "center" }}>
              🏆 คุณอยู่ในระดับสูงสุดแล้วค่ะ ขอบคุณที่ไว้วางใจ DK!
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "right" }}>
            สมัครเมื่อ {member?.created_at ? formatDate(member.created_at) : "-"}
          </div>
        </div>

        {/* Inactive warning — ระดับลดเนื่องจากไม่ซื้อ */}
        {isInactive && (
          <div style={{ marginTop: 12, background: "#FFF3E0", border: "1px solid #FFCC80", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#E65100", marginBottom: 4 }}>
              🔴 ระดับลดชั่วคราว
            </div>
            <div style={{ fontSize: 13, color: "#BF360C" }}>
              ระดับจริงของคุณคือ {baseTier.emoji} <b>{baseTier.name}</b><br />
              กลับมาซื้อสินค้าเพื่อฟื้นระดับ <b>{baseTier.name}</b> ทันทีค่ะ ไม่ต้องสะสมใหม่ 😊
            </div>
          </div>
        )}

        {/* Near-drop warning — เดือนที่ 11 */}
        {!isInactive && isNearDrop && (
          <div style={{ marginTop: 12, background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F57F17", marginBottom: 4 }}>
              ⚠️ ระดับใกล้ลด
            </div>
            <div style={{ fontSize: 13, color: "#E65100" }}>
              คุณไม่ได้ซื้อสินค้ามา {months} เดือนแล้วค่ะ<br />
              อีก {12 - (months ?? 0)} เดือน ระดับ {tier.emoji} <b>{tier.name}</b> จะลดลง<br />
              แวะมาซื้อสินค้าเพื่อรักษาระดับของคุณนะคะ 🛒
            </div>
          </div>
        )}

        {/* Expiry box สีเหลือง */}
        {expiry?.earliest_expiry && (expiry.expiring_points ?? 0) > 0 && (() => {
          const expDate = new Date(expiry.earliest_expiry).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
          const daysLeft = Math.ceil((new Date(expiry.earliest_expiry).getTime() - Date.now()) / 86400000);
          const urgent = daysLeft <= 30;
          return (
            <div style={{ marginTop: 12, background: urgent ? "#FFF0F0" : "#FFFBEA", border: `1px solid ${urgent ? "#FFCDD2" : "#FFE082"}`, borderRadius: 14, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: urgent ? "#C62828" : "#E65100" }}>
                  {(expiry.expiring_points ?? 0).toLocaleString()} คะแนน
                </div>
                <div style={{ fontSize: 12, color: urgent ? "#E53935" : "#F57C00", marginTop: 2 }}>
                  หมดอายุ: {expDate}{daysLeft <= 90 ? ` (อีก ${daysLeft} วัน)` : ""}
                </div>
              </div>
              <button
                onClick={() => { if (!txOpen) loadTransactions(); setTxFilter("expire"); setTxOpen(true); }}
                style={{ background: "none", border: "none", color: urgent ? "#C62828" : "#E65100", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Leelawadee UI, Tahoma, sans-serif" }}>
                ดูประวัติ &gt;
              </button>
            </div>
          );
        })()}

        {/* Action buttons — with subtitle */}
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <button
            onClick={() => { if (!txOpen) loadTransactions(); else setTxOpen(false); }}
            style={{ flex: 1, padding: "14px 10px", background: "white", border: "none", borderRadius: 16, cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,0.09)", fontFamily: "Leelawadee UI, Tahoma, sans-serif", textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{txLoading ? "⏳" : "📋"}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#333" }}>{txLoading ? "กำลังโหลด..." : txOpen ? "ซ่อนประวัติ" : "ประวัติแต้ม"}</div>
            <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>ดูประวัติการสะสมแต้ม</div>
          </button>
          <button
            onClick={() => {
              setFirstName(member?.first_name ?? "");
              setLastName(member?.last_name ?? "");
              setPhone(member?.phone ?? "");
              setCompany(member?.company ?? "");
              setBirthday(member?.birthday ? member.birthday.substring(0, 10) : "");
              setError("");
              setEditing(true);
            }}
            style={{ flex: 1, padding: "14px 10px", background: "white", border: "none", borderRadius: 16, cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,0.09)", fontFamily: "Leelawadee UI, Tahoma, sans-serif", textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>✏️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1565C0" }}>แก้ไขข้อมูล</div>
            <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>อัปเดตข้อมูลสมาชิก</div>
          </button>
        </div>

        {/* ของรางวัล */}
        <button
          onClick={() => window.location.href = `/liff/rewards?uid=${profile?.userId ?? ""}`}
          style={{ marginTop: 10, width: "100%", padding: "14px", background: "linear-gradient(135deg, #E65100, #FF8F00)", color: "white", border: "none", borderRadius: 16, cursor: "pointer", boxShadow: "0 4px 14px rgba(230,81,0,0.35)", fontFamily: "Leelawadee UI, Tahoma, sans-serif", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🎁 ดูของรางวัล</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>แลกแต้มสะสมได้ที่ร้าน</div>
        </button>
      </div>

      {/* ประวัติการสะสมแต้ม */}
      {txOpen && (
        <div style={{ width: "calc(100% - 32px)", maxWidth: 420, marginTop: 10 }}>
          <div style={{ background: "white", borderRadius: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden" }}>

            {/* 4 แท็บ */}
            <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0" }}>
              {([
                { key: "all",    label: "ทั้งหมด" },
                { key: "earn",   label: "ที่ได้รับ" },
                { key: "redeem", label: "ใช้แล้ว" },
                { key: "expire", label: "หมดอายุ" },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setTxFilter(tab.key)}
                  style={{
                    flex: 1, padding: "11px 4px", border: "none", background: "none",
                    fontSize: 13, fontWeight: txFilter === tab.key ? 800 : 500,
                    color: txFilter === tab.key ? "#1565C0" : "#999",
                    borderBottom: txFilter === tab.key ? "2.5px solid #1565C0" : "2.5px solid transparent",
                    cursor: "pointer", fontFamily: "Leelawadee UI, Tahoma, sans-serif",
                    transition: "all 0.15s",
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* รายการ */}
            {(() => {
              const filtered = txFilter === "all" ? txList : txList.filter(t => t.type === txFilter);
              if (filtered.length === 0) return (
                <div style={{ textAlign: "center", padding: "28px 16px", color: "#aaa", fontSize: 14 }}>
                  ไม่มีรายการในหมวดนี้
                </div>
              );
              return filtered.map((t, i) => {
                const isEarn   = t.type === "earn";
                const isRedeem = t.type === "redeem";
                const isExpire = t.type === "expire";
                const dt = new Date(t.created_at);
                const dateStr = dt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
                const icon  = isEarn ? "⭐" : isRedeem ? "🎁" : "⏳";
                const label = isEarn ? "สะสมแต้ม" : isRedeem ? "แลกของรางวัล" : "คะแนนหมดอายุ";
                const color = isEarn ? "#2E7D32" : isRedeem ? "#E53935" : "#9E9E9E";
                const prefix = isEarn ? "+" : "-";
                return (
                  <div key={t.id} style={{ padding: "14px 18px", borderBottom: i < filtered.length - 1 ? "1px solid #f0f0f0" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{icon} {label}</div>
                      {t.note && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{t.note}</div>}
                      <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{dateStr}</div>
                      {isEarn && t.expires_at && (
                        <div style={{ fontSize: 11, color: "#BF8000", marginTop: 2 }}>
                          หมดอายุ: {new Date(t.expires_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color, minWidth: 60, textAlign: "right" }}>
                      {prefix}{t.points_earned}
                      <div style={{ fontSize: 11, fontWeight: 400, color: "#aaa" }}>แต้ม</div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: "#aaa", marginTop: 20, marginBottom: 8, textAlign: "center" }}>
        ทุก 100 บาท = 1 แต้ม · สะสมแต้มแลกของรางวัล
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", background: "#f4f6f9",
    display: "flex", flexDirection: "column", alignItems: "center",
    fontFamily: "Leelawadee UI, Tahoma, sans-serif", padding: "0 0 32px",
  },
  header: {
    width: "100%", background: "linear-gradient(135deg, #0D47A1, #1976D2)",
    color: "white", textAlign: "center", padding: "28px 16px 24px",
    marginBottom: -28,
  },
  logo: { fontSize: 20, fontWeight: 800, letterSpacing: 1, marginBottom: 4 },
  card: {
    width: "calc(100% - 32px)", maxWidth: 420,
    background: "white", borderRadius: 20,
    boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
    padding: "32px 24px 28px",
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  avatar: {
    width: 80, height: 80, borderRadius: "50%",
    border: "3px solid #1976D2", marginBottom: 14,
    objectFit: "cover",
  },
  badge: {
    padding: "6px 18px", borderRadius: 20, fontWeight: 700,
    fontSize: 14, border: "2px solid", letterSpacing: 1,
  },
  input: {
    width: "100%", padding: "12px 14px", fontSize: 16,
    border: "1.5px solid #ddd", borderRadius: 10, outline: "none",
    boxSizing: "border-box", letterSpacing: 2,
  },
  btn: {
    width: "100%", padding: "14px", background: "#1976D2",
    color: "white", border: "none", borderRadius: 12,
    fontSize: 16, fontWeight: 700, cursor: "pointer",
    fontFamily: "Leelawadee UI, Tahoma, sans-serif",
  },
  progressBg: {
    width: "100%", height: 10, background: "#eee",
    borderRadius: 10, overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 10, transition: "width 0.5s ease" },
  divider: { width: "100%", height: 1, background: "#f0f0f0", margin: "18px 0" },
  label: { fontSize: 13, color: "#555", display: "block", marginBottom: 6 },
};
