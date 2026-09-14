"use client";
import { useEffect, useState } from "react";
import { Shell, Loading } from "../ui";

// หน้าของรางวัล — ตรรกะเดิม (ตัวตน = LIFF access token) · รื้อหน้าตาเป็นชุดเดียวกับ /liff (14 ก.ย. 69) สไตล์อยู่ ../liff.css
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

const RULES = [
  "สมาชิกจะได้รับคะแนนสะสมจากการซื้อสินค้าที่ร้าน DK Steel and Tools",
  "คะแนนสะสมในอัตราปกติ คำนวณจากยอดซื้อสินค้าทุก 100 บาท ได้รับคะแนนสะสม 1 คะแนน คะแนนมีอายุ 1 ปี นับแต่วันที่ได้รับคะแนน",
  "การคำนวณคะแนนสะสม คำนวณจากยอดซื้อต่อใบเสร็จ โดยคำนวณคะแนนสะสมเป็นจำนวนเต็มเท่านั้น จำนวนเงินที่เหลือที่ไม่ครบ 100 บาทจะถูกตัดทิ้ง",
  "สมาชิกสามารถทราบคะแนนสะสมของตนเองได้ทันทีผ่านแอป LINE DK Steel and Tools",
  "สมาชิกที่มีความประสงค์ใช้คะแนนสะสมเพื่อแลกของรางวัล สามารถกดปุ่ม \"แลกเลย\" ในหน้านี้ได้เลย พนักงานจะยืนยันและหักแต้มเมื่อลูกค้ามารับของที่ร้าน",
  "สมาชิกที่ต้องการแลกของรางวัล จะต้องเปิดหน้าบัตรสมาชิกในแอปเพื่อแสดงตัวตน และข้อมูลจะต้องตรงกับข้อมูลที่ลงทะเบียนสมาชิกไว้เท่านั้น",
  "คะแนนสะสมที่ทำการแลกของรางวัลไปแล้ว จะถูกหักลบจากยอดคะแนนคงเหลือของสมาชิกทันที และไม่สามารถโอนคะแนนกลับได้ในทุกกรณี",
  "เงื่อนไขเป็นไปตามที่บริษัทกำหนด บริษัทขอสงวนสิทธิ์ในการเปลี่ยนแปลงโดยไม่แจ้งให้ทราบล่วงหน้า",
];

export default function RewardsPage() {
  const [lineUserId, setLineUserId] = useState("");   // เก็บ LIFF access token (ชื่อตัวแปรเดิม)
  const [member, setMember]   = useState<Member | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [redeemMsg, setRedeemMsg]     = useState<{ id: number; ok: boolean; text: string } | null>(null);

  useEffect(() => {
    async function init() {
      try {
        // ตัวตน = LIFF access token เท่านั้น (เดิมรับ uid จาก URL ?uid= ได้ — ใครรู้ U-id คนอื่นก็กดแลกของแทนได้)
        let tok = sessionStorage.getItem("liff_token") ?? "";
        try {
          const liff = (await import("@line/liff")).default;
          await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
          if (!liff.isLoggedIn()) { liff.login(); return; }
          tok = liff.getAccessToken() ?? tok;
        } catch {}
        setLineUserId(tok);

        const [memberRes, rewardsRes] = await Promise.all([
          tok ? fetch("/api/member", { headers: { Authorization: `Bearer ${tok}` } }) : null,
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lineUserId}` },
        body: JSON.stringify({ rewardId: reward.id }),
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

  if (loading) return <Loading />;

  const userPoints = member?.points ?? 0;

  return (
    <Shell sub="ของรางวัล · แลกแต้มสะสม" back={{ label: "‹ บัตรสมาชิก", href: "/liff" }} short>
      <div className="lf-balance" style={{ marginTop: -14 }}>
        <div><span>แต้มของคุณ</span><br /><b style={{ color: "#fff" }}>{userPoints.toLocaleString()}</b></div>
        <span style={{ fontSize: 28 }}>⭐</span>
      </div>

      {rewards.length === 0 ? (
        <div className="lf-card lf-center" style={{ marginTop: 14 }}><i>🎁</i>ยังไม่มีของรางวัลในขณะนี้</div>
      ) : rewards.map(reward => {
        const canRedeem  = userPoints >= reward.points_required;
        const lacking    = reward.points_required - userPoints;
        const outOfStock = reward.stock !== null && reward.stock === 0;
        const ok = canRedeem && !outOfStock;
        const msg = redeemMsg?.id === reward.id ? redeemMsg : null;
        return (
          <div key={reward.id} className={`lf-reward${ok ? " can" : ""}${outOfStock ? " out" : ""}`}>
            <div className="lf-reward-img">
              {reward.image_url ? <img src={reward.image_url} alt={reward.name} /> : <span style={{ fontSize: 72 }}>🎁</span>}
              {outOfStock ? <span className="lf-badge lf-badge--out">หมดชั่วคราว</span>
                : canRedeem ? <span className="lf-badge lf-badge--ok">แลกได้เลย</span> : null}
            </div>
            <div className="lf-reward-body">
              <div className="lf-reward-name">{reward.name}</div>
              {reward.description && <div className="lf-reward-desc">{reward.description}</div>}
              {reward.stock !== null && reward.stock > 0 && <div className="lf-reward-desc">เหลือ {reward.stock} ชิ้น</div>}
              <div className="lf-reward-row">
                <div className={`lf-cost${ok ? " ok" : ""}`}>{reward.points_required.toLocaleString()} แต้ม</div>
                <div className={`lf-need${ok ? " ok" : ""}`}>{outOfStock ? "รอของเข้า" : canRedeem ? "✓ แต้มพอแล้ว" : `ขาดอีก ${lacking.toLocaleString()} แต้ม`}</div>
              </div>
              {ok && !msg?.ok && (
                <button className="lf-btn lf-btn--accent" style={{ marginTop: 12 }} onClick={() => handleRedeem(reward)} disabled={redeemingId === reward.id}>
                  {redeemingId === reward.id ? "กำลังส่งคำขอ…" : "🎁 แลกเลย"}
                </button>
              )}
              {msg && <div className={`lf-msg ${msg.ok ? "ok" : "err"}`}>{msg.ok ? "✅ " : "⚠️ "}{msg.text}</div>}
            </div>
          </div>
        );
      })}

      <div className="lf-card lf-rules">
        <h4>วิธีรับคะแนนและเงื่อนไขการแลกของรางวัล</h4>
        {RULES.map((item, i) => <div key={i} className="lf-rule"><i>{i + 1}</i><div>{item}</div></div>)}
      </div>
    </Shell>
  );
}
