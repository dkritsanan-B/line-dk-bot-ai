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
        // ดึง lineUserId จาก sessionStorage (เก็บไว้จากหน้าหลัก) → URL param → LIFF
        let lineUserId = sessionStorage.getItem("liff_uid") ?? "";

        if (!lineUserId) {
          lineUserId = new URLSearchParams(window.location.search).get("uid") ?? "";
        }

        if (!lineUserId) {
          try {
            const liff = (await import("@line/liff")).default;
            await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
            if (liff.isLoggedIn()) {
              const p = await liff.getProfile();
              lineUserId = p.userId;
            }
          } catch {}
        }

        if (lineUserId) {
          const res = await fetch(`/api/member?lineUserId=${lineUserId}`);
          const data = await res.json();
          if (data.member) setMember(data.member);
        }
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
    <div style={{ minHeight: "100vh", background: "#EEF2F7", fontFamily: "Leelawadee UI, Tahoma, sans-serif", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(160deg, #0D1B5E 0%, #1565C0 100%)", padding: "28px 20px 36px", textAlign: "center", position: "relative" }}>
        <button
          onClick={() => window.location.href = "/liff"}
          style={{ position: "absolute", left: 16, top: 26, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 20, padding: "7px 16px", color: "white", fontSize: 14, cursor: "pointer", fontFamily: "Leelawadee UI, Tahoma, sans-serif", fontWeight: 600 }}>
          ← กลับ
        </button>
        <div style={{ fontSize: 22, fontWeight: 900, color: "white" }}>🎁 ของรางวัล</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>แลกแต้มสะสมได้ที่ร้าน</div>
        <div style={{ marginTop: 14, background: "rgba(255,255,255,0.18)", borderRadius: 24, padding: "10px 28px", display: "inline-block" }}>
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
              <div style={{ position: "relative", background: "#f8f8f8" }}>
                <img
                  src={reward.image}
                  alt={reward.name}
                  style={{ width: "100%", height: 240, objectFit: "cover", display: "block" }}
                  onError={e => {
                    const t = e.target as HTMLImageElement;
                    t.style.display = "none";
                    const fb = t.nextSibling as HTMLElement;
                    if (fb) fb.style.display = "flex";
                  }}
                />
                <div style={{ display: "none", height: 180, justifyContent: "center", alignItems: "center", fontSize: 90 }}>
                  {reward.emoji}
                </div>
                {canRedeem && (
                  <div style={{ position: "absolute", top: 12, right: 12, background: "#43A047", color: "white", borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 700, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
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
                      ? `เหลือ ${(userPoints - reward.points).toLocaleString()} แต้มหลังแลก`
                      : `ขาดอีก ${lacking.toLocaleString()} แต้ม`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* ติดต่อร้าน */}
        <div style={{ background: "white", borderRadius: 16, padding: "20px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>📞 ติดต่อแลกของรางวัล</div>
          <div style={{ fontSize: 14, color: "#555", lineHeight: 1.8 }}>
            คุณเก๋ 094-651-4309<br />
            คุณหญิง 088-760-8470<br />
            คุณแพรว 065-209-4955<br />
            คุณลัย 095-023-6382<br />
            คุณมีน 094-629-3510
          </div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 10 }}>เปิดบริการ จันทร์-เสาร์ 8:00-17:00 น.</div>
        </div>
      </div>
    </div>
  );
}
