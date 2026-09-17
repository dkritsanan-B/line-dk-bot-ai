"use client";
// ฟอร์มข้อมูลสมาชิก — ใช้ทั้งตอนสมัครและตอนแก้ไข (JSX เดิมจาก page.tsx ไม่เปลี่ยนข้อความ/คลาส)
import { useEffect, useRef } from "react";
import { Field } from "../ui";
import Icon from "./Icon";
import BirthdayField from "./BirthdayField";

export interface MemberFormProps {
  isEdit: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  birthday: string;
  company: string;
  onFirstName: (v: string) => void;
  onLastName: (v: string) => void;
  onPhone: (v: string) => void;
  onBirthday: (v: string) => void;
  onCompany: (v: string) => void;
  error: string;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function MemberForm({
  isEdit, firstName, lastName, phone, birthday, company,
  onFirstName, onLastName, onPhone, onBirthday, onCompany,
  error, submitting, onSubmit, onCancel,
}: MemberFormProps) {
  // ปุ่มสมัครติดขอบล่างจอ กดได้ตั้งแต่ยังเลื่อนไม่ถึงท้ายฟอร์ม → ข้อความผิดพลาดต้องเลื่อนมาให้เห็นเสมอ
  const errRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errRef.current?.scrollIntoView({ block: "center" });
  }, [error]);
  return (
    <div className="lf-form">
      <div className="lf-row">
        <Field label="ชื่อ">
          <input className="lf-input" type="text" value={firstName} onChange={e => onFirstName(e.target.value)} placeholder="ชื่อจริง" autoComplete="given-name" />
        </Field>
        <Field label="นามสกุล">
          <input className="lf-input" type="text" value={lastName} onChange={e => onLastName(e.target.value)} placeholder="นามสกุล" autoComplete="family-name" />
        </Field>
      </div>
      <Field label="เบอร์มือถือ" hint={isEdit ? "เปลี่ยนเบอร์ได้ที่ร้าน — พนักงานจะแก้ให้ค่ะ" : "ใช้ยืนยันตัวตนและรับแต้มจากบิลที่ร้าน"}>
        <input className="lf-input lf-input--num" type="tel" inputMode="numeric" maxLength={10} value={phone} readOnly={isEdit}
          onChange={e => onPhone(e.target.value.replace(/\D/g, ""))} placeholder="08X XXX XXXX" autoComplete="tel" />
      </Field>
      <Field label="วันเกิด" hint="รับของขวัญวันเกิดทุกปี">
        <BirthdayField value={birthday} onChange={onBirthday} />
      </Field>
      <Field label="บริษัท / ร้านค้า" optional>
        <input className="lf-input" type="text" value={company} onChange={e => onCompany(e.target.value)} placeholder="เช่น หจก. ก่อสร้างดี" autoComplete="organization" />
      </Field>
      {error && <div ref={errRef} role="alert" className="lf-alert lf-alert--err"><i><Icon name="alert" size={20} /></i><span>{error}</span></div>}
      <button className={`lf-btn lf-btn--primary${isEdit ? "" : " lf-ct-sticky"}`} onClick={onSubmit} disabled={submitting}>
        {submitting ? "กำลังบันทึก…" : isEdit ? "บันทึกข้อมูล" : "สมัครสมาชิกฟรี"}
      </button>
      {isEdit && <button className="lf-btn lf-btn--ghost" onClick={onCancel}>ยกเลิก</button>}
    </div>
  );
}
