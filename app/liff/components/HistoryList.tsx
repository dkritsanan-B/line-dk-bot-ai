"use client";
// ประวัติแต้ม + แท็บกรอง (P5)
// สีของแต่ละประเภทมาจากคลาสใน liff.css (--ok / --danger / --ink-3) ไม่ใช่ค่าสีในไฟล์นี้
//
// จังหวะของแถว (ผู้ตรวจ r4: ชื่อบิลตัดคำค้างบรรทัด + วันหมดอายุพ่วงท้ายจนแถวสูงไม่เท่ากัน):
//   บรรทัด 1  ชื่อรายการ — บรรทัดเดียวเสมอ ยาวเกินตัดด้วย …
//   บรรทัด 2  เลขบิล/ประเภท · วันที่
//   บรรทัด 3  (เฉพาะแต้มที่ได้รับ) หมดอายุวันไหน — บรรทัดของมันเอง
//   ขวาของบรรทัด 1  +185 แต้ม บรรทัดเดียวกัน กวาดตาไล่ลงได้ · บรรทัดรองจึงได้ความกว้างเต็ม ไม่ต้องตัดวันที่
import { formatDate } from "../lib/tiers";
import type { TxItem } from "../lib/types";
import Icon, { type IconName } from "./Icon";

export type TxFilter = "all" | "earn" | "redeem" | "expire";

const KIND: Record<string, { key: string; icon: IconName; label: string; sign: string }> = {
  earn:   { key: "earn",   icon: "star",      label: "สะสมแต้ม",      sign: "+" },
  redeem: { key: "redeem", icon: "gift",      label: "ใช้แลกของ",     sign: "−" },
  expire: { key: "expire", icon: "hourglass", label: "แต้มหมดอายุ",   sign: "−" },
};

// "บิล IV-690402 · เมทัลชีท 120 เมตร" → หัว = สินค้า, อ้างอิง = เลขบิล (ย้ายไปบรรทัดรอง)
function splitNote(note: string): { title: string; ref: string | null } {
  const m = note.match(/^(บิล\s+\S+)\s*·\s*(.+)$/);
  return m ? { title: m[2], ref: m[1] } : { title: note, ref: null };
}

export default function HistoryList({
  txList, txFilter, onFilter,
}: {
  txList: TxItem[];
  txFilter: TxFilter;
  onFilter: (f: TxFilter) => void;
}) {
  const filtered = txFilter === "all" ? txList : txList.filter(t => t.type === txFilter);
  return (
    <div className="lf-card lf-histcard">
      <div className="lf-tabs" role="tablist">
        {([{ key: "all", label: "ทั้งหมด" }, { key: "earn", label: "ได้รับ" }, { key: "redeem", label: "ใช้แล้ว" }, { key: "expire", label: "หมดอายุ" }] as const).map(tab => (
          <button key={tab.key} role="tab" aria-selected={txFilter === tab.key} className={`lf-tab${txFilter === tab.key ? " on" : ""}`} onClick={() => onFilter(tab.key)}>{tab.label}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="lf-empty">ยังไม่มีรายการในหมวดนี้</div>
      ) : filtered.map(t => {
        const k = KIND[t.type] ?? KIND.expire;
        // แต้มหมดอายุ: หัวรายการต้องเป็น "แต้มหมดอายุ" เสมอ (โน้ตอย่าง "แต้มครบ 1 ปี" อ่านแล้วงงว่าได้หรือเสีย)
        let title: string, ref: string | null;
        if (k.key === "expire" || !t.note) { title = k.label; ref = t.note ?? null; }
        else {
          const s = splitNote(t.note);
          title = s.title;
          ref = s.ref ?? (k.key === "earn" ? null : k.label);
        }
        return (
          <div key={t.id} className="lf-tx">
            <div className={`lf-tx-ic lf-tx-ic--${k.key}`}><Icon name={k.icon} size={22} /></div>
            <div className="lf-tx-main">
              <div className="lf-tx-head">
                <b title={title}>{title}</b>
                <div className={`lf-tx-amt lf-tx-amt--${k.key}`}>{k.sign}{t.points_earned.toLocaleString()}<small>แต้ม</small></div>
              </div>
              <span>{ref && <><span className="lf-nw">{ref}</span> · </>}<span className="lf-nw">{formatDate(t.created_at)}</span></span>
              {k.key === "earn" && t.expires_at && (
                <span className="lf-tx-exp">หมดอายุ <span className="lf-nw">{formatDate(t.expires_at)}</span></span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
