"use client";
import { useEffect, useState } from "react";

interface Member {
  points: number;
}

const REWARDS = [
  {
    id: 1,
    name: "เสื้อ DK Steel and Tools",
    description: "เสื้อยืดคุณภาพดี แบรนด์ DK",
    points: 50,
    image: "/tshirt.jpg",
    emoji: "👕",
  },
  {
    id: 2,
    name: "แก้วเก็บความเย็น YETI",
    description: "แก้ว YETI Rambler เก็บความเย็นได้นาน",
    points: 100,
    image: "/yeti-cup.jpg",
    emoji: "🥤",
  },
];

export default function RewardsPage() {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const p = await liff.getProfile();
        const res = await fetch(`/api/member?lineUserId=${p.userId}`);
        const data = await res.json();
        if (data.member) setMember(data.member);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const userPoints = member?.points ?? 0;

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "Leelawadee UI, Tahoma, sans-serif" }}>
      <div style={{ textAlign: "center", color: "#999" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <div>กำลังโหลด...</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#ECEFF1", fontFamily: "Leelawadee UI, Tahoma, sans-serif", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a237e, #1976D2)", padding: "20px 20px 32px", textAlign: "center" }}>
        <button
          onClick={() => window.location.href = "/liff"}
          style={{ position: "absolute", left: 16, top: 20, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 20, padding: "6px 14px", color: "white", fontSize: 14, cursor: "pointer", fontFamily: "Leelawadee UI, Tahoma, sans-serif" }}>
          ← กลับ
        </button>
        <div style={{ fontSize: 22, fontWeight: 800, color: "white", letterSpacing: 1 }}>🎁 ของรางวัล</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>แลกแต้มสะสมได้ที่ร้าน</div>
        <div style={{ marginTop: 14, background: "rgba(255,255,255,0.18)", borderRadius: 24, padding: "10px 24px", display: "inline-block" }}>
          <span style={{ color: "white", fontSize: 16, fontWeight: 800 }}>⭐ แต้มของคุณ: {userPoints.toLocaleString()} แต้ม</span>
        </div>
      </div>

      {/* Rewards list */}
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 16, textAlign: "center" }}>
          📍 นำบัตรสมาชิกมาแสดงที่ร้านเพื่อแลกของรางวัล
        </div>

        {REWARDS.map(reward => {
          const canRedeem = userPoints >= reward.points;
          const lacking = reward.points - userPoints;
          return (
            <div key={reward.id} style={{
              background: "white",
              borderRadius: 20,
              marginBottom: 20,
              boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
              overflow: "hidden",
              border: canRedeem ? "2px solid #43A047" : "2px solid transparent",
            }}>
              {/* รูปสินค้า */}
              <div style={{ position: "relative" }}>
                <img
                  src={reward.image}
                  alt={reward.name}
                  style={{ width: "100%", height: 240, objectFit: "cover", display: "block" }}
                  onError={e => {
                    const t = e.target as HTMLImageElement;
                    t.style.display = "none";
                    (t.nextSibling as HTMLElement).style.display = "flex";
                  }}
                />
                {/* fallback ถ้าไม่มีรูป */}
                <div style={{ display: "none", height: 180, justifyContent: "center", alignItems: "center", background: "#f5f5f5", fontSize: 80 }}>
                  {reward.emoji}
                </div>
                {canRedeem && (
                  <div style={{ position: "absolute", top: 12, right: 12, background: "#43A047", color: "white", borderRadius: 20, padding: "4px 12px", fontSize: 13, fontWeight: 700 }}>
                    ✅ แลกได้เลย!
                  </div>
                )}
              </div>

              {/* รายละเอียด */}
              <div style={{ padding: "18px 20px 20px" }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: "#1a1a1a" }}>{reward.name}</div>
                <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>{reward.description}</div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
                  <div style={{
                    background: canRedeem ? "#E8F5E9" : "#FFF8E1",
                    color: canRedeem ? "#2e7d32" : "#E65100",
                    padding: "10px 20px",
                    borderRadius: 24,
                    fontWeight: 800,
                    fontSize: 18,
                  }}>
                    ⭐ {reward.points} แต้ม
                  </div>
                  <div style={{ fontSize: 13, color: canRedeem ? "#2e7d32" : "#999", fontWeight: 600, textAlign: "right" }}>
                    {canRedeem
                      ? `เหลือแต้ม ${(userPoints - reward.points).toLocaleString()} หลังแลก`
                      : `ขาดอีก ${lacking.toLocaleString()} แต้ม`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ background: "white", borderRadius: 16, padding: "18px 20px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 16, marginBottom: 6 }}>📞 ติดต่อแลกของรางวัล</div>
          <div style={{ fontSize: 14, color: "#555" }}>คุณเก๋ 094-651-4309</div>
          <div style={{ fontSize: 14, color: "#555" }}>คุณหญิง 088-760-8470</div>
          <div style={{ fontSize: 13, color: "#aaa", marginTop: 8 }}>เปิดบริการ จันทร์-เสาร์ 8:00-17:00 น.</div>
        </div>
      </div>
    </div>
  );
}
