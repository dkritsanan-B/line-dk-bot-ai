"use client";
// จอสำเร็จหลังสมัคร — บอกผลก่อน แล้วบอกขั้นต่อไป (ยืนยันที่ร้าน) ก่อนพาไปบัตรรอยืนยัน

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
        <div className="lf-signup-next">
          <span>ขั้นต่อไป</span>
          <b>บอกพนักงานว่า “ยืนยันสมาชิก LINE”</b>
          <small>พร้อมเบอร์ <strong>{phone}</strong></small>
        </div>
        <button type="button" className="lf-btn lf-btn--primary" onClick={onContinue}>เข้าใจแล้ว</button>
      </section>
    </Shell>
  );
}
