"use client";
// ฟอร์มข้อมูลสมาชิก — ใช้ทั้งตอนสมัครและตอนแก้ไข (JSX เดิมจาก page.tsx ไม่เปลี่ยนข้อความ/คลาส)
import { useEffect, useRef, useState } from "react";
import { Field } from "../ui";
import Icon from "./Icon";
import BirthdayField from "./BirthdayField";
import PolicyContent from "@/app/privacy/PolicyContent";
import "@/app/privacy/privacy.css";

/** ข้อความเตือนตอนกดสมัครโดยยังไม่ติ๊กยอมรับนโยบาย — page.tsx ใช้ตัวเดียวกัน ช่องติ๊กจึงรู้ว่าต้องขึ้นกรอบแดง */
export const CONSENT_ERROR = "กรุณาติ๊ก “ยอมรับ นโยบายความเป็นส่วนตัว” ก่อนสมัครค่ะ";

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
  /** PDPA (18 ก.ย. 69): ติ๊กยอมรับนโยบายความเป็นส่วนตัว — บังคับเฉพาะตอนสมัคร (จอแก้ไขไม่มีช่องนี้) */
  consent?: boolean;
  onConsent?: (v: boolean) => void;
  error: string;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function MemberForm({
  isEdit, firstName, lastName, phone, birthday, company,
  onFirstName, onLastName, onPhone, onBirthday, onCompany, consent = false, onConsent,
  error, submitting, onSubmit, onCancel,
}: MemberFormProps) {
  // ปุ่มสมัครติดขอบล่างจอ กดได้ตั้งแต่ยังเลื่อนไม่ถึงท้ายฟอร์ม → ข้อความผิดพลาดต้องเลื่อนมาให้เห็นเสมอ
  const errRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errRef.current?.scrollIntoView({ block: "center" });
  }, [error]);
  // r5: ตรวจเบอร์ทันทีที่ออกจากช่อง (ไม่ต้องรอกดสมัคร) · กติกาเดียวกับ handleRegister ใน page.tsx
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneBad = !isEdit && phoneTouched && phone.length > 0 && !/^0\d{9}$/.test(phone);
  // PDPA: อ่านนโยบายในกล่องบนหน้าเดิม (ไม่เปลี่ยนหน้า) → ข้อมูลที่กรอกไว้ไม่หาย
  // ลิงก์ยังชี้ /privacy จริง เผื่อกดค้างเปิดแท็บใหม่
  const [policyOpen, setPolicyOpen] = useState(false);
  const consentBad = !isEdit && !consent && error === CONSENT_ERROR;
  useEffect(() => {
    if (!policyOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPolicyOpen(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [policyOpen]);
  return (
    <div className="lf-form">
      {/* r5: บอกครั้งเดียวว่าช่องไหนบังคับ — ช่องที่ไม่บังคับมีคำว่า (ถ้ามี) กำกับ */}
      {!isEdit && <p className="lf-form-req"><span className="lf-nw">กรอกทุกช่อง</span> <span className="lf-nw">ยกเว้นช่องที่เขียนว่า (ถ้ามี)</span></p>}
      <Field label="เบอร์มือถือ" hint={phoneBad ? undefined : isEdit ? "เปลี่ยนเบอร์ได้ที่ร้าน — พนักงานจะแก้ให้ค่ะ" : "ใช้ยืนยันตัวตนและรับแต้มจากบิลที่ร้าน"}>
        <input className={`lf-input lf-input--num${phoneBad ? " lf-input--bad" : ""}`} type="tel" inputMode="numeric" maxLength={10} value={phone} readOnly={isEdit}
          aria-invalid={phoneBad || undefined} aria-describedby={phoneBad ? "lf-phone-err" : undefined}
          onBlur={() => setPhoneTouched(true)}
          onChange={e => onPhone(e.target.value.replace(/\D/g, ""))} placeholder="08X XXX XXXX" autoComplete="tel" />
        {phoneBad && (
          <div id="lf-phone-err" className="lf-field-err">
            <Icon name="alert" size={18} /><span><span className="lf-nw">เบอร์มือถือต้องมี 10 หลัก</span> <span className="lf-nw">ขึ้นต้นด้วย 0</span></span>
          </div>
        )}
      </Field>
      <div className="lf-row">
        <Field label="ชื่อ">
          <input className="lf-input" type="text" value={firstName} onChange={e => onFirstName(e.target.value)} placeholder="เช่น สมชาย" autoComplete="given-name" />
        </Field>
        <Field label="นามสกุล">
          <input className="lf-input" type="text" value={lastName} onChange={e => onLastName(e.target.value)} placeholder="เช่น ใจดี" autoComplete="family-name" />
        </Field>
      </div>
      <Field label="วันเกิด" hint="รับของขวัญวันเกิดทุกปี">
        <BirthdayField value={birthday} onChange={onBirthday} />
      </Field>
      <Field label="บริษัท / ร้านค้า" optional>
        <input className="lf-input" type="text" value={company} onChange={e => onCompany(e.target.value)} placeholder="เช่น หจก. ก่อสร้างดี" autoComplete="organization" />
      </Field>
      {!isEdit && (
        <label className={`pv-consent${consentBad ? " pv-consent--bad" : ""}`}>
          <input type="checkbox" checked={consent} onChange={e => onConsent?.(e.target.checked)}
            aria-invalid={consentBad || undefined} aria-describedby={consentBad ? "lf-consent-err" : undefined} />
          <span>ยอมรับ <a href="/privacy" onClick={e => { e.preventDefault(); setPolicyOpen(true); }}>นโยบายความเป็นส่วนตัว</a></span>
        </label>
      )}
      {policyOpen && (
        <div className="pv-modal" onClick={e => { if (e.target === e.currentTarget) setPolicyOpen(false); }}>
          <div className="pv-sheet" role="dialog" aria-modal="true" aria-label="นโยบายความเป็นส่วนตัว">
            <div className="pv-sheet-head">
              <b>นโยบายความเป็นส่วนตัว</b>
              <button type="button" className="pv-sheet-x" onClick={() => setPolicyOpen(false)} autoFocus>ปิด</button>
            </div>
            <div className="pv-sheet-body"><PolicyContent headingLevel={2} /></div>
            <div className="pv-sheet-actions">
              <button type="button" className="lf-btn lf-btn--ghost lf-btn--sm" onClick={() => setPolicyOpen(false)}>ปิด</button>
              <button type="button" className="lf-btn lf-btn--primary lf-btn--sm" onClick={() => { onConsent?.(true); setPolicyOpen(false); }}>ยอมรับ</button>
            </div>
          </div>
        </div>
      )}
      {error && <div ref={errRef} id={consentBad ? "lf-consent-err" : undefined} role="alert" className="lf-alert lf-alert--err"><i><Icon name="alert" size={20} /></i><span>{error}</span></div>}
      <button className={`lf-btn lf-btn--primary${isEdit ? "" : " lf-ct-sticky"}`} onClick={onSubmit} disabled={submitting}>
        {submitting ? "กำลังบันทึก…" : isEdit ? "บันทึกข้อมูล" : "สมัครสมาชิกฟรี"}
      </button>
      {isEdit && <button className="lf-btn lf-btn--ghost" onClick={onCancel}>ยกเลิก</button>}
    </div>
  );
}
