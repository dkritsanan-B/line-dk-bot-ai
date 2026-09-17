"use client";
// ช่องวันเกิดแบบ วัน / เดือน / ปี พ.ศ.
// แทน <input type="date"> ที่บน Android ขึ้น "dd/mm/yyyy" แบบอังกฤษ (ช่างไม่รู้ว่าใส่ พ.ศ. หรือ ค.ศ.)
// และต้องเลื่อนปฏิทินย้อนหลายสิบปี · ค่าที่ส่งออกยังเป็น "YYYY-MM-DD" (ค.ศ.) เหมือนเดิม ตรรกะหลังบ้านไม่เปลี่ยน
import { useEffect, useState } from "react";

const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const pad = (n: number) => String(n).padStart(2, "0");

function split(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? { y: m[1], mo: String(+m[2]), d: String(+m[3]) } : { y: "", mo: "", d: "" };
}

export default function BirthdayField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [parts, setParts] = useState(() => split(value));
  // ค่าจากภายนอกเปลี่ยน (เช่น เปิดจอแก้ไข) → ตามค่านั้น
  useEffect(() => { if (value) setParts(split(value)); }, [value]);

  const nowY = new Date().getFullYear();
  const years = Array.from({ length: 91 }, (_, i) => nowY - i);
  const daysIn = parts.y && parts.mo ? new Date(+parts.y, +parts.mo, 0).getDate() : 31;

  function update(next: Partial<typeof parts>) {
    const p = { ...parts, ...next };
    if (p.d && p.y && p.mo) {
      const max = new Date(+p.y, +p.mo, 0).getDate();
      if (+p.d > max) p.d = String(max);
    }
    setParts(p);
    onChange(p.d && p.mo && p.y ? `${p.y}-${pad(+p.mo)}-${pad(+p.d)}` : "");
  }

  return (
    <div className="lf-date">
      <select className="lf-input lf-select" aria-label="วันที่เกิด" value={parts.d} onChange={e => update({ d: e.target.value })}>
        <option value="">วัน</option>
        {Array.from({ length: daysIn }, (_, i) => i + 1).map(d => <option key={d} value={String(d)}>{d}</option>)}
      </select>
      <select className="lf-input lf-select" aria-label="เดือนเกิด" value={parts.mo} onChange={e => update({ mo: e.target.value })}>
        <option value="">เดือน</option>
        {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
      </select>
      <select className="lf-input lf-select" aria-label="ปีเกิด (พ.ศ.)" value={parts.y} onChange={e => update({ y: e.target.value })}>
        <option value="">ปี พ.ศ.</option>
        {years.map(y => <option key={y} value={String(y)}>{y + 543}</option>)}
      </select>
    </div>
  );
}
