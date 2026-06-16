"use client";
import { useEffect, useState } from "react";

interface Member {
  points: number;
}

interface Reward {
  id: number;
  name: string;
  description: string | null;
  points_required: number;
  image_url: string | null;
  stock: number | null;
}

export default function RewardsPage() {
  const [lineUserId, setLineUserId] = useState("");
  const [member, setMember]   = useState<Member | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [redeemMsg, setRedeemMsg]     = useState<{ id: number; ok: boolean; text: string } | null>(null);

  useEffect(() => {
    async function init() {
      try {
        let uid = sessionStorage.getItem("liff_uid") ?? "";
        if (!uid) uid = new URLSearchParams(window.location.search).get("uid") ?? "";
        if (!uid) {
          try {
            const liff = (await import("@line/liff")).default;
            await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
            if (liff.isLoggedIn()) { const p = await liff.getProfile(); uid = p.userId; }
          } catch {}
        }
        setLineUserId(uid);

        const [memberRes, rewardsRes] = await Promise.all([
          uid ? fetch(`/api/member?lineUserId=${uid}`) : null,
          fetch("/api/rewards"),
        ]);

        if (memberRes) {
          const data = await memberRes.json();
          if (data.user) setMember(data.user);
        }

        const rData = await rewardsRes.json();
        setRewards(rData.rewards ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleRedeem(reward: Reward) {
    if (!lineUserId) { setRedeemMsg({ id: reward.id, ok: false, text: "ไม่สามารถระบุตัวตนได้ กรุณาเปิดจาก LINE" }); return; }
    setRedeemingId(reward.id);
    setRedeemMsg(null);
    try {
      const res  = await fetch("/api/liff/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, rewardId: reward.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRedeemMsg({ id: reward.id, ok: false, text: data.error ?? "เกิดข้อผิดพลาด" });
      } else {
        setRedeemMsg({ id: reward.id, ok: true, text: `ส่งคำขอสำเร็จ! #REQ-${data.requestId} พนักงานจะยืนยันเร็วๆ นี้` });
      }
    } catch {
      setRedeemMsg({ id: reward.id, ok: false, text: "เชื่อมต่อไม่ได้ กรุณาลองใหม่" });
    } finally {
      setRedeemingId(null);
    }
  }

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

      <div style={{ padding: "20px 16px 0" }}>

        {rewards.length === 0 ? (
          <div style={{ background: "white", borderRadius: 20, padding: "48px 20px", textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎁</div>
            <div style={{ fontSize: 16, color: "#888" }}>ยังไม่มีของรางวัลในขณะนี้</div>
          </div>
        ) : (
          rewards.map(reward => {
            const canRedeem  = userPoints >= reward.points_required;
            const lacking    = reward.points_required - userPoints;
            const outOfStock = reward.stock !== null && reward.stock === 0;
            const msg        = redeemMsg?.id === reward.id ? redeemMsg : null;
            const isLoading  = redeemingId === reward.id;
            return (
              <div key={reward.id} style={{
                background: "white", borderRadius: 20, marginBottom: 20,
                boxShadow: "0 4px 16px rgba(0,0,0,0.10)", overflow: "hidden",
                border: canRedeem && !outOfStock ? "2px solid #43A047" : "2px solid transparent",
                opacity: outOfStock ? 0.6 : 1,
              }}>
                {/* รูปสินค้า */}
                <div style={{ position: "relative", background: "#f5f5f5", height: 220, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {reward.image_url ? (
                    <img src={reward.image_url} alt={reward.name}
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", padding: "16px", display: "block" }} />
                  ) : (
                    <div style={{ fontSize: 80 }}>🎁</div>
                  )}
                  {outOfStock && (
                    <div style={{ position: "absolute", top: 12, right: 12, background: "#e53935", color: "white", borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 700 }}>
                      หมดแล้ว
                    </div>
                  )}
                  {!outOfStock && canRedeem && (
                    <div style={{ position: "absolute", top: 12, right: 12, background: "#43A047", color: "white", borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 700, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                      ✅ แลกได้เลย!
                    </div>
                  )}
                </div>

                {/* รายละเอียด */}
                <div style={{ padding: "18px 20px 20px" }}>
                  <div style={{ fontWeight: 800, fontSize: 20, color: "#1a1a1a" }}>{reward.name}</div>
                  {reward.description && <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>{reward.description}</div>}
                  {reward.stock !== null && reward.stock > 0 && (
                    <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>เหลือ {reward.stock} ชิ้น</div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
                    <div style={{ background: canRedeem && !outOfStock ? "#E8F5E9" : "#FFF8E1", color: canRedeem && !outOfStock ? "#2e7d32" : "#E65100", padding: "10px 20px", borderRadius: 24, fontWeight: 800, fontSize: 18 }}>
                      ⭐ {reward.points_required.toLocaleString()} แต้ม
                    </div>
                    <div style={{ fontSize: 13, color: canRedeem && !outOfStock ? "#2e7d32" : "#999", fontWeight: 600, textAlign: "right" }}>
                      {outOfStock ? "ของหมดแล้ว" : canRedeem
                        ? `เหลือ ${(userPoints - reward.points_required).toLocaleString()} แต้มหลังแลก`
                        : `ขาดอีก ${lacking.toLocaleString()} แต้ม`}
                    </div>
                  </div>

                  {/* ปุ่มแลกเลย */}
                  {canRedeem && !outOfStock && (
                    <button
                      onClick={() => handleRedeem(reward)}
                      disabled={isLoading || msg?.ok === true}
                      style={{
                        marginTop: 14, width: "100%", padding: "14px 0",
                        background: msg?.ok ? "#43A047" : "#1565C0",
                        color: "white", border: "none", borderRadius: 14,
                        fontSize: 16, fontWeight: 800, cursor: isLoading || msg?.ok ? "default" : "pointer",
                        fontFamily: "Leelawadee UI, Tahoma, sans-serif",
                        opacity: isLoading ? 0.7 : 1,
                        transition: "background 0.2s",
                      }}>
                      {isLoading ? "⏳ กำลังส่งคำขอ..." : msg?.ok ? "✅ ส่งคำขอแล้ว" : "🎁 แลกเลย"}
                    </button>
                  )}

                  {/* ข้อความผลลัพธ์ */}
                  {msg && (
                    <div style={{
                      marginTop: 10, padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                      background: msg.ok ? "#E8F5E9" : "#FFEBEE",
                      color: msg.ok ? "#2e7d32" : "#c62828",
                    }}>
                      {msg.ok ? "✅" : "❌"} {msg.text}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* เงื่อนไข */}
        <div style={{ background: "white", borderRadius: 16, padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, color: "#1a1a1a" }}>วิธีรับคะแนน และ เงื่อนไขการแลกของรางวัล</div>
          {[
            "สมาชิกจะได้รับคะแนนสะสมจากการซื้อสินค้าที่ร้าน DK Steel and Tools",
            "คะแนนสะสมในอัตราปกติ คำนวณจากยอดซื้อสินค้าทุก 100 บาท ได้รับคะแนนสะสม 1 คะแนน คะแนนมีอายุ 1 ปี นับแต่วันที่ได้รับคะแนน",
            "การคำนวณคะแนนสะสม คำนวณจากยอดซื้อต่อใบเสร็จ โดยคำนวณคะแนนสะสมเป็นจำนวนเต็มเท่านั้น จำนวนเงินที่เหลือที่ไม่ครบ 100 บาทจะถูกตัดทิ้ง",
            "สมาชิกสามารถทราบคะแนนสะสมของตนเองได้ทันทีผ่านแอป LINE DK Steel and Tools",
            "สมาชิกที่มีความประสงค์ใช้คะแนนสะสมเพื่อแลกของรางวัล สามารถกดปุ่ม \"แลกเลย\" ในหน้านี้ได้เลย พนักงานจะยืนยันและหักแต้มเมื่อลูกค้ามารับของที่ร้าน",
            "สมาชิกที่ต้องการแลกของรางวัล จะต้องเปิดหน้าบัตรสมาชิกในแอปเพื่อแสดงตัวตน และข้อมูลจะต้องตรงกับข้อมูลที่ลงทะเบียนสมาชิกไว้เท่านั้น",
            "คะแนนสะสมที่ทำการแลกของรางวัลไปแล้ว จะถูกหักลบจากยอดคะแนนคงเหลือของสมาชิกทันที และไม่สามารถโอนคะแนนกลับได้ในทุกกรณี",
            "เงื่อนไขเป็นไปตามที่บริษัทกำหนด บริษัทขอสงวนสิทธิ์ในการเปลี่ยนแปลงโดยไม่แจ้งให้ทราบล่วงหน้า",
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
              <div style={{ minWidth: 22, height: 22, background: "#1565C0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 13, color: "#444", lineHeight: 1.7 }}>{item}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
