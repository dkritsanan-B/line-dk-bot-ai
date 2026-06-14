"use client";
import { useEffect, useState } from "react";

interface Profile {
  userId: string;
  displayName: string;
  pictureUrl: string;
}

interface Member {
  id: number;
  phone: string;
  display_name: string | null;
  points: number;
  created_at: string;
}

function getLevel(points: number) {
  if (points >= 2000) return { name: "GOLD", color: "#F9A825", bg: "#FFF8E1", next: null, target: 2000 };
  if (points >= 500)  return { name: "SILVER", color: "#757575", bg: "#F5F5F5", next: 2000, target: 500 };
  return                     { name: "WELCOME", color: "#1976D2", bg: "#E3F2FD", next: 500, target: 0 };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function LiffPage() {
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [member, setMember]       = useState<Member | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [phone, setPhone]         = useState("");
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
        if (!liff.isLoggedIn()) { liff.login(); return; }

        const p = await liff.getProfile();
        setProfile({ userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl ?? "" });

        const res  = await fetch(`/api/member?lineUserId=${p.userId}`);
        const data = await res.json();
        setRegistered(data.registered);
        if (data.registered) setMember(data.user);
      } catch {
        setError("กรุณาเปิดใน LINE เท่านั้นค่ะ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleRegister() {
    if (!/^0\d{9}$/.test(phone)) { setError("เบอร์มือถือไม่ถูกต้อง (10 หลัก)"); return; }
    setSubmitting(true); setError("");
    try {
      const res  = await fetch("/api/member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId: profile!.userId, phone, displayName: profile!.displayName }),
      });
      const data = await res.json();
      if (data.success) { setRegistered(true); setMember(data.user); }
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

        <div style={{ width: "100%", marginBottom: 8 }}>
          <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 6 }}>
            เบอร์มือถือ (10 หลัก)
          </label>
          <input
            type="tel" inputMode="numeric" maxLength={10}
            value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="0812345678"
            style={s.input}
          />
        </div>
        {error && <div style={{ color: "#e53935", fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <button onClick={handleRegister} disabled={submitting} style={s.btn}>
          {submitting ? "กำลังสมัคร..." : "✅ สมัครสมาชิก"}
        </button>
        <div style={{ fontSize: 12, color: "#aaa", marginTop: 12 }}>ทุก 100 บาท = 1 แต้ม 🌟</div>
      </div>
    </div>
  );

  /* ── การ์ดสมาชิก ── */
  const level = getLevel(member?.points ?? 0);
  const points = member?.points ?? 0;
  const progress = level.next ? Math.min(100, ((points - level.target) / (level.next - level.target)) * 100) : 100;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.logo}>🏗️ DK STEEL AND TOOLS</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>บัตรสมาชิกดิจิทัล</div>
      </div>

      <div style={s.card}>
        {profile?.pictureUrl && (
          <img src={profile.pictureUrl} alt="" style={s.avatar} />
        )}
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 2 }}>
          {profile?.displayName ?? member?.display_name}
        </div>
        {member?.phone && (
          <div style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>📱 {member.phone}</div>
        )}

        {/* Level badge */}
        <div style={{ ...s.badge, background: level.bg, color: level.color, borderColor: level.color }}>
          ⭐ {level.name}
        </div>

        {/* Points */}
        <div style={{ margin: "20px 0 4px", fontSize: 13, color: "#888" }}>แต้มสะสม</div>
        <div style={{ fontSize: 52, fontWeight: 800, color: "#1a1a1a", lineHeight: 1 }}>
          {points.toLocaleString()}
        </div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>แต้ม</div>

        {/* Progress bar */}
        {level.next && (
          <div style={{ width: "100%", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888", marginBottom: 6 }}>
              <span>{level.name}</span>
              <span>อีก {(level.next - points).toLocaleString()} แต้ม → {
                level.next >= 2000 ? "GOLD" : "SILVER"
              }</span>
            </div>
            <div style={s.progressBg}>
              <div style={{ ...s.progressFill, width: `${progress}%`, background: level.color }} />
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: "#aaa", marginTop: 4 }}>
              {points} / {level.next}
            </div>
          </div>
        )}

        <div style={s.divider} />

        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 13, color: "#777" }}>
          <span>📅 สมัครเมื่อ</span>
          <span>{member?.created_at ? formatDate(member.created_at) : "-"}</span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#aaa", marginTop: 16, textAlign: "center" }}>
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
};
