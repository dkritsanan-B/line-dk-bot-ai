"use client";
// ประวัติแต้ม + แท็บกรอง (P5) — JSX เดิมจาก page.tsx
import { formatDate } from "../lib/tiers";
import type { TxItem } from "../lib/types";

export type TxFilter = "all" | "earn" | "redeem" | "expire";

export default function HistoryList({
  txList, txFilter, onFilter,
}: {
  txList: TxItem[];
  txFilter: TxFilter;
  onFilter: (f: TxFilter) => void;
}) {
  const filtered = txFilter === "all" ? txList : txList.filter(t => t.type === txFilter);
  return (
    <div className="lf-card" style={{ marginTop: 12 }}>
      <div className="lf-tabs">
        {([{ key: "all", label: "ทั้งหมด" }, { key: "earn", label: "ได้รับ" }, { key: "redeem", label: "ใช้แล้ว" }, { key: "expire", label: "หมดอายุ" }] as const).map(tab => (
          <button key={tab.key} className={`lf-tab${txFilter === tab.key ? " on" : ""}`} onClick={() => onFilter(tab.key)}>{tab.label}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="lf-empty">ยังไม่มีรายการในหมวดนี้</div>
      ) : filtered.map(t => {
        const isEarn = t.type === "earn", isRedeem = t.type === "redeem";
        const color = isEarn ? "#1E8E3E" : isRedeem ? "#C62828" : "#8A94A6";
        return (
          <div key={t.id} className="lf-tx">
            <div className="lf-tx-ic">{isEarn ? "⭐" : isRedeem ? "🎁" : "⏳"}</div>
            <div className="lf-tx-main">
              <b>{isEarn ? "สะสมแต้ม" : isRedeem ? "แลกของรางวัล" : "แต้มหมดอายุ"}</b>
              {t.note && <span>{t.note}</span>}
              <span>{formatDate(t.created_at)}{isEarn && t.expires_at ? ` · ใช้ได้ถึง ${formatDate(t.expires_at)}` : ""}</span>
            </div>
            <div className="lf-tx-amt" style={{ color }}>{isEarn ? "+" : "−"}{t.points_earned.toLocaleString()}<small>แต้ม</small></div>
          </div>
        );
      })}
    </div>
  );
}
