"use client";
// ชิ้นส่วน UI ร่วมของหน้าสมาชิก LINE (LIFF) — ใช้ทั้ง /liff และ /liff/rewards ให้หน้าตาเป็นชุดเดียวกัน · สไตล์อยู่ liff.css
import "./liff.css";

export function Brand({ sub, back }: { sub: string; back?: { label: string; href: string } }) {
  return (
    <div className="lf-brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/dk-logo.jpg" alt="DK" />
      <div>
        <div className="lf-brand-name">DK STEEL AND TOOLS</div>
        <div className="lf-brand-sub">{sub}</div>
      </div>
      {back && <button type="button" className="lf-hero-back" onClick={() => (window.location.href = back.href)}>{back.label}</button>}
    </div>
  );
}

export function Shell({ sub, back, short, children }: { sub: string; back?: { label: string; href: string }; short?: boolean; children: React.ReactNode }) {
  return (
    <div className="lf-page">
      <div className={`lf-hero${short ? " lf-hero--short" : ""}`}><Brand sub={sub} back={back} /></div>
      <div className={`lf-wrap${short ? "" : " lf-wrap--lift"}`}>{children}</div>
    </div>
  );
}

export function Loading({ text = "กำลังโหลด…" }: { text?: string }) {
  return (
    <div className="lf-page"><div className="lf-center"><div className="lf-spin" />{text}</div></div>
  );
}

export function Field({ label, hint, optional, children }: { label: string; hint?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="lf-field">
      <label>{label}{optional ? <small> (ถ้ามี)</small> : ""}</label>
      {children}
      {hint && <div className="lf-hint">{hint}</div>}
    </div>
  );
}
