"use client";
// ประวัติแต้ม + แท็บกรอง (P5)
// สีของแต่ละประเภทมาจากคลาสใน liff.css (--ok / --danger / --ink-3) ไม่ใช่ค่าสีในไฟล์นี้
//
// จังหวะของแถว — ทุกแถวสูงเท่ากันเสมอ (ผู้ตรวจนักออกแบบ: ต้องกวาดตาไล่ลงได้)
//   บรรทัด 1  ชื่อรายการ บรรทัดเดียว ยาวเกินตัดด้วย …      |  +185 แต้ม (ตัวเลขกับคำว่าแต้มบรรทัดเดียวกัน)
//   บรรทัด 2  วันที่ (+ เลขบิล) บรรทัดเดียว
//   บรรทัด 3  สถานะสั้น ๆ บรรทัดเดียว: "ใช้ได้ถึง …" (แต้มที่ได้รับ) / ประเภทรายการ (ใช้แลก/หมดอายุ)
//   ทุกบรรทัดห้ามตัดขึ้นบรรทัดใหม่ → ความสูงคงที่ ไม่ขึ้นกับความยาวข้อความ
//
// โหลดไม่ได้ ≠ ไม่มีรายการ: ถ้า API ล้มต้องบอกในกล่องนี้ว่าโหลดไม่ได้ + ปุ่มลองใหม่ (ห้ามขึ้น "ยังไม่มีรายการ")
import { formatDate } from "../lib/tiers";
import type { TxItem } from "../lib/types";
import type { Problem } from "../lib/api";
import Icon, { type IconName } from "./Icon";
import { ProblemNotice } from "./ProblemNotice";
import { BAHT_PER_POINT } from "../lib/perks";

export type TxFilter = "all" | "earn" | "redeem" | "expire";

const KIND: Record<string, { key: string; icon: IconName; label: string; sign: string }> = {
  earn:   { key: "earn",   icon: "star",      label: "สะสมแต้ม",      sign: "+" },
  redeem: { key: "redeem", icon: "gift",      label: "ใช้แลกของ",     sign: "−" },
  expire: { key: "expire", icon: "hourglass", label: "แต้มหมดอายุ",   sign: "−" },
};

// "บิล IV-690402 · เมทัลชีท 120 เมตร" → หัว = สินค้า, อ้างอิง = เลขบิล (ย้ายไปบรรทัดรอง)
function splitNote(note: string): { title: string; ref: string | null } {
  const m = note.match(/^บิล\s+(\S+)\s*·\s*(.+)$/);
  return m ? { title: m[2], ref: m[1] } : { title: note, ref: null };
}

// c2 (ผู้ตรวจ c1: แต้มเข้าน้อยกว่าที่คิดก็เถียงไม่ได้) — แถวบิลบอกยอดบิลด้วย, แถวแต้มพิเศษ/คูปองวันเกิดมีชื่อภาษาคน
//   รูปแบบ note ที่เซิร์ฟเวอร์เขียน:
//     แต้มพิเศษ  "โบนัส Gold บิล IV-690402 (เมทัลชีท (บาท/เมตร) 2บ/ม, …)"   (app/api/hero/points)
//     วันเกิด    "วันเกิด 2569 — คูปองวันเกิดระดับ Gold"                  (app/api/cron/birthday)
function specialNote(note: string): { title: string; ref: string | null; detail: string | null } | null {
  const b = note.match(/^โบนัส\s+(\S+)\s+บิล\s+(\S+)(?:\s+\((.+)\))?$/);
  if (b) {
    // "เมทัลชีท (บาท/เมตร) 2บ/ม, เหล็ก (ไม่รวมเหล็กเส้น) 1%" → "เมทัลชีท 2 บาท/เมตร · เหล็ก 1%"
    const parts = (b[3] ?? "").split(/,\s*/).filter(Boolean).map(p => {
      const m = p.match(/^(.*?)\s+([\d.]+)(บ\/ม|%)$/);
      if (!m) return p;
      const label = m[1].replace(/\s*\(.*\)\s*$/, "");
      return `${label} ${m[2]}${m[3] === "%" ? "%" : " บาท/เมตร"}`;
    });
    return { title: `แต้มพิเศษระดับ ${b[1]}`, ref: b[2], detail: parts.length ? `ราคาป้าย: ${parts.join(" · ")}` : "รายการที่จ่ายเต็มราคาป้าย" };
  }
  const d = note.match(/^(?:วันเกิด|ของขวัญวันเกิด)\s+\d{4}/);
  if (d) return { title: "คูปองวันเกิด", ref: null, detail: null };
  return null;
}

function rowText(t: TxItem, k: (typeof KIND)[string]): { title: string; ref: string | null; status: string; amount: string | null } {
  if (k.key === "expire") {
    return { title: k.label, ref: null, status: t.note ? t.note : "ครบ 1 ปีนับจากวันที่ได้", amount: null };
  }
  if (k.key === "redeem") {
    return { title: t.note || "แลกของรางวัล", ref: null, status: "ใช้แต้มแลกของรางวัล", amount: null };
  }
  const until = t.expires_at ? `ใช้ได้ถึง ${formatDate(t.expires_at)}` : "ได้รับแต้มสะสม";
  const sp = t.note ? specialNote(t.note) : null;
  if (sp) return { title: sp.title, ref: sp.ref, status: until, amount: sp.detail };
  const s = t.note ? splitNote(t.note) : { title: k.label, ref: null };
  const amt = Number(t.purchase_amount) || 0;
  return {
    title: s.title, ref: s.ref, status: until,
    amount: amt > 0 ? `ยอดบิล ${amt.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท` : null,
  };
}

export default function HistoryList({
  txList, txFilter, onFilter, loading, problem, onRetry,
}: {
  txList: TxItem[];
  txFilter: TxFilter;
  onFilter: (f: TxFilter) => void;
  loading?: boolean;
  problem?: Problem | null;
  onRetry: () => void;
}) {
  const filtered = txFilter === "all" ? txList : txList.filter(t => t.type === txFilter);
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
      const { title, ref, status, amount } = rowText(t, k);
      const warnSoon = k.key === "earn" && t.expires_at && new Date(t.expires_at).getTime() - Date.now() < 90 * 86400000;
      return (
        <div key={t.id} className="lf-tx">
          <div className={`lf-tx-ic lf-tx-ic--${k.key}`}><Icon name={k.icon} size={22} /></div>
          <div className="lf-tx-main">
            <div className="lf-tx-head">
              <b title={title}>{title}</b>
              <div className={`lf-tx-amt lf-tx-amt--${k.key}`}>{k.sign}{t.points_earned.toLocaleString()}<small>แต้ม</small></div>
            </div>
            <span className="lf-tx-line">{formatDate(t.created_at)}{ref && <> · บิล {ref}</>}</span>
            {amount && <span className="lf-tx-line lf-tx-amtline" title={amount}>{amount}</span>}
            <span className={`lf-tx-line lf-tx-exp${warnSoon ? " lf-tx-exp--soon" : ""}`}>{status}</span>
          </div>
        </div>
      );
    });
  }
  return (
    <div className="lf-card lf-histcard">
      <div className="lf-tabs" role="tablist">
        {([{ key: "all", label: "ทั้งหมด" }, { key: "earn", label: "ได้รับ" }, { key: "redeem", label: "ใช้แล้ว" }, { key: "expire", label: "หมดอายุ" }] as const).map(tab => (
          <button key={tab.key} role="tab" aria-selected={txFilter === tab.key} className={`lf-tab${txFilter === tab.key ? " on" : ""}`} onClick={() => onFilter(tab.key)}>{tab.label}</button>
        ))}
      </div>
      {!problem && !loading && txList.length > 0 && (
        <p className="lf-histnote">แต้มปกติ = ยอดบิล ÷ {BAHT_PER_POINT} ปัดเศษทิ้ง · แต้มพิเศษตามระดับขึ้นเป็นแถวแยก</p>
      )}
      {body}
    </div>
  );
}
