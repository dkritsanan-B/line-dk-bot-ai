"use client";
// ชิ้นส่วน UI ร่วมของหน้าสมาชิก LINE (LIFF) — ใช้ทั้ง /liff และ /liff/rewards ให้หน้าตาเป็นชุดเดียวกัน · สไตล์อยู่ liff.css
import "./liff.css";
import Icon from "./components/Icon";

export function Brand({ sub, back }: { sub: string; back?: { label: string; href: string } }) {
  return (
    <div className="lf-brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/dk-logo.jpg" alt="DK" />
      <div>
        <div className="lf-brand-name">DK STEEL AND TOOLS</div>
        <div className="lf-brand-sub">{sub}</div>
      </div>
      {back && (
        <button type="button" className="lf-hero-back" onClick={() => (window.location.href = back.href)}>
          <Icon name="chevron" size={18} className="lf-flip" /><span>{back.label}</span>
        </button>
      )}
    </div>
  );
}

/** โครงหน้าร่วม
 *  layout = รูปแบบคอนเทนเนอร์บนจอเดสก์ท็อป (≥900px) — บนมือถือทุกค่าหน้าตาเหมือนกัน
 *    "plain"   คอลัมน์เดียว (ค่าเริ่มต้น)
 *    "split"   สองคอลัมน์: บัตร+คำเตือน | ปุ่มลัด+ประวัติ   (หน้าบัตรสมาชิก)
 *    "form"    คอลัมน์เดียวแต่กว้างขึ้น พร้อมกระจายบันไดระดับ/สิทธิ์เป็นแถว (หน้าสมัคร/แก้ไข)
 *    "catalog" ตารางของรางวัล 2–3 ใบต่อแถว                    (หน้าของรางวัล)
 */
export type LiffLayout = "plain" | "split" | "form" | "catalog";

export function Shell({ sub, back, short, layout = "plain", children }: {
  sub: string;
  back?: { label: string; href: string };
  short?: boolean;
  layout?: LiffLayout;
  children: React.ReactNode;
}) {
  const wrap = [
    "lf-wrap",
    short ? "lf-wrap--short" : "lf-wrap--lift",
    layout !== "plain" ? `lf-wrap--${layout}` : "",
  ].filter(Boolean).join(" ");
  return (
    <div className="lf-page">
      <div className={`lf-hero${short ? " lf-hero--short" : ""}`}><Brand sub={sub} back={back} /></div>
      <div className={wrap}>{children}</div>
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
