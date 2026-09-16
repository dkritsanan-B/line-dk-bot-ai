"use client";
// จอ/กล่องแจ้งปัญหา — ชิ้นเดียวใช้ร่วมทั้ง /liff และ /liff/rewards (16 ก.ย. 69)
//
// ช่างต้องรู้ 3 อย่างทันที: เกิดอะไร · แต้มหายไหม (ไม่หาย) · ต้องทำอะไรต่อ (ลองใหม่ / เปิดจาก LINE / โทรร้าน)
// ห้ามใช้จอนี้แทน "ยังไม่มีรายการ" หรือ "ยังไม่สมัคร" — สองอย่างนั้นเป็นความจริงคนละเรื่อง
//   ProblemNotice  = กล่องในการ์ด (ใช้ในกล่องประวัติแต้ม ฯลฯ)
//   ProblemScreen  = ทั้งหน้า (หัวหน้าเว็บ + การ์ดแจ้งปัญหา + บัตรล่าสุดที่จำไว้ + วันนี้ซื้อของได้แต้มไหม)
//
// c2 (ผู้ตรวจ c1):
//   - กล่องย่อย (compact) พูดเฉพาะสิ่งที่โหลดไม่ได้ ไม่เขียนเหมือนทั้งระบบล่ม
//   - รหัสปัญหาเป็นบรรทัดเล็กสำหรับแจ้งร้าน ไม่ใช่หัวข้อ
//   - วันระบบล่ม: โชว์บัตรล่าสุดที่เครื่องจำไว้ + บอกว่าบิลวันนี้ยังได้แต้ม
//     (จริงตามบอทฝั่งร้าน hero_points_watch.js: ดูบิลย้อน 2 วัน และบิลที่ส่งไม่สำเร็จจะลองใหม่รอบถัดไป)
import { useEffect, useState } from "react";
import { Shell } from "../ui";
import { SHOP_PHONE, SHOP_TEL, type Problem } from "../lib/api";
import { loadCard, type CardSnapshot } from "../lib/cardCache";
import { formatDate } from "../lib/tiers";
import Icon from "./Icon";

function copyOf(p: Problem, what: string, compact?: boolean): { title: string; body: string; showPhone: boolean } {
  if (p.kind === "auth") {
    return {
      title: "หมดเวลาใช้งานหน้านี้",
      body: "กรุณาปิดหน้านี้ แล้วเปิดใหม่จากเมนูใน LINE ของร้าน · แต้มของคุณไม่หายค่ะ",
      showPhone: false,
    };
  }
  if (compact) {
    return {
      title: `โหลด${what}ไม่ได้`,
      body: p.kind === "offline"
        ? "อินเทอร์เน็ตอาจหลุด เช็คสัญญาณแล้วกดลองใหม่ค่ะ · แต้มบนบัตรยังถูกต้อง"
        : "ขัดข้องเฉพาะส่วนนี้ แต้มบนบัตรยังถูกต้อง รอสักครู่แล้วกดลองใหม่ค่ะ",
      showPhone: false,
    };
  }
  if (p.kind === "offline") {
    return {
      title: `โหลด${what}ไม่ได้`,
      body: "อินเทอร์เน็ตอาจหลุดหรือสัญญาณอ่อน เช็คเน็ตแล้วกดลองใหม่ · แต้มของคุณไม่หายค่ะ",
      showPhone: true,
    };
  }
  return {
    title: "ระบบขัดข้องชั่วคราว",
    body: `ตอนนี้โหลด${what}ไม่ได้ แต้มของคุณไม่หาย ยังอยู่ครบ รอสักครู่แล้วกดลองใหม่ค่ะ`,
    showPhone: true,
  };
}

export function ProblemNotice({ problem, what = "ข้อมูล", onRetry, retrying, compact }: {
  problem: Problem;
  /** สิ่งที่โหลดไม่ได้ เช่น "บัตรสมาชิก" "ประวัติแต้ม" */
  what?: string;
  onRetry: () => void;
  retrying?: boolean;
  compact?: boolean;
}) {
  const c = copyOf(problem, what, compact);
  return (
    <div className={`lf-problem${compact ? " lf-problem--compact" : ""}${problem.kind === "auth" ? " lf-problem--auth" : ""}`} role="alert">
      <div className="lf-problem-head">
        <i><Icon name={problem.kind === "auth" ? "alertCircle" : "alert"} size={compact ? 22 : 28} /></i>
        <b>{c.title}</b>
      </div>
      <p className="lf-problem-body">{c.body}</p>
      <div className="lf-problem-acts">
        <button type="button" className="lf-btn lf-btn--primary lf-btn--sm" onClick={onRetry} disabled={retrying}>
          {retrying ? "กำลังลองใหม่…" : <><Icon name="refresh" size={20} /> ลองใหม่</>}
        </button>
        {c.showPhone && (
          <a className="lf-btn lf-btn--ghost lf-btn--sm lf-problem-tel" href={SHOP_TEL}>
            <Icon name="phone" size={20} /> โทรร้าน <span className="lf-nw">{SHOP_PHONE}</span>
          </a>
        )}
      </div>
      {!compact && problem.kind !== "auth" && (
        <div className="lf-problem-code">ถ้าโทรหาร้าน แจ้งรหัสนี้ได้ค่ะ: {problem.code}</div>
      )}
    </div>
  );
}

/** ระหว่างระบบล่ม — ลูกค้ายังซื้อของได้ และยังมีบัตรให้โชว์ */
function MeanwhileCard({ snap }: { snap: CardSnapshot | null }) {
  return (
    <section className="lf-card lf-meanwhile" aria-label="ระหว่างนี้">
      <h3><Icon name="check" size={22} /> วันนี้ซื้อของได้ตามปกติ</h3>
      <p>บอกเบอร์โทรที่แคชเชียร์เหมือนเดิม แต้มคิดจากบิลในระบบร้าน <b>บิลวันนี้ยังได้แต้ม</b> ระบบจะเติมให้เองเมื่อกลับมาใช้ได้ค่ะ</p>
      {snap && (
        <div className="lf-snap">
          <div className="lf-snap-head">
            <b>บัตรของคุณ (ข้อมูลล่าสุดที่เครื่องนี้จำไว้)</b>
            <span>ณ {formatDate(snap.savedAt)} · โชว์พนักงานได้</span>
          </div>
          <div className="lf-snap-row"><span>ชื่อ</span><b>{snap.name || "-"}</b></div>
          <div className="lf-snap-row"><span>เบอร์โทร</span><b className="lf-snap-num">{snap.phone}</b></div>
          <div className="lf-snap-row"><span>ระดับ</span><b>{snap.tier}</b></div>
          <div className="lf-snap-row"><span>แต้มใช้ได้</span><b className="lf-snap-num">{snap.points.toLocaleString()} แต้ม</b></div>
        </div>
      )}
    </section>
  );
}

export function ProblemScreen({ sub, what, problem, onRetry, retrying, back }: {
  sub: string;
  what: string;
  problem: Problem;
  onRetry: () => void;
  retrying?: boolean;
  back?: { label: string; href: string };
}) {
  const [snap, setSnap] = useState<CardSnapshot | null>(null);
  useEffect(() => { setSnap(loadCard()); }, []);
  return (
    <Shell sub={sub} short back={back}>
      <div className="lf-card">
        <ProblemNotice problem={problem} what={what} onRetry={onRetry} retrying={retrying} />
      </div>
      {problem.kind !== "auth" && <MeanwhileCard snap={snap} />}
    </Shell>
  );
}
