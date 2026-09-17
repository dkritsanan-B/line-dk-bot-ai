"use client";
// ประวัติแต้ม + แท็บกรอง (P5)
// สีของแต่ละประเภทมาจากคลาสใน liff.css (--ok / --danger) + styles/content.css (lf-ct-*) ไม่ใช่ค่าสีในไฟล์นี้
//
// จังหวะของแถว (c3 ผู้ตรวจนักออกแบบ: ความเด่นต้องไล่จาก ชื่อ/แต้ม → รายละเอียด)
//   บรรทัด 1  ชื่อรายการ 16px/600 บรรทัดเดียว ยาวเกินตัดด้วย …  |  +185 แต้ม ชิดขวา
//   บรรทัด 2  "14 ก.ย. · IV-690402 · 18,500 บาท" 14px/400 บรรทัดเดียว
//   บรรทัด 3  "ใช้ได้ถึง …" สีอำพัน — เฉพาะแต้มที่เหลือ ≤ EXPIRE_SOON_DAYS วัน
// หัวข้อ "แต้มคิดอย่างไร" อยู่ท้ายรายการ (ของรอง)
//
// โหลดไม่ได้ ≠ ไม่มีรายการ: ถ้า API ล้มต้องบอกในกล่องนี้ว่าโหลดไม่ได้ + ปุ่มลองใหม่ (ห้ามขึ้น "ยังไม่มีรายการ")
import { formatDate } from "../lib/tiers";
import type { TxItem } from "../lib/types";
import type { Problem } from "../lib/api";
import Icon, { type IconName } from "./Icon";
import { ProblemNotice } from "./ProblemNotice";
import { PointsHowTo } from "./TierPerks";

export type TxFilter = "all" | "earn" | "redeem" | "expire";

/** เตือน "ใช้ได้ถึง" เฉพาะแต้มที่เหลือไม่เกินกี่วัน */
const EXPIRE_SOON_DAYS = 60;

const KIND: Record<string, { key: string; icon: IconName; label: string; sign: string }> = {
  earn:   { key: "earn",   icon: "star",      label: "สะสมแต้ม",      sign: "+" },
  redeem: { key: "redeem", icon: "gift",      label: "ใช้แลกของ",     sign: "−" },
  expire: { key: "expire", icon: "hourglass", label: "แต้มหมดอายุ",   sign: "−" },
};

/** "14 ก.ย." — ปีแสดงเฉพาะเมื่อไม่ใช่ปีนี้ เป็น พ.ศ. 4 หลักแบบเดียวกับ formatDate ทั้งระบบ ("8 ต.ค. 2568") */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("th-TH", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

// "บิล IV-690402 · เมทัลชีท 120 เมตร" → หัว = สินค้า, อ้างอิง = เลขบิล (ย้ายไปบรรทัดรอง)
function splitNote(note: string): { title: string; ref: string | null } {
  const m = note.match(/^บิล\s+(\S+)\s*·\s*(.+)$/);
  return m ? { title: m[2], ref: m[1] } : { title: note, ref: null };
}

// รูปแบบ note ที่เซิร์ฟเวอร์เขียน:
//   แต้มพิเศษ  "โบนัส Gold บิล IV-690402 (เมทัลชีท (บาท/เมตร) 2บ/ม, …)"   (app/api/hero/points)
//   วันเกิด    "วันเกิด 2569 — คูปองวันเกิดระดับ Gold"                  (app/api/cron/birthday)
// รายละเอียดในวงเล็บไม่แสดงแล้ว (c3) — คำอธิบายอยู่ใน "แต้มคิดอย่างไร"
function specialNote(note: string): { title: string; ref: string | null } | null {
  const b = note.match(/^โบนัส\s+(\S+)\s+บิล\s+(\S+)/);
  if (b) return { title: `แต้มพิเศษระดับ ${b[1]}`, ref: b[2] };
  if (/^(?:วันเกิด|ของขวัญวันเกิด)\s+\d{4}/.test(note)) return { title: "คูปองวันเกิด", ref: null };
  return null;
}

function rowText(t: TxItem, k: (typeof KIND)[string]): { title: string; meta: string } {
  const date = shortDate(t.created_at);
  if (k.key === "expire") return { title: k.label, meta: date };
  if (k.key === "redeem") return { title: t.note || "แลกของรางวัล", meta: date };
  const sp = t.note ? specialNote(t.note) : null;
  const s = sp ?? (t.note ? splitNote(t.note) : { title: k.label, ref: null });
  const amt = sp ? 0 : Number(t.purchase_amount) || 0;
  const parts = [date, s.ref, amt > 0 ? `${amt.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท` : null];
  return { title: s.title, meta: parts.filter(Boolean).join(" · ") };
}

export default function HistoryList({
  txList, txFilter, onFilter, loading, problem, onRetry, id,
}: {
  txList: TxItem[];
  txFilter: TxFilter;
  onFilter: (f: TxFilter) => void;
  loading?: boolean;
  problem?: Problem | null;
  onRetry: () => void;
  id?: string;
}) {
  const filtered = txFilter === "all" ? txList : txList.filter(t => t.type === txFilter);
  const now = Date.now();
  let body: React.ReactNode;
  if (problem) {
    body = <ProblemNotice problem={problem} what="ประวัติแต้ม" onRetry={onRetry} retrying={loading} compact />;
  } else if (loading) {
    body = <div className="lf-empty" aria-live="polite"><div className="lf-spin lf-spin--inline" />กำลังโหลดประวัติแต้ม…</div>;
  } else if (filtered.length === 0) {
    body = <div className="lf-empty">ยังไม่มีรายการในหมวดนี้</div>;
  } else {
    body = filtered.map(t => {
      const k = KIND[t.type] ?? KIND.expire;
      const { title, meta } = rowText(t, k);
      const left = k.key === "earn" && t.expires_at ? new Date(t.expires_at).getTime() - now : NaN;
      const soon = left >= 0 && left <= EXPIRE_SOON_DAYS * 86400000;
      return (
        <div key={t.id} className="lf-tx lf-ct-tx">
          <div className={`lf-tx-ic lf-tx-ic--${k.key}`}><Icon name={k.icon} size={22} /></div>
          <div className="lf-ct-tx-main">
            <div className="lf-ct-tx-head">
              <b className="lf-ct-tx-title" title={title}>{title}</b>
              <div className={`lf-tx-amt lf-tx-amt--${k.key}`}>{k.sign}{t.points_earned.toLocaleString()}<small>แต้ม</small></div>
            </div>
            <span className="lf-ct-tx-meta">{meta}</span>
            {soon && <span className="lf-ct-tx-soon">ใช้ได้ถึง {formatDate(t.expires_at!)}</span>}
          </div>
        </div>
      );
    });
  }
  return (
    <div className="lf-card lf-histcard lf-ct-hist" id={id}>
      <div className="lf-tabs" role="tablist">
        {([{ key: "all", label: "ทั้งหมด" }, { key: "earn", label: "ได้รับ" }, { key: "redeem", label: "ใช้แล้ว" }, { key: "expire", label: "หมดอายุ" }] as const).map(tab => (
          <button key={tab.key} role="tab" aria-selected={txFilter === tab.key} className={`lf-tab${txFilter === tab.key ? " on" : ""}`} onClick={() => onFilter(tab.key)}>{tab.label}</button>
        ))}
      </div>
      {body}
      {!problem && !loading && txList.length > 0 && <PointsHowTo />}
    </div>
  );
}
