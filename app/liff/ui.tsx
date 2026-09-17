"use client";
// ชิ้นส่วน UI ร่วมของหน้าสมาชิก LINE (LIFF) — ใช้ทั้ง /liff และ /liff/rewards ให้หน้าตาเป็นชุดเดียวกัน · สไตล์อยู่ liff.css
import "./liff.css";
import "./styles/shell.css";
import Icon from "./components/Icon";

export function Brand({ sub, back }: { sub: string; back?: { label: string; href: string } }) {
  return (
    <div className={`lf-brand${back ? " lf-brand--back" : ""}`}>
      {/* ปุ่มย้อนกลับอยู่ซ้ายสุดตามความเคยชิน Android (17 ก.ย. 69) · สไตล์ styles/shell.css
          หน้าที่ไม่มีปุ่มย้อน หน้าตาเหมือนเดิม */}
      {back && (
        <button type="button" className="lf-hero-back" aria-label={`กลับไป${back.label}`} title={`กลับไป${back.label}`}
          onClick={() => (window.location.href = back.href)}>
          <Icon name="chevron" size={26} strokeWidth={2.5} className="lf-flip" />
        </button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/dk-logo.jpg" alt="DK" />
      <div className="lf-brand-text">
        <div className="lf-brand-name">DK STEEL AND TOOLS</div>
        <div className="lf-brand-sub">{sub}</div>
      </div>
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
      {/* lf-hero--form: หัวหน้าเว็บกว้างเท่าเนื้อหาหน้าสมัคร (ดู styles/shell.css) */}
      <div className={`lf-hero${short ? " lf-hero--short" : ""}${layout === "form" ? " lf-hero--form" : ""}`}><Brand sub={sub} back={back} /></div>
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
