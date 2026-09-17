"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { isReview, reviewQS } from "../review";
import { Shell, Loading } from "../ui";
import Icon, { type IconName } from "../components/Icon";
import { BAHT_PER_POINT, birthdayFrom, firstTierOf } from "../lib/perks";
import { ProblemScreen } from "../components/ProblemNotice";
import { callApi, problemOf, redeemErrorText, SHOP_PHONE, SHOP_TEL, type Problem } from "../lib/api";
import { formatDate } from "../lib/tiers";
import type { PendingRedemption, RedeemSummary } from "../lib/types";

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

// กติกา — c2 (ผู้ตรวจ c1): เดิมเป็นภาษาทางการ ("คะแนน" "บริษัทขอสงวนสิทธิ์") และขัดกับหน้าอื่น
// (บอกให้เปิดบัตรตอนสะสม / บอกว่าหักแต้มทันที) · ตอนนี้พูดภาษาเดียวกับทุกหน้า และตรงกับระบบจริง:
//   สะสม = บอกเบอร์ที่แคชเชียร์ · แลก = กดแล้วแต้ม "ถูกจอง" · หักจริงตอนรับของ · ยกเลิกได้ที่ร้าน
//   บิลเงินเชื่อไม่สะสมแต้ม (บอทฝั่งร้าน hero_points_watch.js ข้ามลูกค้าเครดิต)
function rulesText(minReward: number | null): string[] {
  return [
    "แลกส่วนลดเงินสด 1 แต้ม = 1 บาท",
    `ซื้อทุก ${BAHT_PER_POINT} บาท ได้ 1 แต้ม คิดต่อบิล เศษที่ไม่ครบ ${BAHT_PER_POINT} บาทปัดทิ้ง · ซื้อทุกครั้งบอกเบอร์โทรที่แคชเชียร์ แต้มเข้าเองภายในวันที่ซื้อ`,
    "สมัครแล้วต้องยืนยันตัวตนที่ร้านครั้งเดียว แต้มเริ่มเข้าหลังยืนยัน บิลที่ซื้อก่อนยืนยันไม่ได้แต้มย้อนหลัง · บิลเงินเชื่อ (เครดิต) ไม่สะสมแต้ม",
    "แต้มใช้ได้ 1 ปี นับจากวันที่ได้ แต้มก้อนที่ใกล้หมดอายุจะขึ้นเตือนที่หน้าบัตร",
    `ตั้งแต่ระดับ ${firstTierOf("steel")} ซื้อเหล็กหรือเมทัลชีทราคาป้าย ได้แต้มพิเศษเพิ่ม (คิดทีละรายการ รายการที่ขอลดราคาได้แต้มปกติ) และมีคูปองวันเกิดเป็นแต้มตั้งแต่ระดับ ${birthdayFrom()}`,
    "ไม่ได้ซื้อเกิน 1 ปี ระดับจะลดชั่วคราว ยอดสะสมไม่หาย ซื้อครั้งถัดไปกลับระดับเดิมทันที · ร้านเตือนที่หน้าบัตรล่วงหน้า 3 เดือน",
    `กด "แลกเลย" แล้วกดยืนยัน แต้มจะถูกจองไว้ให้ ยังไม่หัก${minReward ? ` · ของรางวัลเริ่มที่ ${minReward.toLocaleString()} แต้ม` : ""}`,
    "มารับของที่ร้าน เปิดหน้าบัตรสมาชิกในแอปให้พนักงานดู พร้อมบอกเลขคำขอ (#REQ-…) พนักงานหักแต้มตอนส่งของให้",
    "เปลี่ยนใจก่อนรับของ แจ้งพนักงานหรือโทรร้านให้ยกเลิกคำขอได้ แต้มที่จองไว้คืนครบ · รับของแล้วคืนแต้มไม่ได้ค่ะ",
    "ถ้าร้านปรับกติกา จะแจ้งไว้ในหน้านี้ค่ะ",
  ];
}

/** รูปแทนของรางวัลที่ไม่มีรูป — เดาจากชื่อ ให้แต่ละชิ้นหน้าตาไม่ซ้ำกัน */
function rewardIcon(name: string): IconName {
  if (/ส่วนลด|คูปอง|เงินสด/.test(name)) return "ticket";
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

export default function RewardsPage() {
  const [token, setToken]     = useState("");
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [summary, setSummary] = useState<RedeemSummary | null>(null);   // null = ยังไม่สมัคร (เซิร์ฟเวอร์ยืนยันแล้ว)
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [redeemMsg, setRedeemMsg]     = useState<{ id: number; ok: boolean; text: string } | null>(null);
  // กดแลกครั้งแรก = เปิดกล่องยืนยัน (ผู้ตรวจ c1: กดครั้งเดียวแต้มโดนจองทันที ไม่มีจังหวะให้คิด)
  const [confirmId, setConfirmId]     = useState<number | null>(null);
  const tokenRef = useRef<string | null>(null);

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
    setRewards(rw.data.rewards);
    setSummary(nextSummary);
    return true;
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
    await loadAll(tok);
  }, [loadAll]);

  useEffect(() => {
    boot().finally(() => setLoading(false));
  }, [boot]);

  async function retry() {
    if (problem?.kind === "auth") { window.location.reload(); return; }
    setRetrying(true);
    try { await boot(); } finally { setRetrying(false); }
  }

  async function handleRedeem(reward: Reward) {
    if (!token) { setRedeemMsg({ id: reward.id, ok: false, text: redeemErrorText(problemOf("AUTH_REQUIRED")) }); return; }
    setRedeemingId(reward.id);
    setRedeemMsg(null);
    setConfirmId(null);
    try {
      const r = await callApi<{ success?: boolean; requestId?: number; available_points?: number }>("/api/liff/redeem" + reviewQS(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rewardId: reward.id }),
      });
      if (!r.ok || !r.data.success || typeof r.data.requestId !== "number") {
        const p = r.ok ? problemOf("SERVER_ERROR") : r.problem;
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
      setRedeemMsg({ id: reward.id, ok: true, text: `ส่งคำขอแล้ว #REQ-${requestId} · แต้มถูกจองไว้ให้ มารับของที่ร้านได้เลย พนักงานหักแต้มตอนรับของ · เปลี่ยนใจแจ้งร้านให้ยกเลิกได้ค่ะ` });
    } finally {
      setRedeemingId(null);
    }
  }

  if (loading) return <Loading />;

  const back = { label: "บัตรสมาชิก", href: "/liff" + reviewQS() };
  if (problem) return (
    <ProblemScreen sub="ของรางวัล · แลกแต้มสะสม" what="ของรางวัลและแต้มของคุณ" problem={problem} onRetry={retry} retrying={retrying} back={back} />
  );

  const available = Math.max(0, summary?.available_points ?? 0);
  const reservedPts = summary?.pending_points ?? 0;

  return (
    <Shell sub="ของรางวัล · แลกแต้มสะสม" back={back} short layout="catalog">
      {summary && summary.earns_points === false && (
        <div className="lf-note lf-note--warn" role="status">
          <b>ยังไม่ได้ยืนยันตัวตน — ซื้อของตอนนี้แต้มยังไม่เข้า</b>
          ครั้งหน้าที่มาร้าน แจ้งพนักงานว่า &quot;ยืนยันสมาชิก LINE&quot; พร้อมบอกเบอร์ที่สมัครไว้ หลังยืนยันแล้วแต้มจากบิลถัดไปจะเข้าเองค่ะ
        </div>
      )}
      {summary ? (
        <div className="lf-balance">
          <div className="lf-balance-main">
            <span>แต้มใช้ได้ตอนนี้</span><b>{available.toLocaleString()}</b>
            {reservedPts > 0 && (
              <div className="lf-balance-split">
                <span className="lf-nw">แต้มทั้งหมด {summary.points.toLocaleString()}</span>
                <span className="lf-nw lf-balance-held">จองไว้แล้ว {reservedPts.toLocaleString()} แต้ม</span>
              </div>
            )}
          </div>
          <i><Icon name="star" size={32} /></i>
        </div>
      ) : (
        <div className="lf-balance lf-balance--signup">
          <div className="lf-balance-main">
            <span>ยังไม่ได้สมัครสมาชิก</span>
            <p>สมัครฟรีก่อน แล้วสะสมแต้มมาแลกของรางวัลได้ค่ะ</p>
          </div>
          <button type="button" className="lf-btn lf-btn--primary lf-btn--sm lf-balance-cta" onClick={() => (window.location.href = "/liff" + reviewQS())}>
            สมัครสมาชิก <Icon name="chevron" size={18} />
          </button>
        </div>
      )}

      {summary && summary.pending.length > 0 && (
        <section className="lf-card lf-reqs" aria-label="คำขอที่รอรับของ">
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
      ) : rewards.map(reward => {
        const st = cardState(reward, summary, available);
        const ok = st.kind === "can";
        const out = st.kind === "out";
        const msg = redeemMsg?.id === reward.id ? redeemMsg : null;
        const reserved = summary?.reserved_by_reward[String(reward.id)] ?? 0;
        const left = reward.stock === null ? null : Math.max(0, reward.stock - reserved);
        return (
          <div key={reward.id} className={`lf-reward${ok ? " can" : ""}${out ? " out" : ""}${st.kind === "mine" ? " mine" : ""}`}>
            <div className="lf-reward-img">
              {reward.image_url ? <img src={reward.image_url} alt={reward.name} /> : <Icon name={rewardIcon(reward.name)} size={72} strokeWidth={1.5} />}
              {out ? <span className="lf-badge lf-badge--out">{st.reservedFull ? "ถูกจองครบ" : "หมดชั่วคราว"}</span>
                : st.kind === "mine" ? <span className="lf-badge lf-badge--mine">รอรับของ</span>
                : ok ? <span className="lf-badge lf-badge--ok">แลกได้เลย</span> : null}
            </div>
            <div className="lf-reward-body">
              <div className="lf-reward-name">{reward.name}</div>
              {reward.description && <div className="lf-reward-desc">{reward.description}</div>}
              {left !== null && left > 0 && <div className="lf-reward-desc">เหลือให้แลก {left.toLocaleString()} ชิ้น</div>}
              <div className="lf-reward-row">
                <div className={`lf-cost${ok ? " ok" : ""}`}>{reward.points_required.toLocaleString()} แต้ม</div>
                <div className={`lf-need${ok ? " ok" : ""}`}>
                  {st.kind === "can" ? <><Icon name="check" size={18} /> แต้มพอแล้ว</>
                    : st.kind === "lack" ? <>ขาดอีก {st.lacking.toLocaleString()} แต้ม</>
                    : st.kind === "out" ? (st.reservedFull ? "มีคนจองครบแล้ว" : "รอของเข้า")
                    : st.kind === "mine" ? <>คำขอ #REQ-{st.req.id}</>
                    : "สมัครก่อนจึงแลกได้"}
                </div>
              </div>
              {/* เหตุผลที่แลกไม่ได้ — บอกก่อนกด ไม่ต้องกดแล้วค่อยเด้ง */}
              {!msg && st.kind === "mine" && (
                <div className="lf-why lf-why--mine"><Icon name="hourglass" size={18} /><span>มีคำขอชิ้นนี้รออยู่แล้ว มารับของที่ร้านได้เลย</span></div>
              )}
              {!msg && st.kind === "out" && (
                <div className="lf-why"><Icon name="alertCircle" size={18} /><span>{st.reservedFull ? "ของที่เหลือถูกจองครบแล้ว รอรอบของเข้าถัดไปนะคะ" : "ของหมดชั่วคราว รอรอบของเข้าถัดไปนะคะ"}</span></div>
              )}
              {!msg && st.kind === "lack" && reservedPts > 0 && (summary?.points ?? 0) >= reward.points_required && (
                <div className="lf-why"><Icon name="alertCircle" size={18} /><span>แต้มส่วนหนึ่งถูกจองไว้กับคำขอที่รอรับของ</span></div>
              )}
              {ok && confirmId !== reward.id && redeemingId !== reward.id && (
                <button className="lf-btn lf-btn--accent lf-btn--stack" onClick={() => { setRedeemMsg(null); setConfirmId(reward.id); }} disabled={redeemingId !== null}>
                  <Icon name="gift" size={22} /> แลกเลย
                </button>
              )}
              {ok && (confirmId === reward.id || redeemingId === reward.id) && (
                <div className="lf-confirm" role="group" aria-label={`ยืนยันแลก ${reward.name}`}>
                  <b>ยืนยันแลกชิ้นนี้?</b>
                  <div className="lf-confirm-math">
                    <span>ใช้</span><b>{reward.points_required.toLocaleString()} แต้ม</b>
                    <span>เหลือใช้ได้</span><b>{Math.max(0, available - reward.points_required).toLocaleString()} แต้ม</b>
                  </div>
                  <p>แต้มจะถูกจองไว้จนมารับของที่ร้าน · เปลี่ยนใจแจ้งพนักงานให้ยกเลิกได้</p>
                  <div className="lf-confirm-acts">
                    <button type="button" className="lf-btn lf-btn--ghost lf-btn--sm" onClick={() => setConfirmId(null)} disabled={redeemingId !== null}>ยังไม่แลก</button>
                    <button type="button" className="lf-btn lf-btn--accent lf-btn--sm" onClick={() => handleRedeem(reward)} disabled={redeemingId !== null}>
                      {redeemingId === reward.id ? "กำลังส่งคำขอ…" : "ยืนยันแลก"}
                    </button>
                  </div>
                </div>
              )}
              {msg && <div className={`lf-msg ${msg.ok ? "ok" : "err"}`} role={msg.ok ? "status" : "alert"}><i><Icon name={msg.ok ? "check" : "alert"} size={20} /></i><span>{msg.text}</span></div>}
            </div>
          </div>
        );
      })}

      <div className="lf-card lf-rules">
        <h4>กติกาสะสมแต้มและแลกของรางวัล</h4>
        {rulesText(rewards.length ? Math.min(...rewards.map(r => r.points_required)) : null).map((item, i) => <div key={i} className="lf-rule"><i>{i + 1}</i><div>{item}</div></div>)}
      </div>
    </Shell>
  );
}
