"use client";
// จอสำเร็จหลังสมัคร — บอกผลก่อน แล้วบอกขั้นต่อไป (ยืนยันที่ร้าน) ก่อนพาไปบัตรรอยืนยัน
// r5 (ผู้ตรวจ): เพิ่มตัวอย่างบัตรย่อ (ระดับเริ่มต้น · 0 แต้ม · รอยืนยัน) ให้เห็นว่าได้อะไรแล้ว ไม่ใช่การ์ดลอยกลางหน้าว่าง
//   แต้มยังไม่เข้าจนกว่าจะยืนยัน จึงเป็น 0 เสมอ
// r7 (ผู้ตรวจ): ป้ายระดับ "Welcome" ที่นี่ไม่ตรงกับหน้าบัตร (หน้าบัตรตอนรอยืนยันใช้ป้าย "รอยืนยัน" อย่างเดียว)
//   → ตัดป้ายระดับออก เหลือ "รอยืนยัน" ป้ายเดียว หน้าตาเดียวกันทั้งสองจอ

import { Shell } from "../ui";
import Icon from "./Icon";

export default function SignupSuccess({ name, phone, onContinue }: {
  name: string;
  phone: string;
  onContinue: () => void;
}) {
  return (
    <Shell sub="สมัครสมาชิกเรียบร้อย" layout="form">
      <section className="lf-card lf-signup-done" aria-labelledby="lf-signup-done-title">
        <div className="lf-signup-done-check"><Icon name="check" size={42} strokeWidth={2.4} /></div>
        <h1 id="lf-signup-done-title"><span className="lf-nw">สมัครสำเร็จ</span> <span className="lf-nw">ยินดีต้อนรับค่ะ</span> <span className="lf-nw">คุณ{name}</span></h1>

        <div className="lf-signup-mini" aria-label="บัตรสมาชิกของคุณ">
          {/* ชื่อ + ป้าย "รอยืนยัน" แถวเดียวกัน — เรียงแบบเดียวกับบัตรรอยืนยันหน้าบัตรสมาชิก */}
          <div className="lf-signup-mini-top">
            <span className="lf-signup-mini-name">{name}</span>
            <span className="lf-signup-mini-wait"><Icon name="hourglass" size={16} /> รอยืนยัน</span>
          </div>
          {/* เบอร์ตัวใหญ่อยู่ในกล่อง "ขั้นต่อไป" ที่เดียว */}
          <div className="lf-signup-mini-row">
            <span className="lf-signup-mini-pts"><b>0</b> แต้ม</span>
          </div>
          <small>แต้มเริ่มเข้าหลังยืนยันที่ร้าน</small>
        </div>

        <div className="lf-signup-next">
          <span>ขั้นต่อไป</span>
          <b>บอกพนักงานว่า “ยืนยันสมาชิก LINE”</b>
          <small>พร้อมเบอร์ <strong>{phone}</strong></small>
        </div>
        <button type="button" className="lf-btn lf-btn--primary" onClick={onContinue}>เข้าใจแล้ว · ไปที่บัตรสมาชิก</button>
      </section>
    </Shell>
  );
}
