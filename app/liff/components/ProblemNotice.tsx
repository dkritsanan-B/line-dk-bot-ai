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
import { useEffect, useState, type CSSProperties } from "react";
import { Shell } from "../ui";
import { SHOP_LIFF_URL, SHOP_PHONE, SHOP_TEL, type Problem } from "../lib/api";
import { loadCard, type CardSnapshot } from "../lib/cardCache";
import { TIERS } from "../lib/tiers";
import Icon from "./Icon";

// รหัสอ้างอิงที่ลูกค้าเห็น (17 ก.ย. 69 ผู้ตรวจนักออกแบบ) — เดิมโชว์รหัสดิบ "DB_UNAVAILABLE" ซึ่งลูกค้าอ่านไม่ออก
// ลูกค้าเห็นเลขสั้น E-xxx ไว้บอกพนักงานทางโทรศัพท์ · รหัสดิบยังอยู่ที่ data-code / title / console ให้ทีมร้านดู
//   E-1xx ฐานข้อมูล · E-2xx ตัวตน/ล็อกอิน · E-3xx LINE · E-4xx เน็ตฝั่งลูกค้า · E-5xx เซิร์ฟเวอร์ · E-900 ไม่รู้จัก
const PROBLEM_REF: Record<string, string> = {
  DB_UNAVAILABLE:   "E-101",
  AUTH_REQUIRED:    "E-201",
  LIFF_INIT:        "E-202",
  LINE_UNAVAILABLE: "E-301",
  OFFLINE:          "E-401",
  SERVER_ERROR:     "E-501",
};
export function problemRef(code: string): string {
  return PROBLEM_REF[code] ?? "E-900";
}

function copyOf(p: Problem, what: string, compact?: boolean): { title: string; body: string; showPhone: boolean } {
  if (p.kind === "auth") {
    return {
      title: "หมดเวลาใช้งานหน้านี้",
      body: "กรุณาปิดหน้านี้ แล้วเปิดใหม่ จากเมนูใน LINE ของร้าน · แต้มของคุณไม่หายค่ะ",
      showPhone: false,
    };
  }
  if (p.code === "LINE_UNAVAILABLE") {
    return {
      title: "เปิดหน้านี้จากแอป LINE",
      body: `ตอนนี้เชื่อมต่อ LINE ไม่สำเร็จ กรุณาเปิด${what} จากเมนูในแอป LINE อีกครั้งค่ะ`,
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
      title: "ไม่มีอินเทอร์เน็ต",
      body: `ตอนนี้โหลด${what}ไม่ได้ ระบบจะลองใหม่อัตโนมัติ เมื่ออินเทอร์เน็ตกลับมา · แต้มของคุณไม่หายค่ะ`,
      // r5: จอบอกให้แจ้งรหัสกับร้าน → ต้องมีปุ่มโทรด้วย (โทรออกไม่ต้องใช้อินเทอร์เน็ต)
      showPhone: true,
    };
  }
  return {
    title: "ระบบขัดข้องชั่วคราว",
    body: `ตอนนี้โหลด${what}ไม่ได้ แต้มของคุณไม่หาย ยังอยู่ครบ รอสักครู่แล้วกดลองใหม่ค่ะ`,
    showPhone: true,
  };
}

// ตัวตัดคำภาษาไทยของเบราว์เซอร์ (พจนานุกรม ICU) ตัดผิดได้ เช่น "แล้วก|ดลองใหม่" "กดล|องใหม่"
// → ให้ขึ้นบรรทัดใหม่ได้เฉพาะตรงช่องว่างที่เราเว้นไว้เอง (แต่ละวลีสั้นพอสำหรับจอ 320px) · " ·" ติดท้ายวลีก่อนหน้า
function nwChunks(text: string) {
  return text.split(/ (?!·)/).map((w, i) => <span key={i}>{i > 0 && " "}<span className="lf-nw">{w}</span></span>);
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
  const ref = problemRef(problem.code);
  const lineUrl = SHOP_LIFF_URL;
  async function closeWindow() {
    try {
      const liff = (await import("@line/liff")).default;
      liff.closeWindow();
    } catch {
      window.close();
    }
  }
  // รหัสดิบสำหรับทีมร้าน (เปิด DevTools ดูได้) — ไม่ขึ้นบนจอ
  useEffect(() => { console.warn(`[DK member] ${ref} = ${problem.code}${problem.serverMessage ? ` · ${problem.serverMessage}` : ""}`); }, [ref, problem.code, problem.serverMessage]);
  return (
    <div className={`lf-problem${compact ? " lf-problem--compact" : ""}${problem.kind === "auth" ? " lf-problem--auth" : ""}`} role="alert">
      <div className="lf-problem-head">
        <i><Icon name={problem.kind === "offline" ? "wifiOff" : problem.kind === "auth" ? "alertCircle" : "alert"} size={compact ? 22 : 28} /></i>
        <b>{c.title}</b>
      </div>
      <p className="lf-problem-body">{nwChunks(c.body)}</p>
      <div className="lf-problem-acts">
        {problem.kind === "auth" ? (
          <>
            <button type="button" className="lf-btn lf-btn--primary lf-btn--sm" onClick={closeWindow}>ปิดหน้านี้</button>
            {/* r5: ปุ่มรองแบบมีกรอบ (เดิมเป็นลิงก์ขีดเส้นใต้ กดยาก) — หน้าตาเดียวกับปุ่มโทรร้านในจอระบบขัดข้อง */}
            <button type="button" className="lf-btn lf-btn--ghost lf-btn--sm lf-problem-retry" onClick={onRetry} disabled={retrying}>
              {retrying ? "กำลังลองใหม่…" : <><Icon name="refresh" size={20} /> ลองใหม่</>}
            </button>
          </>
        ) : problem.code === "LINE_UNAVAILABLE" && lineUrl ? (
          <>
            <a className="lf-btn lf-btn--primary lf-btn--sm lf-problem-open-line" href={lineUrl}>เปิดใน LINE</a>
            <button type="button" className="lf-btn lf-btn--ghost lf-btn--sm lf-problem-retry" onClick={onRetry} disabled={retrying}>
              {retrying ? "กำลังลองใหม่…" : <><Icon name="refresh" size={20} /> ลองใหม่</>}
            </button>
          </>
        ) : (
          <button type="button" className="lf-btn lf-btn--primary lf-btn--sm" onClick={onRetry} disabled={retrying}>
            {retrying ? "กำลังลองใหม่…" : <><Icon name="refresh" size={20} /> ลองใหม่</>}
          </button>
        )}
        {c.showPhone && (
          <a className="lf-btn lf-btn--ghost lf-btn--sm lf-problem-tel" href={SHOP_TEL}>
            <Icon name="phone" size={20} /> โทรร้าน <span className="lf-nw">{SHOP_PHONE}</span>
          </a>
        )}
      </div>
      {!compact && problem.kind !== "auth" && (
        <div className="lf-problem-code" data-code={problem.code} title={problem.code}>ถ้าโทรหาร้าน แจ้งรหัสนี้ได้ค่ะ: <span className="lf-nw">{ref}</span></div>
      )}
    </div>
  );
}

/** ระหว่างระบบล่ม — ลูกค้ายังซื้อของได้ และยังมีบัตรให้โชว์ */
function MeanwhileCard({ snap }: { snap: CardSnapshot | null }) {
  const tier = TIERS.find(t => t.name === snap?.tier) ?? TIERS[TIERS.length - 1];
  const savedAt = snap ? new Date(snap.savedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "";
  return (
    <section className="lf-card lf-meanwhile" aria-label="ระหว่างนี้">
      <h3><Icon name="check" size={22} /> วันนี้ซื้อของได้ตามปกติ</h3>
      <p>บอกเบอร์โทรที่แคชเชียร์เหมือนเดิม แต้มคิดจากบิลในระบบร้าน <b>บิลวันนี้ยังได้แต้ม</b> ระบบจะเติมให้เอง<span className="lf-nw">เมื่อกลับมาใช้ได้ค่ะ</span></p>
      {snap && (
        // r5: บัตรที่จำไว้ต้องดูออกว่าไม่ใช่ข้อมูลสด — ป้าย "ข้อมูลล่าสุดที่บันทึกไว้" + ขอบเส้นประ (ภาษาเดียวกับบัตรพักระดับ)
        <div className="lf-snap lf-snap-card lf-snap-card--cached lf-mcard" data-ink={tier.ink} data-tier={tier.name} style={{ background: tier.cardGrad } as CSSProperties}>
          <div className="lf-snap-head">
            <span className="lf-snap-badge"><Icon name="history" size={16} /> ข้อมูลล่าสุดที่บันทึกไว้</span>
            <b>บัตรของคุณ · {snap.tier}</b>
            <span>บันทึกเมื่อ {savedAt} <span className="lf-nw">· ไม่ใช่ยอดสด</span></span>
          </div>
          <div className="lf-snap-name">{snap.name || "-"}</div>
          <div className="lf-snap-phone">{snap.phone}</div>
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
  useEffect(() => {
    if (problem.kind !== "offline") return;
    const handleOnline = () => onRetry();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [problem.kind, onRetry]);
  return (
    <Shell sub={sub} short back={back}>
      <div className="lf-card">
        <ProblemNotice problem={problem} what={what} onRetry={onRetry} retrying={retrying} />
      </div>
      {problem.kind !== "auth" && <MeanwhileCard snap={snap} />}
    </Shell>
  );
}
