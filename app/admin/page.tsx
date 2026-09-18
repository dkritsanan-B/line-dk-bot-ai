"use client";
import { Fragment, useState, useCallback, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import "./admin.css";
import { Icon, type IconName } from "./icons";

// หน้าแอดมินระบบสมาชิก — รื้อหน้าตา 16 ก.ย. 69: แบ่งเป็นแท็บ (ภาพรวม/สมาชิก/แลกของ/แต้ม/ประวัติ/ตั้งค่า) แทนหน้าเดียวยาว · ตรรกะ/API เดิมทั้งหมด
// สไตล์อยู่ admin.css (คลาส ad-*) · จำการล็อกอินใน sessionStorage (ปิดแท็บ = หลุด)

interface User {
  id: number;
  customer_id: string | null;
  suggested_customer_id?: string | null;   // บอทเดาจากเบอร์โทร รอพนักงานกดยืนยัน
  line_user_id?: string | null;
  display_name?: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  company: string | null;
  birthday: string | null;
  points: number;
  created_at: string;
  link_status?: "linked" | "suggested" | "pending";
  waiting_days?: number;
  pending_bills?: { count: number; amount: number; estimated_points: number } | null;
  suggested_customer_name?: string | null;
}

type Tab = "overview" | "members" | "redeem" | "points" | "history" | "settings";

// เกณฑ์ระดับ (ตรงกับ lib/points.ts) — ของเดิมบนหน้านี้พิมพ์ผิด (Platinum 4,000 / Gold 1,000)
// ป้ายระดับ: พื้นอ่อน (tint) + ตัวอักษรเข้ม (ink) คอนทราสต์ ≥ 4.5:1 · สีประจำระดับ (color) อยู่ที่จุดหน้าชื่อ
const TIERS = [
  { name: "Diamond",  min: 10000, color: "#1565C0", tint: "#E3EEFB", ink: "#0B2A5B" },
  { name: "Platinum", min: 5000,  color: "#546E7A", tint: "#ECF0F2", ink: "#263238" },
  { name: "Gold",     min: 2000,  color: "#F9A825", tint: "#FEF3D6", ink: "#5A3B00" },
  { name: "Silver",   min: 500,   color: "#90A4AE", tint: "#F0F3F5", ink: "#37474F" },
  { name: "Bronze",   min: 100,   color: "#8D6E63", tint: "#F4EDEA", ink: "#4E342E" },
  { name: "Welcome",  min: 0,     color: "#9AA6B8", tint: "#FFFFFF", ink: "#53647C" },
];
const tierOf = (points: number) => TIERS.find(t => points >= t.min) ?? TIERS[TIERS.length - 1];
// ป้ายระดับฝั่งแอดมิน — Welcome เป็นป้ายขอบเทา (ระดับเริ่มต้น) ไม่ให้สีน้ำเงินชนกับ Diamond
function TierChip({ name }: { name: string }) {
  const t = TIERS.find(x => x.name === name) ?? TIERS[TIERS.length - 1];
  return <span className={`ad-chip ad-chip--tier${t.min === 0 ? " ad-chip--tier-base" : ""}`} style={{ background: t.tint, color: t.ink }}><span className="ad-tier-dot" style={{ background: t.color }} aria-hidden="true" />{t.name}</span>;
}

// เทียบชื่อที่ลูกค้าสมัครกับชื่อใน Hero (ตัดช่องว่าง/คำนำหน้า) — ใช้ทั้งบนการ์ดและในโมดัลผูกรหัส
const normName = (v: string) => v.replace(/^(คุณ|นางสาว|นาย|นาง|น\.ส\.|ช่าง)\s*/, "").replace(/[\s.]/g, "").toLocaleLowerCase("th");
function compareNames(first: string | null | undefined, last: string | null | undefined, heroName: string | null | undefined): "match" | "mismatch" | "unknown" {
  const hero = normName(heroName?.trim() ?? "");
  const f = normName(first?.trim() ?? "");
  if (!hero || !f) return "unknown";
  const l = normName(last?.trim() ?? "");
  if (hero === f + l) return "match";
  return hero.includes(f) && (!l || hero.includes(l)) ? "match" : "mismatch";
}
// คำเรียกสถานะของสมาชิกที่ยังไม่ผูกรหัส — ใช้ชุดเดียวทุกที่ (ภาพรวม · ตัวกรอง · การ์ด)
const SUGGESTED_LABEL = "เสนอรหัสแล้ว รอตรวจ";
const NOT_FOUND_LABEL = "ยังไม่พบรหัส";

function NameMatchChip({ state }: { state: "match" | "mismatch" | "unknown" }) {
  if (state === "match") return <span className="ad-chip ad-chip--ok ad-name-chip"><Icon name="check" size={13} />ชื่อตรงกัน</span>;
  if (state === "mismatch") return <span className="ad-chip ad-chip--danger ad-name-chip"><Icon name="alert" size={13} />ชื่อไม่ตรง</span>;
  return <span className="ad-chip ad-chip--muted ad-name-chip">ไม่มีชื่อให้เทียบ</span>;
}

// เวลาจาก Supabase เป็น UTC — แสดงเวลาไทยเสมอ ไม่ขึ้นกับโซนเวลาของเครื่องที่เปิด
const TZ = "Asia/Bangkok";
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) + " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
function formatBirthday(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}
const fmtPhone = (p: string) => p.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");

function redemptionAge(createdAt: string) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000));
  if (hours >= 72) return { label: `รอ ${Math.floor(hours / 24)} วัน`, overdue: true };
  if (hours >= 24) return { label: `รอ ${Math.floor(hours / 24)} วัน`, overdue: false };
  return { label: `รอ ${Math.max(1, hours)} ชม.`, overdue: false };
}

function memberMatches(u: User, query: string) {
  const q = query.trim().toLocaleLowerCase("th");
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3 && u.phone.endsWith(digits)) return true;
  return [u.display_name, u.first_name, u.last_name, u.company, u.customer_id, u.suggested_customer_id]
    .filter(Boolean).join(" ").toLocaleLowerCase("th").includes(q);
}

function exportCSV(users: User[]) {
  const header = ["ลำดับ", "รหัสลูกค้า", "ชื่อ", "นามสกุล", "เบอร์", "บริษัท", "วันเกิด", "แต้ม", "สมัครเมื่อ"];
  const rows = users.map((u, i) => [
    i + 1,
    u.customer_id ?? "",
    u.first_name ?? "",
    u.last_name ?? "",
    u.phone,
    u.company ?? "",
    u.birthday ? u.birthday.substring(0, 10) : "",
    u.points,
    u.created_at ? new Date(u.created_at).toLocaleDateString("th-TH", { timeZone: TZ }) : "",
  ]);
  const csv = "﻿" + [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `dk-members-${new Date().toISOString().substring(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function backfillStartLabel(createdAt: string | null | undefined): string {
  const dayMs = 86400000;
  const signup = createdAt ? new Date(createdAt).getTime() : NaN;
  const floor = Date.now() - 30 * dayMs;
  const start = Number.isFinite(signup) ? Math.max(signup, floor) : floor;
  return new Date(start).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: TZ });
}

export default function AdminPage() {
  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const [authed, setAuthed]       = useState(false);
  const [role, setRole]           = useState<"super" | "staff" | "viewer">("viewer");
  const [savedUsername, setSavedUsername] = useState("");
  const [users, setUsers]         = useState<User[]>([]);
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [savedPw, setSavedPw]     = useState("");
  const [tab, setTab]             = useState<Tab>("overview");
  const [memberFilter, setMemberFilter] = useState<"all" | "unlinked" | "suggested" | "noline">("all");
  const [restoring, setRestoring] = useState(true);
  const [reviewSecret, setReviewSecret] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const apiUrl = useCallback((path: string) => {
    if (!reviewSecret) return path;
    const join = path.includes("?") ? "&" : "?";
    return `${path}${join}review=${encodeURIComponent(reviewSecret)}`;
  }, [reviewSecret]);

  // เพิ่มแต้มรายเดียว
  const [apPhone, setApPhone]     = useState("");
  const [apAmount, setApAmount]   = useState("");
  const [apNote, setApNote]       = useState("");
  const [apLoading, setApLoading] = useState(false);
  const [apResult, setApResult]   = useState<{ name: string; pointsEarned: number; totalPoints: number } | null>(null);
  const [apError, setApError]     = useState("");

  // หักแต้ม (คืนสินค้า)
  const [dpPhone, setDpPhone]     = useState("");
  const [dpAmount, setDpAmount]   = useState("");
  const [dpNote, setDpNote]       = useState("");
  const [dpLoading, setDpLoading] = useState(false);
  const [dpResult, setDpResult]   = useState<{ name: string; pointsDeducted: number; totalPoints: number } | null>(null);
  const [dpError, setDpError]     = useState("");

  // เพิ่มแต้มแบบ CSV
  type BulkRow = { phone: string; amount: number; status?: string; name?: string; pointsEarned?: number; totalPoints?: number; message?: string };
  const [csvRows, setCsvRows]       = useState<BulkRow[]>([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvDone, setCsvDone]       = useState(false);
  const [csvError, setCsvError]     = useState("");
  const csvInputRef                 = useRef<HTMLInputElement>(null);

  // inline edit customer_id
  const [editValue, setEditValue]   = useState("");
  const [editError, setEditError]   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
  const [memberMenuId, setMemberMenuId] = useState<number | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<User | null>(null);
  const [linkChecked, setLinkChecked] = useState(false);
  const [mismatchAck, setMismatchAck] = useState(false);
  // โมดัลผูกรหัสมี 2 ทาง: "suggested" = รหัสที่บอทเสนอ · "manual" = พนักงานพิมพ์รหัสเองหลังค้นใน Hero (ต้องพิมพ์ชื่อใน Hero มาเทียบด้วย)
  const [linkMode, setLinkMode] = useState<"suggested" | "manual">("suggested");
  const [manualHeroName, setManualHeroName] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [toast, setToastState] = useState<{ text: string; tone: "ok" | "neutral" | "error" } | null>(null);
  const setToast = (text: string, tone: "ok" | "neutral" | "error" = "ok") => setToastState(text ? { text, tone } : null);
  // ปลด LINE / เปลี่ยนเบอร์ — ใช้โมดัลเดียวกับการผูกรหัส (เลิกใช้ confirm/prompt ของเบราว์เซอร์)
  const [unlinkTarget, setUnlinkTarget] = useState<User | null>(null);
  const [phoneTarget, setPhoneTarget] = useState<User | null>(null);
  const [phoneValue, setPhoneValue] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);
  const [earnHelpOpen, setEarnHelpOpen] = useState(false);
  const primaryActionRef = useRef<HTMLButtonElement>(null);

  // audit log
  interface AuditRow { id: number; action: string; detail: string; created_at: string; first_name: string | null; last_name: string | null; phone: string | null; }
  interface ClearedTx { id: number; type: string; points_earned: number; purchase_amount: number; note: string | null; created_at: string; }
  interface RedemptionRow { id: number; status: string; points_required: number; created_at: string; confirmed_at: string | null; first_name: string | null; last_name: string | null; display_name: string | null; phone: string; line_user_id: string; reward_name: string; image_url: string | null; stock: number | null; }
  // จัดการ admin users
  interface AdminUser { id: number; username: string; role: string; active: boolean; created_at: string; }
  const [adminUsers, setAdminUsers]         = useState<AdminUser[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [newAdminUsername, setNewAdminUsername]   = useState("");
  const [newAdminPassword, setNewAdminPassword]   = useState("");
  const [newAdminRole, setNewAdminRole]           = useState("staff");
  const [newAdminError, setNewAdminError]         = useState("");
  const [newAdminSuccess, setNewAdminSuccess]     = useState("");

  const [redeemRows, setRedeemRows]         = useState<RedemptionRow[]>([]);
  const [redeemLoadOk, setRedeemLoadOk]     = useState(false);   // โหลดรายการคำขอแลกของสำเร็จอย่างน้อยหนึ่งครั้ง (KPI ใช้ตัดสินว่ารู้ยอดจริงไหม)
  const [redeemLoading, setRedeemLoading]   = useState(false);
  const [redeemError, setRedeemError]       = useState("");
  const [redeemAction, setRedeemAction]     = useState<Record<number, boolean>>({});
  const [redeemModal, setRedeemModal] = useState<{ row: RedemptionRow; action: "confirm" | "cancel" } | null>(null);
  const [handoffChecked, setHandoffChecked] = useState(false);
  const [cancelReason, setCancelReason] = useState<"ลูกค้าไม่มารับ" | "ของหมด" | "กดผิด">("ลูกค้าไม่มารับ");

  const [auditOpen, setAuditOpen]       = useState(false);
  const [auditLogs, setAuditLogs]       = useState<AuditRow[]>([]);
  const [auditCleared, setAuditCleared] = useState<ClearedTx[]>([]);
  const [auditPhone, setAuditPhone]     = useState("");
  const [auditLoading, setAuditLoading] = useState(false);

  async function fetchRedemptions(pw = savedPw) {
    setRedeemLoading(true); setRedeemError("");
    try {
      const res  = await fetch(apiUrl("/api/admin/redemptions"), { headers: { "x-admin-password": pw } });
      const data = await res.json();
      if (!res.ok) { setRedeemError(data.error ?? "เกิดข้อผิดพลาด"); setRedeemLoadOk(false); return; }
      setRedeemRows(data.requests ?? []);
      setRedeemLoadOk(true);
    } catch { setRedeemError("เชื่อมต่อไม่ได้"); setRedeemLoadOk(false); }
    finally { setRedeemLoading(false); }
  }

  async function handleRedeemAction(id: number, action: "confirm" | "cancel") {
    setRedeemAction(prev => ({ ...prev, [id]: true }));
    try {
      const res  = await fetch(apiUrl("/api/admin/redemptions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) { setRedeemError(data.error ?? "เกิดข้อผิดพลาด"); return; }
      setRedeemError("");
      const row = redeemRows.find(r => r.id === id);
      const pts = (row?.points_required ?? 0).toLocaleString();
      setRedeemRows(prev => prev.map(r => r.id === id ? { ...r, status: action === "confirm" ? "confirmed" : "cancelled", confirmed_at: action === "confirm" ? new Date().toISOString() : null } : r));
      setRedeemModal(null);
      // แต้มถูก "จอง" ตอนลูกค้าขอ และถูก "หักจริง" ตอนพนักงานยืนยัน (app/api/admin/redemptions/logic.ts)
      // ยกเลิก = ปลดการจอง ยอดแต้มลูกค้าไม่เปลี่ยน เพราะยังไม่เคยถูกหัก
      if (action === "confirm") setToast(`ยืนยันรับของ #REQ-${id} แล้ว · หักแต้มลูกค้า ${pts} แต้ม`, "ok");
      else setToast(`ยกเลิก #REQ-${id} แล้ว (${cancelReason}) · ปลดแต้มที่จองไว้ ${pts} แต้ม (ไม่ได้หัก)`, "neutral");
      fetchRedemptions();
      fetchUsers(savedPw, "");
    } finally { setRedeemAction(prev => ({ ...prev, [id]: false })); }
  }

  useEffect(() => {
    if (authed && (savedPw || reviewMode)) fetchRedemptions(savedPw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, reviewMode, apiUrl]);

  async function fetchAuditLog(phone = auditPhone) {
    setAuditLoading(true);
    try {
      const res  = await fetch(`/api/admin/audit-log?phone=${encodeURIComponent(phone)}`, {
        headers: { "x-admin-password": savedPw, "x-admin-username": savedUsername },
      });
      const data = await res.json();
      setAuditLogs(data.logs ?? []);
      setAuditCleared(data.cleared ?? []);
    } finally { setAuditLoading(false); }
  }

  // เคลียร์ประวัติสมาชิก
  const [clrPhone, setClrPhone]     = useState("");
  const [clrPw, setClrPw]           = useState("");
  const [clrLoading, setClrLoading] = useState(false);
  const [clrResult, setClrResult]   = useState<{ name: string; clearedPoints: number } | null>(null);
  const [clrError, setClrError]     = useState("");

  // ประวัติการเพิ่มแต้ม
  interface TxRow { id: number; purchase_amount: number; points_earned: number; type: string; note: string | null; created_at: string; phone: string; first_name: string | null; last_name: string | null; display_name: string | null; }
  const [txRows, setTxRows]         = useState<TxRow[]>([]);
  const [txSearch, setTxSearch]     = useState("");
  const [txFrom, setTxFrom]         = useState("");
  const [txTo, setTxTo]             = useState("");
  const [txLoading, setTxLoading]   = useState(false);
  const [txLoaded, setTxLoaded]     = useState(false);

  async function handleAddPoints() {
    if (!/^0\d{9}$/.test(apPhone)) { setApError("เบอร์ไม่ถูกต้อง (10 หลัก)"); return; }
    const amt = parseInt(apAmount);
    if (!amt || amt < 100) { setApError("ยอดซื้อต้องไม่ต่ำกว่า 100 บาท"); return; }
    setApLoading(true); setApError(""); setApResult(null);
    try {
      const res  = await fetch("/api/admin/add-points", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
        body: JSON.stringify({ phone: apPhone, amount: amt, note: apNote.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setApError(data.error ?? "เกิดข้อผิดพลาด"); return; }
      setApResult(data);
      setApPhone(""); setApAmount(""); setApNote("");
      fetchUsers(savedPw, "");
    } catch { setApError("เกิดข้อผิดพลาด"); }
    finally { setApLoading(false); }
  }

  async function handleDeductPoints() {
    if (!/^0\d{9}$/.test(dpPhone)) { setDpError("เบอร์ไม่ถูกต้อง (10 หลัก)"); return; }
    const amt = parseInt(dpAmount);
    if (!amt || amt < 100) { setDpError("ยอดเงินที่คืนต้องไม่ต่ำกว่า 100 บาท"); return; }
    const pts = Math.floor(amt / 100);
    setDpLoading(true); setDpError(""); setDpResult(null);
    try {
      const res  = await fetch("/api/admin/deduct-points", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
        body: JSON.stringify({ phone: dpPhone, points: pts, note: dpNote.trim() || `คืนสินค้า ยอดเงิน ${amt.toLocaleString()} บาท` }),
      });
      const data = await res.json();
      if (!res.ok) { setDpError(data.error ?? "เกิดข้อผิดพลาด"); return; }
      setDpResult(data);
      setDpPhone(""); setDpAmount(""); setDpNote("");
      fetchUsers(savedPw, "");
    } catch { setDpError("เกิดข้อผิดพลาด"); }
    finally { setDpLoading(false); }
  }

  function handleCSVFile(file: File) {
    setCsvError(""); setCsvDone(false); setCsvRows([]);
    const ext = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let rows2d: string[][];

        if (ext === "xlsx" || ext === "xls") {
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows2d = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false });
        } else {
          const text = new TextDecoder("utf-8").decode(data as ArrayBuffer);
          rows2d = text.split(/\r?\n/).filter(l => l.trim()).map(l =>
            l.split(",").map(c => c.trim().replace(/^"|"$/g, ""))
          );
        }

        const parsed: BulkRow[] = [];
        for (let i = 0; i < rows2d.length; i++) {
          const cols   = rows2d[i];
          const phone  = String(cols[0] ?? "").replace(/\D/g, "");
          const amount = parseInt(String(cols[1] ?? ""));
          if (i === 0 && isNaN(amount)) continue; // skip header
          if (!/^0\d{9}$/.test(phone)) { setCsvError(`แถวที่ ${i + 1}: เบอร์ "${cols[0]}" ไม่ถูกต้อง`); return; }
          if (!amount || amount < 100)  { setCsvError(`แถวที่ ${i + 1}: ยอดซื้อต้องไม่ต่ำกว่า 100 บาท`); return; }
          parsed.push({ phone, amount });
        }
        if (parsed.length === 0) { setCsvError("ไม่พบข้อมูลในไฟล์"); return; }
        setCsvRows(parsed);
      } catch {
        setCsvError("อ่านไฟล์ไม่ได้ กรุณาใช้ไฟล์ .xlsx หรือ .csv");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleBulkAddPoints() {
    setCsvLoading(true); setCsvError(""); setCsvDone(false);
    try {
      const res  = await fetch("/api/admin/bulk-add-points", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
        body: JSON.stringify({ rows: csvRows.map(r => ({ phone: r.phone, amount: r.amount })) }),
      });
      const data = await res.json();
      if (!res.ok) { setCsvError(data.error ?? "เกิดข้อผิดพลาด"); return; }
      setCsvRows(data.results);
      setCsvDone(true);
      fetchUsers(savedPw, "");
    } catch { setCsvError("เกิดข้อผิดพลาด"); }
    finally { setCsvLoading(false); }
  }

  function downloadTemplate() {
    const csv = "﻿เบอร์มือถือ,ยอดซื้อ\n0812345678,1500\n0898765432,3000";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "template-add-points.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const fetchUsers = useCallback(async (pw: string, q = "", uname = savedUsername) => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(apiUrl(`/api/admin/members?search=${encodeURIComponent(q)}`), {
        headers: { "x-admin-password": pw, "x-admin-username": uname },
      });
      if (res.status === 401) { setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"); setAuthed(false); setLoading(false); return; }
      if (!res.ok) { setError(`เกิดข้อผิดพลาด (${res.status}) — กรุณา Redeploy Vercel`); setLoading(false); return; }
      const data = await res.json();
      setUsers(data.users ?? []);
      setReviewMode(data.review === true);
      setAuthed(true);
      setSavedPw(pw);
      setSavedUsername(uname);
      if (!data.review) {
        sessionStorage.setItem("admin_pw", pw);
        sessionStorage.setItem("admin_username", uname);
      }
    } catch { setError("เชื่อมต่อ API ไม่ได้ — กรุณาตรวจสอบ Vercel deployment"); }
    finally { setLoading(false); }
  }, [savedUsername, apiUrl]);

  // จำการล็อกอินไว้ใน sessionStorage (เหมือนหน้า /admin/rewards) — รีเฟรชหน้าไม่ต้องล็อกอินใหม่
  useEffect(() => {
    const secret = new URLSearchParams(window.location.search).get("review") ?? "";
    if (secret) {
      setReviewSecret(secret);
      fetch(`/api/admin/members?review=${encodeURIComponent(secret)}`).then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.review) throw new Error("review disabled");
        setUsers(data.users ?? []); setReviewMode(true); setRole("staff"); setSavedUsername("review"); setAuthed(true); setRestoring(false);
      }).catch(() => setRestoring(false));
      return;
    }
    const pw = sessionStorage.getItem("admin_pw") ?? "";
    const uname = sessionStorage.getItem("admin_username") ?? "";
    const r = sessionStorage.getItem("admin_role") ?? "";
    const t = sessionStorage.getItem("admin_tab") as Tab | null;
    if (t) setTab(t);
    if (pw && uname) {
      if (r === "super" || r === "staff" || r === "viewer") setRole(r);
      setSavedUsername(uname);
      fetchUsers(pw, "", uname).finally(() => setRestoring(false));
    } else setRestoring(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authed || !tab || tab !== "members") return;
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 150);
    return () => window.clearTimeout(timer);
  }, [search, tab, authed]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToastState(null), toast.tone === "error" ? 6000 : 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (tab !== "members" || !debouncedSearch) return;
    const matches = users.filter(u => memberMatches(u, debouncedSearch));
    if (matches.length !== 1) return;
    setExpandedMemberId(matches[0].id);
    window.setTimeout(() => primaryActionRef.current?.focus(), 0);
  }, [debouncedSearch, tab, users]);
  useEffect(() => {
    if (!linkTarget && !redeemModal && !unlinkTarget && !phoneTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || memberBusy || linkSaving) return;
      setLinkTarget(null); setRedeemModal(null); setUnlinkTarget(null); setPhoneTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [linkTarget, redeemModal, unlinkTarget, phoneTarget, memberBusy, linkSaving]);
  function go(t: Tab) { setTab(t); sessionStorage.setItem("admin_tab", t); }
  function logout() {
    sessionStorage.removeItem("admin_pw"); sessionStorage.removeItem("admin_username"); sessionStorage.removeItem("admin_role");
    setAuthed(false); setSavedPw(""); setPassword(""); setUsers([]);
  }

  // เปลี่ยนเบอร์ / ปลด LINE เดิม (ลูกค้าเปลี่ยนเครื่องหรือ LINE หาย → ปลดแล้วให้สมัครใหม่ด้วยเบอร์เดิม แต้มตามไป)
  async function patchMember(userId: number, body: Record<string, unknown>, apply: (u: User) => User): Promise<string | null> {
    setMemberBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/update-member"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
        body: JSON.stringify({ id: userId, ...body }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return d.error || `ไม่สำเร็จ (${res.status})`;
      setUsers(prev => prev.map(u => u.id === userId ? apply(u) : u));
      return null;
    } catch { return "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง"; }
    finally { setMemberBusy(false); }
  }
  function changePhone(u: User) {
    setPhoneTarget(u); setPhoneValue(u.phone); setPhoneError("");
  }
  async function submitPhone() {
    if (!phoneTarget) return;
    const tel = phoneValue.replace(/\D/g, "");
    if (!/^0\d{9}$/.test(tel)) { setPhoneError("เบอร์ต้องเป็น 10 หลัก ขึ้นต้นด้วย 0"); return; }
    if (tel === phoneTarget.phone) { setPhoneError("เบอร์นี้เป็นเบอร์เดิมอยู่แล้ว"); return; }
    const err = await patchMember(phoneTarget.id, { phone: tel }, x => ({ ...x, phone: tel }));
    if (err) { setPhoneError(err); return; }
    setPhoneTarget(null);
    setToast(`เปลี่ยนเบอร์เป็น ${fmtPhone(tel)} แล้ว`);
  }
  function resetLine(u: User) { setUnlinkTarget(u); }
  async function submitUnlink() {
    if (!unlinkTarget) return;
    const err = await patchMember(unlinkTarget.id, { reset_line: true }, x => ({ ...x, line_user_id: null }));
    if (err) { setToast(err, "error"); return; }
    setUnlinkTarget(null);
    setToast("ปลดบัญชี LINE เดิมแล้ว · แต้มยังอยู่กับเบอร์นี้", "neutral");
  }

  async function saveCustomerId(userId: number, value: string): Promise<boolean> {
    // รหัสลูกค้า Hero (CUS-xxxxx) — ผูกแล้วบอทให้แต้มจากบิล Hero อัตโนมัติ; API ตัดช่องว่าง/พิมพ์ใหญ่ให้ และกันผูกซ้ำคนอื่น
    const code = value.trim().toUpperCase() || null;
    if (code && !/^CUS-\d{4,5}$/.test(code)) {
      setEditError("รูปแบบต้องเป็น CUS-00000");
      return false;
    }
    const res = await fetch(apiUrl("/api/admin/update-member"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
      body: JSON.stringify({ id: userId, customer_id: code }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const msg = d.error || `บันทึกรหัสลูกค้าไม่สำเร็จ (${res.status})`;
      setEditError(msg);
      setToast(msg, "error");
      return false;
    }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, customer_id: code, suggested_customer_id: null } : u));
    setEditError("");
    setToast(code ? `ผูก ${code} แล้ว` : "ยกเลิกการผูกรหัสแล้ว", code ? "ok" : "neutral");
    return true;
  }

  function confirmSuggestedCustomer(u: User) {
    if (!u.suggested_customer_id) return;
    setLinkMode("suggested");
    setLinkChecked(false);
    setMismatchAck(false);
    setEditError("");
    setLinkTarget(u);
  }

  // กรอกรหัสเอง = ทางที่เสี่ยงกว่า จึงผ่านโมดัลเดียวกัน: พิมพ์รหัส + พิมพ์ชื่อที่เห็นใน Hero + ติ๊กว่าตรวจบัตรแล้ว
  function openManualCode(u: User) {
    setLinkMode("manual");
    setEditValue(u.customer_id ?? "");
    setManualHeroName("");
    setLinkChecked(false);
    setMismatchAck(false);
    setEditError("");
    setMemberMenuId(null);
    setLinkTarget(u);
  }

  async function submitLink() {
    if (!linkTarget || linkSaving) return;
    const code = linkMode === "manual" ? editValue : (linkTarget.suggested_customer_id ?? "");
    setLinkSaving(true);
    try { if (await saveCustomerId(linkTarget.id, code)) setLinkTarget(null); }
    finally { setLinkSaving(false); }
  }

  function exportTxExcel() {
    const data = txRows.map((t, i) => {
      const dt = new Date(t.created_at);
      const isRedeem = t.type === "redeem";
      return {
        "#": i + 1,
        "ประเภท": isRedeem ? "แลกรางวัล" : "เพิ่มแต้ม",
        "วันที่": dt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }),
        "เวลา": dt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ }),
        "ชื่อลูกค้า": t.first_name ? `${t.first_name} ${t.last_name}` : (t.display_name ?? "-"),
        "เบอร์มือถือ": t.phone,
        "ยอดซื้อ (บาท)": isRedeem ? 0 : t.purchase_amount,
        "แต้ม": isRedeem ? -t.points_earned : t.points_earned,
        "หมายเหตุ": t.note ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 5 }, { wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ประวัติแต้ม");
    const date = new Date().toISOString().substring(0, 10);
    XLSX.writeFile(wb, `dk-transactions-${date}.xlsx`);
  }

  async function handleClearPoints() {
    if (!/^0\d{9}$/.test(clrPhone)) { setClrError("เบอร์ไม่ถูกต้อง (10 หลัก)"); return; }
    if (!clrPw) { setClrError("กรุณากรอกรหัสผ่านเพื่อยืนยัน"); return; }
    if (!window.confirm(`ยืนยันจะเคลียร์ประวัติแต้มทั้งหมดของเบอร์ ${clrPhone} ?\nการกระทำนี้ไม่สามารถยกเลิกได้`)) return;
    setClrLoading(true); setClrError(""); setClrResult(null);
    try {
      const res  = await fetch("/api/admin/clear-member-points", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": clrPw, "x-admin-username": savedUsername },
        body: JSON.stringify({ phone: clrPhone }),
      });
      const data = await res.json();
      if (!res.ok) { setClrError(data.error ?? "เกิดข้อผิดพลาด"); return; }
      setClrResult(data);
      setClrPhone(""); setClrPw("");
      fetchUsers(savedPw, "");
    } catch { setClrError("เกิดข้อผิดพลาด"); }
    finally { setClrLoading(false); }
  }

  async function fetchTransactions(q = txSearch, from = txFrom, to = txTo) {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({ search: q, from, to });
      const res  = await fetch(`/api/admin/transactions?${params}`, {
        headers: { "x-admin-password": savedPw, "x-admin-username": savedUsername },
      });
      const data = await res.json();
      setTxRows(data.transactions ?? []);
      setTxLoaded(true);
    } catch { /* silent */ }
    finally { setTxLoading(false); }
  }

  async function handleLogin() {
    if (!username.trim() || !password.trim()) { setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน"); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"); setLoading(false); return; }
      setRole(data.role);
      sessionStorage.setItem("admin_role", data.role);
      await fetchUsers(password, "", username.trim());
    } catch { setError("เชื่อมต่อไม่ได้"); setLoading(false); }
  }

  async function fetchAdminUsers() {
    setAdminUsersLoading(true);
    try {
      const res  = await fetch("/api/admin/admin-users", { headers: { "x-admin-password": savedPw, "x-admin-username": savedUsername } });
      const data = await res.json();
      setAdminUsers(data.users ?? []);
    } finally { setAdminUsersLoading(false); }
  }

  async function handleCreateAdmin() {
    setNewAdminError(""); setNewAdminSuccess("");
    if (!newAdminUsername.trim() || !newAdminPassword.trim()) { setNewAdminError("กรอกข้อมูลให้ครบ"); return; }
    const res  = await fetch("/api/admin/admin-users", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
      body: JSON.stringify({ username: newAdminUsername.trim(), password: newAdminPassword, adminRole: newAdminRole }),
    });
    const data = await res.json();
    if (!res.ok) { setNewAdminError(data.error ?? "เกิดข้อผิดพลาด"); return; }
    setNewAdminSuccess("สร้างสำเร็จ"); setNewAdminUsername(""); setNewAdminPassword("");
    fetchAdminUsers();
  }

  async function handleToggleAdmin(id: number, active: boolean) {
    await fetch("/api/admin/admin-users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
      body: JSON.stringify({ id, active: !active }),
    });
    fetchAdminUsers();
  }

  async function handleDeleteAdmin(id: number, uname: string) {
    if (!window.confirm(`ลบ admin "${uname}" ?`)) return;
    await fetch("/api/admin/admin-users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
      body: JSON.stringify({ id }),
    });
    fetchAdminUsers();
  }

  // โหลดข้อมูลของแท็บตอนเปิดครั้งแรก
  useEffect(() => {
    if (!authed) return;
    if (tab === "settings" && role === "super" && adminUsers.length === 0) fetchAdminUsers();
    if (tab === "history" && !txLoaded && !txLoading) fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, authed]);

  const canEdit = role === "staff" || role === "super";
  const pending = redeemRows.filter(r => r.status === "pending").length;

  /* ── Login ── */
  if (!authed) return (
    <div className="ad"><div className="ad-login">
      <div className="ad-login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dk-logo.jpg" alt="DK" />
        <h1>DK Admin</h1>
        <p>ระบบสมาชิกสะสมแต้ม · DK Steel and Tools</p>
        {restoring ? <div className="ad-empty">กำลังตรวจสอบการเข้าสู่ระบบ…</div> : (
          <div className="ad-form">
            <div className="ad-field"><label>ชื่อผู้ใช้</label>
              <input className="ad-input" type="text" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} autoFocus autoComplete="username" placeholder="admin" /></div>
            <div className="ad-field"><label>รหัสผ่าน</label>
              <input className="ad-input" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} autoComplete="current-password" /></div>
            {error && <div className="ad-alert ad-alert--err">{error}</div>}
            <button className="ad-btn ad-btn--primary" onClick={handleLogin} disabled={loading} style={{ height: 46 }}>{loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
          </div>
        )}
      </div>
    </div></div>
  );

  /* ── ข้อมูลสรุป ── */
  const totalPoints = users.reduce((s, u) => s + u.points, 0);
  const unlinked = users.filter(u => !u.customer_id);
  // สองสถานะของคนที่ยังไม่ผูก — ใช้คำชุดเดียวกันทุกหน้า (ภาพรวม · ตัวกรอง · การ์ด)
  const suggested = unlinked.filter(u => !!u.suggested_customer_id);
  const notFound = unlinked.filter(u => !u.suggested_customer_id);
  const noLine = users.filter(u => !u.line_user_id);
  const searchedUsers = users.filter(u => memberMatches(u, debouncedSearch));
  const shown = searchedUsers.filter(u => memberFilter === "all" ? true : memberFilter === "unlinked" ? (!u.customer_id && !u.suggested_customer_id) : memberFilter === "suggested" ? (!u.customer_id && !!u.suggested_customer_id) : !u.line_user_id);
  const waitingShown = shown.filter(u => !u.customer_id).sort((a, b) => (b.waiting_days ?? 0) - (a.waiting_days ?? 0));
  const linkedShown = shown.filter(u => !!u.customer_id);
  const linked = users.filter(u => !!u.customer_id);
  const linkedPct = users.length ? Math.round((linked.length / users.length) * 100) : 0;
  const pendingRedeems = redeemRows.filter(r => r.status === "pending").sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const completedRedeems = redeemRows.filter(r => r.status !== "pending");
  const confirmedRedeems = redeemRows.filter(r => r.status === "confirmed").length;
  const tierCount = (name: string) => users.filter(u => tierOf(u.points).name === name).length;
  const linkMemberName = linkTarget ? `${linkTarget.first_name ?? "-"} ${linkTarget.last_name ?? ""}`.trim() : "";
  const linkCode = linkTarget ? (linkMode === "manual" ? editValue.trim().toUpperCase() : (linkTarget.suggested_customer_id ?? "")) : "";
  const linkHeroName = linkTarget ? (linkMode === "manual" ? manualHeroName.trim() : (linkTarget.suggested_customer_name?.trim() ?? "")) : "";
  const linkNameState = linkTarget ? compareNames(linkTarget.first_name, linkTarget.last_name, linkHeroName) : "unknown";
  const linkIsClear = linkMode === "manual" && !linkCode && !!linkTarget?.customer_id;   // เว้นช่องรหัสว่าง = ยกเลิกรหัสที่ผูกไว้
  const linkCodeValid = /^CUS-\d{4,5}$/.test(linkCode);
  // ชื่อไม่ตรง = ต้องติ๊กยืนยันเพิ่มอีกข้อ (กันผูกผิดคนด้วยการกดครั้งเดียว)
  const linkNeedsAck = !linkIsClear && !!linkHeroName && linkNameState === "mismatch";
  const linkReady = linkChecked && (!linkNeedsAck || mismatchAck) && !linkSaving && (linkIsClear || (linkCodeValid && (linkMode === "suggested" || !!linkHeroName)));
  const focusRef = (u: User) => debouncedSearch && searchedUsers.length === 1 && searchedUsers[0].id === u.id ? primaryActionRef : undefined;
  const memberName = (u: { first_name: string | null; last_name: string | null }) => u.first_name ? `${u.first_name} ${u.last_name ?? ""}`.trim() : "-";

  const TabBtn = ({ id, label, mobileLabel, icon, badge }: { id: Tab; label: string; mobileLabel?: string; icon: IconName; badge?: number }) => (
    <button className={`ad-tab${tab === id ? " on" : ""}`} onClick={() => go(id)} aria-label={label} aria-current={tab === id ? "page" : undefined}>
      <span className="ad-tab-icon"><Icon name={icon} size={20} filled={tab === id} /></span><span className="ad-tab-label"><span className="ad-tab-desktop-label">{label}</span><span className="ad-tab-mobile-label">{mobileLabel ?? label}</span></span>{badge ? <span className="ad-badge">{badge}</span> : null}
    </button>
  );
  // KPI: ตัวเลข · ชื่อ · บรรทัดบริบท (ช่วงข้อมูลตามที่ API ส่งมาจริง ไม่เดาช่วงเวลา)
  const Kpi = ({ icon, value, label, caption, tone }: { icon: IconName; value: string; label: string; caption: string; tone?: "warn" }) => (
    <div className="ad-stat"><i><Icon name={icon} size={20} /></i><div><b>{value}</b><span>{label}</span><small className={`ad-stat-cap${tone ? ` ${tone}` : ""}`}>{caption}</small></div></div>
  );
  // แต้มที่ลูกค้าขอแลกแต่พนักงานยังไม่ยืนยัน = จองไว้ ยังอยู่ในยอดแต้มคงเหลือ (หักจริงตอนยืนยัน)
  const reservedPoints = pendingRedeems.reduce((s, r) => s + r.points_required, 0);
  // บรรทัดบริบทใต้ KPI = ความเคลื่อนไหว 7 วันล่าสุด คำนวณจากข้อมูลที่หน้านี้โหลดมาแล้ว (created_at / confirmed_at)
  const weekAgo = Date.now() - 7 * 86_400_000;
  const inLastWeek = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() >= weekAgo;
  const newMembersWeek = users.filter(u => inLastWeek(u.created_at)).length;
  const confirmedWeek = redeemRows.filter(r => r.status === "confirmed" && inLastWeek(r.confirmed_at)).length;
  const weekCaption = (n: number) => `+${n.toLocaleString()} ใน 7 วันล่าสุด`;
  // ผู้ดูอย่างเดียวเรียก API คำขอแลกของไม่ได้ (ต้องเป็นพนักงาน) หรือโหลดพลาด = ไม่รู้ยอดจอง/ยอดแลก ห้ามโชว์ 0 เหมือนรู้จริง
  const redeemKnown = canEdit && redeemLoadOk;
  type WorkRow = { key: string; icon: IconName; tone: "warn" | "neutral"; count: number; text: string; label: string; run: () => void; show: boolean };
  const workRows: WorkRow[] = ([
    { key: "redeem", icon: "gift", tone: "warn", count: pending, text: "คำขอรอยืนยัน", label: "ไปยืนยัน", run: () => go("redeem"), show: canEdit },
    { key: "suggested", icon: "link", tone: "warn", count: suggested.length, text: "รอตรวจรหัส", label: "ตรวจและผูก", run: () => { setMemberFilter("suggested"); go("members"); }, show: canEdit },
    { key: "notfound", icon: "search", tone: "neutral", count: notFound.length, text: "ยังไม่พบรหัส", label: "ดูรายชื่อ", run: () => { setMemberFilter("unlinked"); go("members"); }, show: true },
  ] as WorkRow[]).filter(r => r.count > 0);
  const primaryWorkKey = workRows.find(r => r.show)?.key;

  return (
    <div className="ad">
      {/* แถบบน */}
      <div className="ad-top"><div className="ad-top-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dk-logo.jpg" alt="DK" />
        <div className="ad-top-identity">
          <div className="ad-top-name">DK Admin<span className="ad-top-name-extra"> · ระบบสมาชิก</span></div>
          <div className="ad-top-sub"><span className="ad-top-user">{savedUsername}</span><span className="ad-role">{role === "super" ? "Super Admin" : role === "staff" ? "Staff" : "Viewer"}</span>{reviewMode && <span className="ad-review-pill" title="โหมดรีวิว · ข้อมูลจำลอง · ทุกปุ่มตอบกลับโดยไม่บันทึกข้อมูลจริง">รีวิว</span>}</div>
        </div>
        <div className="ad-top-actions">
          {role === "super" && <a className="ad-tbtn" href="/admin/rewards"><Icon name="gift" size={16} />ของรางวัล</a>}
          <button className="ad-tbtn" onClick={() => exportCSV(users)}><Icon name="download" size={16} />Export CSV</button>
          <button className="ad-tbtn" onClick={logout}><Icon name="logout" size={16} />ออกจากระบบ</button>
        </div>
        <div className="ad-top-menu">
          <button className="ad-more" aria-label="เมนูเพิ่มเติม" aria-haspopup="menu" aria-expanded={headerMenuOpen} onClick={() => setHeaderMenuOpen(v => !v)}><Icon name="more" size={22} /></button>
          {headerMenuOpen && <div className="ad-menu-popover" role="menu">
            {role === "super" && <a role="menuitem" href="/admin/rewards"><Icon name="gift" size={17} />ของรางวัล</a>}
            {role === "super" && <button role="menuitem" onClick={() => { go("settings"); setHeaderMenuOpen(false); }}><Icon name="settings" size={17} />ตั้งค่า</button>}
            <button role="menuitem" onClick={() => { exportCSV(users); setHeaderMenuOpen(false); }}><Icon name="download" size={17} />Export CSV</button>
            <button role="menuitem" className="danger" onClick={logout}><Icon name="logout" size={17} />ออกจากระบบ</button>
          </div>}
        </div>
      </div></div>

      {/* แท็บ */}
      <div className="ad-tabs"><div className="ad-tabs-in">
        <TabBtn id="overview" label="ภาพรวม" icon="overview" />
        <TabBtn id="members" label="สมาชิก" icon="users" badge={unlinked.length || undefined} />
        {canEdit && <TabBtn id="redeem" label="คำขอแลกของ" mobileLabel="แลกของ" icon="gift" badge={pending || undefined} />}
        {canEdit && <TabBtn id="points" label="เพิ่ม/หักแต้ม" mobileLabel="แต้ม" icon="star" />}
        <TabBtn id="history" label="ประวัติแต้ม" mobileLabel="ประวัติ" icon="history" />
        {role === "super" && <TabBtn id="settings" label="ตั้งค่า" icon="settings" />}
      </div></div>

      <div className="ad-main">
        {error && <div className="ad-alert ad-alert--err" style={{ marginBottom: 12 }}>{error}</div>}
        {reviewMode && <div className="ad-review-banner">โหมดรีวิว · ข้อมูลจำลอง ไม่บันทึกจริง</div>}
        {role === "viewer" && <div className="ad-alert ad-alert--warn ad-alert--icon" style={{ marginBottom: 12 }}><Icon name="eye" />บัญชีนี้ดูข้อมูลได้อย่างเดียว ไม่สามารถเพิ่ม/หักแต้มหรือยืนยันการแลกของได้</div>}

        {/* ═══ ภาพรวม ═══ */}
        {tab === "overview" && (
          <>
            {/* ตัวเลขสรุปเป็น KPI ดูอย่างเดียว — จุดลงมือมีที่เดียวคือ "งานที่ควรทำ" */}
            <div className="ad-stats">
              <Kpi icon="users" value={users.length.toLocaleString()} label="สมาชิกทั้งหมด" caption={weekCaption(newMembersWeek)} />
              <Kpi icon="link" value={linked.length.toLocaleString()} label="ผูกรหัส Hero แล้ว" caption={`${linkedPct}% ของสมาชิกทั้งหมด`} />
              <Kpi icon="star" value={totalPoints.toLocaleString()} label="แต้มคงเหลือรวม" caption={!redeemKnown ? "รวมแต้มที่ลูกค้าขอแลกไว้ (ยังไม่หัก)" : reservedPoints > 0 ? `จองไว้ ${reservedPoints.toLocaleString()} · หักเมื่อยืนยัน` : "ไม่มีแต้มที่จองไว้"} tone={redeemKnown && reservedPoints > 0 ? "warn" : undefined} />
              <Kpi icon="gift" value={redeemKnown ? confirmedRedeems.toLocaleString() : "—"} label="แลกของสำเร็จ" caption={redeemKnown ? weekCaption(confirmedWeek) : !canEdit ? "ดูได้เฉพาะพนักงาน" : redeemLoading ? "กำลังโหลด…" : "โหลดคำขอแลกของไม่ได้"} />
            </div>
            <div className="ad-card ad-work-card">
              <div className="ad-card-h"><div><h3><Icon name="tasks" size={20} />งานที่ควรทำ</h3><p>สิ่งที่รอพนักงานอยู่ตอนนี้ · เรียงจากเรื่องด่วน</p></div></div>
              <div className="ad-work-list">
                {workRows.map(r => <div key={r.key} className="ad-work-row">
                  <span className={`ad-work-ic ${r.tone}`}><Icon name={r.icon} size={20} /></span>
                  <span className="ad-work-text"><b className={r.tone}>{r.count.toLocaleString()}</b> {r.text}</span>
                  {r.show && <button className={`ad-btn ${r.key === primaryWorkKey ? "ad-btn--primary" : "ad-btn--ghost"}`} onClick={r.run}>{r.label}</button>}
                </div>)}
                {workRows.length === 0 && <div className="ad-empty ad-empty--ok"><Icon name="checkCircle" size={30} />ไม่มีงานค้าง</div>}
              </div>
            </div>
            <div className="ad-card ad-tier-card">
              <div className="ad-card-h"><div><h3><Icon name="award" size={20} />สมาชิกตามระดับ</h3><p>นับจากแต้มคงเหลือ</p></div><button className="ad-help-link" aria-expanded={earnHelpOpen} aria-controls="earn-help" onClick={() => setEarnHelpOpen(v => !v)}><Icon name="info" size={16} />วิธีได้แต้ม <span aria-hidden="true">{earnHelpOpen ? "▴" : "▾"}</span></button></div>
              {earnHelpOpen && <p id="earn-help" className="ad-help-text">ลูกค้าสมัครใน LINE → ผูกรหัส Hero ที่แท็บสมาชิก → บิลขายสด/โอนจะกลายเป็นแต้มภายใน 1–2 นาที (บิลเชื่อ K1/K2 และลูกค้าเครดิตไม่นับ) · ระดับคิดจากแต้มคงเหลือ</p>}
              <ul className="ad-tier-row">
                {TIERS.map(t => {
                  const count = tierCount(t.name);
                  return <li key={t.name} className={count === 0 ? "empty" : undefined}><span className={`ad-tier-count${count === 0 ? " zero" : ""}`}><b>{count.toLocaleString()}</b> คน</span><TierChip name={t.name} /><span className="ad-tier-min">{t.min > 0 ? `${t.min.toLocaleString()}+ แต้ม` : "เริ่มต้น"}</span></li>;
                })}
              </ul>
            </div>
          </>
        )}

        {/* ═══ สมาชิก ═══ */}
        {tab === "members" && (
          <div className="ad-card ad-members-card">
            <div className="ad-card-h">
              <div><h3>สมาชิก <span className="ad-chip ad-chip--muted">ทั้งหมด {users.length.toLocaleString()} คน</span></h3><p>ค้นหาเบอร์ลูกค้าเพื่อยืนยันตัวตนและผูกรหัส Hero</p></div>
              <div className="ad-h-actions"><button className="ad-btn ad-btn--ghost ad-refresh-btn" onClick={() => fetchUsers(savedPw, "")} disabled={loading} aria-label={loading ? "กำลังโหลดรายชื่อ" : "รีเฟรชรายชื่อ"} title="รีเฟรชรายชื่อ"><Icon name="refresh" size={18} /><span className="ad-refresh-label">{loading ? "กำลังโหลด…" : "รีเฟรช"}</span></button></div>
            </div>
            <div className="ad-member-toolbar">
              <div className="ad-search-wrap"><Icon name="search" size={18} className="ad-search-ic" /><input className="ad-input ad-member-search" type="search" inputMode="search" aria-label="ค้นหาสมาชิก" placeholder="ค้นหาเบอร์ (4 ตัวท้ายพอ) หรือชื่อ" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="ad-search-clear" aria-label="ล้างคำค้น" onClick={() => { setSearch(""); setDebouncedSearch(""); }}><Icon name="x" size={18} /></button>}</div>
              <div className="ad-filters" role="group" aria-label="กรองสมาชิก">
                {([["all", "ทั้งหมด", users.length], ["suggested", SUGGESTED_LABEL, suggested.length], ["unlinked", NOT_FOUND_LABEL, notFound.length], ["noline", "ไม่มี LINE", noLine.length]] as const).map(([k, l, c]) => (
                  <button key={k} className={`ad-filter${memberFilter === k ? " on" : ""}${c === 0 ? " zero" : ""}`} aria-pressed={memberFilter === k} onClick={() => setMemberFilter(k)}>{l} <span className="ad-filter-count">{c.toLocaleString()}</span></button>
                ))}
              </div>
            </div>
            {shown.length === 0 && <div className="ad-search-empty"><b>{debouncedSearch ? `ไม่พบเบอร์ ${debouncedSearch.replace(/\D/g, "").slice(-4) || debouncedSearch}` : "ไม่พบสมาชิกตามตัวกรอง"}{debouncedSearch ? " — ลูกค้ายังไม่ได้สมัครใน LINE" : ""}</b>{debouncedSearch && <span>ให้ลูกค้าสแกน QR สมัครสมาชิก</span>}</div>}
            {waitingShown.length > 0 && <section className="ad-waiting-section">
              <div className="ad-section-title"><h4>รอผูกรหัส Hero {waitingShown.length}</h4><span>เรียงจากคนที่รอนานที่สุด</span></div>
              <div className="ad-safety"><Icon name="shield" size={18} /><span><b>ก่อนกดยืนยัน</b> ถามชื่อลูกค้า แล้วดูบัตรหรือเช็กเบอร์จากเครื่องลูกค้า เพื่อป้องกันการสวมเบอร์</span></div>
              <div className="ad-verify-list">
              {waitingShown.map(u => {
                const days = u.waiting_days ?? 0;
                const stale = days > 7;
                const nameState = compareNames(u.first_name, u.last_name, u.suggested_customer_name);
                const namesOk = nameState === "match";
                return <article className={`ad-verify-card${stale ? " stale" : ""}`} key={u.id}>
                <div className="ad-verify-head">
                  <div className="ad-verify-title"><span className={`ad-chip ${stale ? "ad-chip--danger" : "ad-chip--warn"} ad-wait-chip`}>รอ {days} วัน</span><span className={`ad-chip ${u.suggested_customer_id ? "ad-chip--blue" : "ad-chip--muted"}`}>{u.suggested_customer_id ? SUGGESTED_LABEL : NOT_FOUND_LABEL}</span></div>
                  <span className="ad-backfill">บิลตั้งแต่ {backfillStartLabel(u.created_at)} จะได้แต้มย้อนหลัง</span>
                </div>
                <div className="ad-match">
                  <div className="ad-match-side line"><small className="ad-cap"><span className="long">ชื่อที่</span>สมัคร</small><div className="ad-match-body"><strong>{memberName(u)}</strong><span className="ad-match-meta"><span className="ad-mono">{fmtPhone(u.phone)}</span>{u.company && <span className="ad-match-extra">{u.company}</span>}</span><span className="ad-line-alias">ชื่อในไลน์ <b>{u.display_name || "ไม่ระบุ"}</b></span></div></div>
                  <div className="ad-match-divider" aria-hidden="true" />
                  <div className={`ad-match-side hero${u.suggested_customer_id ? "" : " none"}`}><small className="ad-cap"><span className="long">ลูกค้าใน </span>Hero</small><div className="ad-match-body">{u.suggested_customer_id ? <><strong>{u.suggested_customer_name?.trim() || "ไม่มีชื่อใน Hero"}</strong><span className="ad-match-meta"><span className="ad-mono">{u.suggested_customer_id}</span></span><NameMatchChip state={nameState} /></> : <span className="ad-match-empty">{NOT_FOUND_LABEL}<span className="ad-match-empty-hint"> · ค้นใน Hero แล้วกรอกเอง</span></span>}</div></div>
                </div>
                <div className="ad-verify-actions">
                  {u.suggested_customer_id
                    ? namesOk
                      ? <button ref={focusRef(u)} className="ad-btn ad-btn--ok" onClick={() => confirmSuggestedCustomer(u)} disabled={!canEdit}>ตรวจและผูกรหัส</button>
                      : <button ref={focusRef(u)} className="ad-btn ad-btn--caution" onClick={() => confirmSuggestedCustomer(u)} disabled={!canEdit}><Icon name="alert" size={16} />ตรวจก่อนผูก</button>
                    : <button ref={focusRef(u)} className="ad-btn ad-btn--ghost" onClick={() => openManualCode(u)} disabled={!canEdit}>กรอกรหัส Hero เอง</button>}
                </div>
              </article>; })}
              </div>
            </section>}
            {linkedShown.length > 0 && <section className="ad-linked-section"><div className="ad-section-title"><h4>ผูกแล้ว {linked.length}</h4></div>
            <div className="ad-twrap ad-member-table"><table className="ad-table ad-table--fixed">
              <colgroup><col className="w-name" /><col className="w-phone" /><col className="w-code" /><col className="w-tier" /><col className="w-points" /><col className="w-manage" /></colgroup>
              <thead><tr><th>สมาชิก</th><th>เบอร์ · LINE</th><th>รหัส Hero</th><th>ระดับ</th><th className="r">แต้ม</th><th className="r">จัดการ</th></tr></thead>
              <tbody>
                {linkedShown.map(u => {
                  const t = tierOf(u.points);
                  const open = expandedMemberId === u.id;
                  return (
                    <Fragment key={u.id}><tr className={open ? "ad-row-open" : undefined}>
                      <td><span className="ad-name"><b>{memberName(u)}</b><span>{u.company || `สมัคร ${formatDate(u.created_at)}`}</span></span></td>
                      <td>
                        <span className="ad-phone-line">
                          <span className="ad-mono">{fmtPhone(u.phone)}</span>
                          {u.line_user_id
                            ? <span className="ad-chip ad-chip--ok ad-chip--sm" title="ผูกบัญชี LINE แล้ว"><Icon name="check" size={12} />LINE</span>
                            : <span className="ad-chip ad-chip--danger ad-chip--sm" title="รอลูกค้าสมัครด้วยเบอร์นี้">ไม่มี LINE</span>}
                        </span>
                      </td>
                      <td><code className="ad-code">{u.customer_id}</code></td>
                      <td><TierChip name={t.name} /></td>
                      <td className="r ad-points-cell"><b>{u.points.toLocaleString()}</b></td>
                      <td className="r"><button ref={focusRef(u)} className="ad-btn ad-btn--ghost ad-btn--sm ad-manage-btn" aria-expanded={open} aria-label={`จัดการ ${u.first_name ?? "สมาชิก"}`} onClick={() => setExpandedMemberId(open ? null : u.id)}>จัดการ <span aria-hidden="true">{open ? "▴" : "▾"}</span></button></td>
                    </tr>{open && <tr className="ad-expanded-row"><td colSpan={6}><div className="ad-expanded-content"><span><small>วันเกิด</small><b>{formatBirthday(u.birthday)}</b></span><span><small>สมัครเมื่อ</small><b>{formatDate(u.created_at)}</b></span>{canEdit && <div className="ad-expanded-actions"><button className="ad-btn ad-btn--ghost" onClick={() => changePhone(u)}>เปลี่ยนเบอร์</button><button className="ad-btn ad-btn--ghost" onClick={() => openManualCode(u)}>แก้รหัส Hero</button>{u.line_user_id && <button className="ad-btn ad-btn--ghost ad-btn--danger-text" onClick={() => resetLine(u)}>ปลด LINE เดิม</button>}</div>}</div></td></tr>}</Fragment>
                  );
                })}
              </tbody>
            </table></div>
            <div className="ad-member-cards">{linkedShown.map(u => { const t = tierOf(u.points); return <article className="ad-member-card" key={u.id}>
              <div className="ad-member-card-top"><div><b>{memberName(u)}</b><TierChip name={t.name} /></div><button ref={focusRef(u)} className="ad-btn ad-btn--ghost ad-btn--sm ad-manage-btn" aria-expanded={memberMenuId === u.id} aria-label={`จัดการ ${u.first_name ?? "สมาชิก"}`} onClick={() => setMemberMenuId(memberMenuId === u.id ? null : u.id)}>จัดการ <span aria-hidden="true">{memberMenuId === u.id ? "▴" : "▾"}</span></button></div>
              <div className="ad-member-card-body"><span><span className="ad-mono">{fmtPhone(u.phone)}</span> · {u.line_user_id ? <span className="ad-line-ok"><Icon name="check" size={13} />LINE</span> : <span className="ad-text-danger">ไม่มี LINE</span>}</span><div><code className="ad-code">{u.customer_id}</code><strong>{u.points.toLocaleString()} แต้ม</strong></div></div>
              {memberMenuId === u.id && <div className="ad-member-card-menu"><div><span>วันเกิด {formatBirthday(u.birthday)}</span><span>สมัคร {formatDate(u.created_at)}</span></div>{canEdit && <><button onClick={() => changePhone(u)}>เปลี่ยนเบอร์</button><button onClick={() => openManualCode(u)}>แก้รหัส Hero</button>{u.line_user_id && <button className="danger" onClick={() => resetLine(u)}>ปลด LINE เดิม</button>}</>}</div>}
            </article>; })}</div>
            </section>}
          </div>
        )}

        {/* ═══ คำขอแลกของรางวัล ═══ */}
        {tab === "redeem" && canEdit && (
          <div className="ad-card">
            <div className="ad-card-h ad-card-h--tight">
              <div><h3>คำขอแลกของรางวัล {pending > 0 && <span className="ad-badge">{pending} รอยืนยัน</span>}</h3><p>ตรวจเลขคำขอและส่งมอบของ<span className="ad-nowrap">ก่อนยืนยัน</span></p></div>
              <div className="ad-h-actions"><button className="ad-btn ad-btn--ghost ad-refresh-btn" onClick={() => fetchRedemptions()} disabled={redeemLoading} aria-label={redeemLoading ? "กำลังโหลดคำขอแลกของ" : "รีเฟรชคำขอแลกของ"} title="รีเฟรชคำขอแลกของ"><Icon name="refresh" size={18} /><span className="ad-refresh-label">{redeemLoading ? "กำลังโหลด…" : "รีเฟรช"}</span></button></div>
            </div>
            {redeemError && <div className="ad-alert ad-alert--err" style={{ marginBottom: 10 }}>{redeemError}</div>}
            {pendingRedeems.length === 0 ? <div className="ad-empty ad-redeem-empty"><Icon name="checkCircle" size={30} />ไม่มีคำขอรอรับของ</div> : <>
              <div className="ad-safety ad-redeem-safety"><Icon name="shield" size={18} /><span><b>ก่อนยืนยัน</b> ดูเลขคำขอในบัตรสมาชิก LINE ของลูกค้าให้ตรงกับการ์ด · หักแต้มที่จองไว้เมื่อยืนยัน · <span className="ad-nowrap">ยกเลิก = ปลดแต้มที่จอง</span></span></div>
              <div className="ad-redeem-grid">
                {pendingRedeems.map(r => {
                  const name = r.first_name ? `${r.first_name} ${r.last_name ?? ""}` : (r.display_name ?? "-");
                  const busy = redeemAction[r.id];
                  const age = redemptionAge(r.created_at);
                  return <article className="ad-redeem-card" key={r.id}>
                    <div className="ad-redeem-top"><span className={`ad-chip ${age.overdue ? "ad-chip--danger" : "ad-chip--warn"}`}>{age.label}</span><b className="ad-req-number">#REQ-{r.id}</b><time dateTime={r.created_at}>{formatDateTime(r.created_at)}</time></div>
                    <div className="ad-reward-name">{r.reward_name}</div>
                    <div className="ad-redeem-person"><div className="ad-redeem-who"><b>{name}</b><span className="ad-mono">{fmtPhone(r.phone)}</span></div><div className="ad-reserved"><small>จองไว้</small><b>{r.points_required.toLocaleString()} <span>แต้ม</span></b></div></div>
                    <div className="ad-redeem-actions"><button className="ad-cancel-text" onClick={() => { setRedeemModal({ row: r, action: "cancel" }); setCancelReason("ลูกค้าไม่มารับ"); }} disabled={busy}>ยกเลิกและปลดจอง</button><button className="ad-btn ad-btn--ok ad-redeem-confirm" onClick={() => { setRedeemModal({ row: r, action: "confirm" }); setHandoffChecked(false); }} disabled={busy}>{busy ? "กำลังบันทึก…" : "ยืนยันรับของ"}</button></div>
                  </article>;
                })}
              </div>
            </>}
              <div className="ad-card-h ad-history-head"><div><h3>ประวัติคำขอ</h3></div></div>
              {completedRedeems.length === 0 ? <div className="ad-empty">ยังไม่มีประวัติ</div> : <><div className="ad-twrap ad-redeem-history-table"><table className="ad-table">
                <thead><tr><th>เลขคำขอ</th><th>สถานะ</th><th>ลูกค้า</th><th>ของรางวัล</th><th className="r">แต้มที่หัก</th><th className="ad-col-gap">ขอเมื่อ</th><th>ยืนยันเมื่อ</th></tr></thead>
                <tbody>
                  {completedRedeems.map(r => {
                    const name = r.first_name ? `${r.first_name} ${r.last_name ?? ""}` : (r.display_name ?? "-");
                    const isConfirmed = r.status === "confirmed";
                    return (
                      <tr key={r.id}>
                        <td><b className="ad-mono ad-req-link">#REQ-{r.id}</b></td>
                        <td><span className={`ad-chip ${isConfirmed ? "ad-chip--ok" : "ad-chip--muted"}`}>{isConfirmed ? "ยืนยันแล้ว" : "ยกเลิก"}</span></td>
                        <td><b>{name}</b><span className="ad-cell-sub ad-mono">{fmtPhone(r.phone)}</span></td>
                        <td>{r.reward_name}</td>
                        <td className="r">{isConfirmed ? <span className="ad-points-used">−{r.points_required.toLocaleString()} <small>แต้ม</small></span> : <span className="ad-dash" title="ยกเลิกก่อนยืนยัน แต้มจึงไม่ถูกหัก (แค่ปลดที่จองไว้)">ไม่ได้หัก</span>}</td>
                        <td className="ad-note ad-col-gap">{formatDateTime(r.created_at)}</td>
                        <td>{isConfirmed && r.confirmed_at ? <span className="ad-note">{formatDateTime(r.confirmed_at)}</span> : <span className="ad-dash" aria-label="ไม่มี">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div><div className="ad-redeem-history-cards">{completedRedeems.map(r => { const name = r.first_name ? `${r.first_name} ${r.last_name ?? ""}` : (r.display_name ?? "-"); const isConfirmed = r.status === "confirmed"; return <article key={r.id}><div><code>#REQ-{r.id}</code><span className={`ad-chip ${isConfirmed ? "ad-chip--ok" : "ad-chip--muted"}`}>{isConfirmed ? "ยืนยันแล้ว" : "ยกเลิก"}</span></div><b>{r.reward_name}</b><span>{name} · <span className="ad-mono">{fmtPhone(r.phone)}</span></span><div><span className="ad-note">{isConfirmed && r.confirmed_at ? `ยืนยัน ${formatDateTime(r.confirmed_at)}` : `ขอ ${formatDateTime(r.created_at)}`}</span>{isConfirmed ? <span className="ad-points-used">−{r.points_required.toLocaleString()} แต้ม</span> : <span className="ad-dash">ไม่ได้หักแต้ม</span>}</div></article>; })}</div></>}
          </div>
        )}

        {/* ═══ เพิ่ม / หักแต้ม ═══ */}
        {tab === "points" && canEdit && (
          <>
            <div className="ad-alert ad-alert--info ad-alert--icon" style={{ marginBottom: 14 }}><Icon name="info" />ปกติแต้มเข้าอัตโนมัติจากบิล Hero — ใช้หน้านี้เฉพาะกรณีพิเศษ (บิลก่อนผูกรหัส, แก้ผิด, คืนสินค้า)</div>
            <div className="ad-grid ad-grid--2">
              <div className="ad-card">
                <div className="ad-card-h"><div><h3><Icon name="plus" size={20} />เพิ่มแต้ม</h3><p>ทุก 100 บาท = 1 แต้ม (ปัดเศษทิ้ง)</p></div></div>
                <div className="ad-form">
                  <div className="ad-row">
                    <div className="ad-field" style={{ flex: 1 }}><label>เบอร์มือถือลูกค้า</label><input className="ad-input ad-input--num" type="tel" inputMode="numeric" maxLength={10} placeholder="08XXXXXXXX" value={apPhone} onChange={e => { setApPhone(e.target.value.replace(/\D/g, "")); setApResult(null); setApError(""); }} /></div>
                    <div className="ad-field" style={{ flex: 1 }}><label>ยอดซื้อ (บาท)</label><input className="ad-input ad-input--num" type="number" min={100} step={100} placeholder="1500" value={apAmount} onChange={e => { setApAmount(e.target.value); setApResult(null); setApError(""); }} onKeyDown={e => e.key === "Enter" && handleAddPoints()} /></div>
                  </div>
                  <div className="ad-field"><label>หมายเหตุ (ถ้ามี)</label><input className="ad-input" type="text" placeholder="เช่น บิล IV-690914-0012 ก่อนผูกรหัส" value={apNote} onChange={e => setApNote(e.target.value)} /></div>
                  <div className="ad-row">
                    <button className="ad-btn ad-btn--primary" onClick={handleAddPoints} disabled={apLoading}>{apLoading ? "กำลังเพิ่ม…" : "เพิ่มแต้ม"}</button>
                    {apAmount && parseInt(apAmount) >= 100 && <div className="ad-calc">= <b style={{ color: "var(--ad-blue)" }}>{Math.floor(parseInt(apAmount) / 100)}</b> แต้ม</div>}
                  </div>
                  {apError && <div className="ad-alert ad-alert--err">{apError}</div>}
                  {apResult && <div className="ad-alert ad-alert--ok ad-alert--icon"><Icon name="checkCircle" /><span><b>{apResult.name}</b> ได้รับ <b>{apResult.pointsEarned} แต้ม</b> · แต้มรวม {apResult.totalPoints.toLocaleString()}</span></div>}
                </div>
              </div>
              <div className="ad-card">
                <div className="ad-card-h"><div><h3><Icon name="undo" size={20} />หักแต้ม (คืนสินค้า)</h3><p>หักตามยอดเงินที่คืน ทุก 100 บาท = 1 แต้ม</p></div></div>
                <div className="ad-form">
                  <div className="ad-row">
                    <div className="ad-field" style={{ flex: 1 }}><label>เบอร์มือถือลูกค้า</label><input className="ad-input ad-input--num" type="tel" inputMode="numeric" maxLength={10} placeholder="08XXXXXXXX" value={dpPhone} onChange={e => { setDpPhone(e.target.value.replace(/\D/g, "")); setDpResult(null); setDpError(""); }} /></div>
                    <div className="ad-field" style={{ flex: 1 }}><label>ยอดเงินที่คืน (บาท)</label><input className="ad-input ad-input--num" type="number" min={100} step={100} placeholder="1500" value={dpAmount} onChange={e => { setDpAmount(e.target.value); setDpResult(null); setDpError(""); }} onKeyDown={e => e.key === "Enter" && handleDeductPoints()} /></div>
                  </div>
                  <div className="ad-field"><label>หมายเหตุ (ถ้ามี)</label><input className="ad-input" type="text" placeholder="เช่น คืนปูน 5 ถุง" value={dpNote} onChange={e => setDpNote(e.target.value)} /></div>
                  <div className="ad-row">
                    <button className="ad-btn ad-btn--danger" onClick={handleDeductPoints} disabled={dpLoading}>{dpLoading ? "กำลังบันทึก…" : "หักแต้ม"}</button>
                    {dpAmount && parseInt(dpAmount) >= 100 && <div className="ad-calc">= หัก <b style={{ color: "var(--ad-danger)" }}>{Math.floor(parseInt(dpAmount) / 100)}</b> แต้ม</div>}
                  </div>
                  {dpError && <div className="ad-alert ad-alert--err">{dpError}</div>}
                  {dpResult && <div className="ad-alert ad-alert--warn ad-alert--icon"><Icon name="checkCircle" /><span><b>{dpResult.name}</b> ถูกหัก <b>{dpResult.pointsDeducted} แต้ม</b> · คงเหลือ {dpResult.totalPoints.toLocaleString()}</span></div>}
                </div>
              </div>
            </div>

            <div className="ad-card" style={{ marginTop: 14 }}>
              <div className="ad-card-h">
                <div><h3><Icon name="folder" size={20} />เพิ่มแต้มหลายรายจากไฟล์</h3><p>Excel (.xlsx) หรือ CSV · 2 คอลัมน์: เบอร์มือถือ, ยอดซื้อ (บาท)</p></div>
                <div className="ad-h-actions"><button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={downloadTemplate}><Icon name="download" size={16} />ดาวน์โหลด Template</button></div>
              </div>
              <label className="ad-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f); }}>
                <i><Icon name="upload" size={30} /></i><b>คลิกเลือกไฟล์ หรือลากมาวางที่นี่</b><span>ระบบจะแสดงรายการให้ตรวจก่อน แล้วค่อยกดยืนยัน</span>
                <input ref={csvInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); e.target.value = ""; }} />
              </label>
              {csvError && <div className="ad-alert ad-alert--err" style={{ marginTop: 10 }}>{csvError}</div>}
              {csvRows.length > 0 && (
                <>
                  <div className="ad-twrap" style={{ marginTop: 14 }}><table className="ad-table">
                    <thead><tr><th>#</th><th>เบอร์มือถือ</th><th className="r">ยอดซื้อ (บาท)</th><th className="r">แต้มที่จะได้</th>{csvDone && <><th>ชื่อลูกค้า</th><th>ผลลัพธ์</th></>}</tr></thead>
                    <tbody>
                      {csvRows.map((r, i) => (
                        <tr key={i}>
                          <td className="ad-note">{i + 1}</td><td>{fmtPhone(r.phone)}</td><td className="r">{r.amount.toLocaleString()}</td><td className="r"><b style={{ color: "var(--ad-blue)" }}>{Math.floor(r.amount / 100)}</b></td>
                          {csvDone && <td>{r.name ?? "-"}</td>}
                          {csvDone && <td>{r.status === "success" ? <span className="ad-chip ad-chip--ok"><Icon name="check" size={13} />+{r.pointsEarned} แต้ม (รวม {r.totalPoints?.toLocaleString()})</span> : <span className="ad-chip ad-chip--danger"><Icon name="x" size={13} />{r.message}</span>}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                  <div className="ad-row" style={{ marginTop: 12 }}>
                    {!csvDone ? (
                      <>
                        <button className="ad-btn ad-btn--primary" onClick={handleBulkAddPoints} disabled={csvLoading}>{csvLoading ? "กำลังเพิ่มแต้ม…" : `ยืนยันเพิ่มแต้ม ${csvRows.length} รายการ`}</button>
                        <button className="ad-btn ad-btn--ghost" onClick={() => { setCsvRows([]); setCsvDone(false); setCsvError(""); }}>ยกเลิก</button>
                      </>
                    ) : (
                      <>
                        <div className="ad-alert ad-alert--ok ad-alert--icon"><Icon name="checkCircle" />สำเร็จ {csvRows.filter(r => r.status === "success").length} / {csvRows.length} รายการ</div>
                        <button className="ad-btn ad-btn--ghost" onClick={() => { setCsvRows([]); setCsvDone(false); }}>อัปโหลดไฟล์ใหม่</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ═══ ประวัติแต้ม ═══ */}
        {tab === "history" && (
          <div className="ad-card">
            <div className="ad-card-h">
              <div><h3><Icon name="history" size={20} />ประวัติแต้ม</h3><p>รายการได้รับ/ใช้แต้มของสมาชิกทุกคน (ล่าสุดก่อน)</p></div>
              <div className="ad-h-actions">
                {txRows.length > 0 && <button className="ad-btn ad-btn--ok ad-btn--sm" onClick={exportTxExcel}><Icon name="download" size={16} />Export Excel</button>}
                <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => fetchTransactions()} disabled={txLoading}><Icon name="refresh" size={16} />{txLoading ? "กำลังโหลด…" : "รีเฟรช"}</button>
              </div>
            </div>
            <div className="ad-toolbar">
              <input className="ad-input" type="text" placeholder="ค้นหาชื่อ / เบอร์…" value={txSearch} onChange={e => setTxSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchTransactions()} style={{ maxWidth: 260 }} />
              <div className="ad-field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><label>ตั้งแต่</label><input className="ad-input" type="date" value={txFrom} onChange={e => setTxFrom(e.target.value)} style={{ width: 160 }} /></div>
              <div className="ad-field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><label>ถึง</label><input className="ad-input" type="date" value={txTo} onChange={e => setTxTo(e.target.value)} style={{ width: 160 }} /></div>
              <button className="ad-btn ad-btn--primary" onClick={() => fetchTransactions()}>ค้นหา</button>
              {(txSearch || txFrom || txTo) && <button className="ad-btn ad-btn--ghost" onClick={() => { setTxSearch(""); setTxFrom(""); setTxTo(""); fetchTransactions("", "", ""); }}>ล้าง</button>}
            </div>
            {txRows.length === 0 ? <div className="ad-empty"><Icon name="inbox" size={30} />{txLoading ? "กำลังโหลด…" : "ยังไม่มีรายการ"}</div> : (
              <div className="ad-twrap"><table className="ad-table">
                <thead><tr><th>#</th><th>ประเภท</th><th>วันเวลา</th><th>ลูกค้า</th><th>เบอร์</th><th className="r">ยอดซื้อ (บาท)</th><th className="r">แต้ม</th><th>หมายเหตุ</th></tr></thead>
                <tbody>
                  {txRows.map((t, i) => {
                    const name = t.first_name ? `${t.first_name} ${t.last_name}` : (t.display_name ?? "-");
                    const isRedeem = t.type === "redeem";
                    return (
                      <tr key={t.id}>
                        <td className="ad-note">{i + 1}</td>
                        <td><span className={`ad-chip ${isRedeem ? "ad-chip--warn" : "ad-chip--blue"}`}>{isRedeem ? "แลกรางวัล" : "ได้รับแต้ม"}</span></td>
                        <td className="ad-note">{formatDateTime(t.created_at)}</td>
                        <td><b>{name}</b></td>
                        <td>{fmtPhone(t.phone)}</td>
                        <td className="r">{isRedeem ? "-" : Number(t.purchase_amount).toLocaleString()}</td>
                        <td className="r"><b style={{ color: isRedeem ? "var(--ad-danger)" : "var(--ad-ok)" }}>{isRedeem ? "−" : "+"}{t.points_earned.toLocaleString()}</b></td>
                        <td className="ad-note" style={{ whiteSpace: "normal", maxWidth: 320 }}>{t.note ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table><div className="ad-note" style={{ padding: "10px 0 0" }}>แสดง {txRows.length} รายการล่าสุด</div></div>
            )}
          </div>
        )}

        {/* ═══ ตั้งค่า (super) ═══ */}
        {tab === "settings" && role === "super" && (
          <>
            <div className="ad-card">
              <div className="ad-card-h">
                <div><h3><Icon name="users" size={20} />บัญชีพนักงาน (Admin)</h3><p>Staff = ผูกรหัส/เพิ่มแต้ม/ยืนยันแลกของ · Viewer = ดูอย่างเดียว</p></div>
                <div className="ad-h-actions"><button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={fetchAdminUsers} disabled={adminUsersLoading}><Icon name="refresh" size={16} />{adminUsersLoading ? "…" : "รีเฟรช"}</button></div>
              </div>
              <div className="ad-row" style={{ marginBottom: 12 }}>
                <div className="ad-field"><label>ชื่อผู้ใช้</label><input className="ad-input" type="text" placeholder="เช่น cashier1" value={newAdminUsername} onChange={e => setNewAdminUsername(e.target.value)} style={{ width: 170 }} /></div>
                <div className="ad-field"><label>รหัสผ่าน</label><input className="ad-input" type="text" placeholder="รหัสผ่าน" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} style={{ width: 170 }} /></div>
                <div className="ad-field"><label>สิทธิ์</label><select className="ad-input" value={newAdminRole} onChange={e => setNewAdminRole(e.target.value)} style={{ width: 200 }}><option value="staff">Staff (ผูกรหัส/แต้ม/แลกของ)</option><option value="viewer">Viewer (ดูอย่างเดียว)</option></select></div>
                <button className="ad-btn ad-btn--primary" onClick={handleCreateAdmin}><Icon name="plus" size={16} />เพิ่มบัญชี</button>
              </div>
              {newAdminError && <div className="ad-alert ad-alert--err" style={{ marginBottom: 10 }}>{newAdminError}</div>}
              {newAdminSuccess && <div className="ad-alert ad-alert--ok" style={{ marginBottom: 10 }}>{newAdminSuccess}</div>}
              {adminUsers.length === 0 ? <div className="ad-empty">ยังไม่มีบัญชีพนักงาน (มีแค่ admin หลัก)</div> : (
                <div className="ad-twrap"><table className="ad-table">
                  <thead><tr><th>ชื่อผู้ใช้</th><th>สิทธิ์</th><th>สถานะ</th><th>สร้างเมื่อ</th><th></th></tr></thead>
                  <tbody>
                    {adminUsers.map(u => (
                      <tr key={u.id}>
                        <td><b>{u.username}</b></td>
                        <td><span className={`ad-chip ${u.role === "staff" ? "ad-chip--ok" : "ad-chip--muted"}`}>{u.role === "staff" ? "Staff" : "Viewer"}</span></td>
                        <td><span className={`ad-chip ${u.active ? "ad-chip--ok" : "ad-chip--danger"}`}>{u.active ? "ใช้งาน" : "ปิดใช้"}</span></td>
                        <td className="ad-note">{formatDate(u.created_at)}</td>
                        <td style={{ display: "flex", gap: 6 }}>
                          <button className={`ad-btn ad-btn--xs ${u.active ? "ad-btn--warn" : "ad-btn--ok"}`} onClick={() => handleToggleAdmin(u.id, u.active)}>{u.active ? "ปิดใช้" : "เปิดใช้"}</button>
                          <button className="ad-btn ad-btn--xs ad-btn--ghost" onClick={() => handleDeleteAdmin(u.id, u.username)}>ลบ</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>

            <div className="ad-card ad-danger-zone">
              <div className="ad-card-h"><div><h3><Icon name="trash" size={20} />เคลียร์ประวัติแต้มสมาชิก</h3><p>รีเซ็ตแต้มเป็น 0 และซ่อนประวัติทั้งหมดของเบอร์นี้ (ย้อนกลับไม่ได้ · บันทึก audit log)</p></div></div>
              <div className="ad-row">
                <div className="ad-field"><label>เบอร์มือถือลูกค้า</label><input className="ad-input ad-input--num" type="tel" inputMode="numeric" maxLength={10} placeholder="08XXXXXXXX" value={clrPhone} onChange={e => { setClrPhone(e.target.value.replace(/\D/g, "")); setClrResult(null); setClrError(""); }} style={{ width: 180 }} /></div>
                <div className="ad-field"><label>รหัสผ่าน Admin (ยืนยัน)</label><input className="ad-input" type="password" value={clrPw} onChange={e => { setClrPw(e.target.value); setClrResult(null); setClrError(""); }} style={{ width: 180 }} /></div>
                <button className="ad-btn ad-btn--danger" onClick={handleClearPoints} disabled={clrLoading}>{clrLoading ? "กำลังดำเนินการ…" : "เคลียร์ประวัติ"}</button>
              </div>
              {clrError && <div className="ad-alert ad-alert--err" style={{ marginTop: 10 }}>{clrError}</div>}
              {clrResult && <div className="ad-alert ad-alert--warn" style={{ marginTop: 10 }}>เคลียร์ประวัติของ <b>{clrResult.name}</b> แล้ว · แต้มที่ถูกซ่อน {clrResult.clearedPoints.toLocaleString()}</div>}
            </div>

            <div className="ad-card">
              <div className="ad-card-h">
                <div><h3><Icon name="shield" size={20} />Audit log</h3><p>บันทึกทุกการกระทำของแอดมิน/บอท · ใส่เบอร์เพื่อดูประวัติที่ถูกลบของลูกค้าคนนั้น</p></div>
                <div className="ad-h-actions"><button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => { setAuditOpen(true); fetchAuditLog(""); }} disabled={auditLoading}>{auditLoading ? "…" : auditOpen ? "รีเฟรช" : "โหลด log"}</button></div>
              </div>
              {auditOpen && (
                <>
                  <div className="ad-toolbar">
                    <input className="ad-input ad-input--num" type="tel" inputMode="numeric" maxLength={10} placeholder="เบอร์ลูกค้า (ดูประวัติที่ถูกลบ)" value={auditPhone} onChange={e => setAuditPhone(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && fetchAuditLog()} style={{ maxWidth: 260 }} />
                    <button className="ad-btn ad-btn--primary ad-btn--sm" onClick={() => fetchAuditLog()} disabled={auditLoading}>ค้นหา</button>
                    {auditPhone && <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => { setAuditPhone(""); fetchAuditLog(""); }}>ล้าง</button>}
                  </div>
                  {auditPhone && (
                    <div style={{ marginBottom: 16 }}>
                      <div className="ad-note" style={{ fontWeight: 700, color: "var(--ad-danger)", marginBottom: 6 }}>ประวัติที่ถูกลบ (เบอร์ {auditPhone})</div>
                      {auditCleared.length === 0 ? <div className="ad-note">ไม่มีรายการที่ถูกลบ</div> : (
                        <div className="ad-twrap"><table className="ad-table">
                          <thead><tr><th>#</th><th>ประเภท</th><th>วันเวลา</th><th className="r">แต้ม</th><th className="r">ยอดซื้อ</th><th>หมายเหตุ</th></tr></thead>
                          <tbody>{auditCleared.map((t, i) => { const isRedeem = t.type === "redeem"; return (
                            <tr key={t.id}><td className="ad-note">{i + 1}</td><td><span className={`ad-chip ${isRedeem ? "ad-chip--warn" : "ad-chip--blue"}`}>{isRedeem ? "แลกรางวัล" : "ได้รับแต้ม"}</span></td><td className="ad-note">{formatDateTime(t.created_at)}</td><td className="r"><b style={{ color: isRedeem ? "var(--ad-danger)" : "var(--ad-ok)" }}>{isRedeem ? "−" : "+"}{t.points_earned}</b></td><td className="r">{isRedeem ? "-" : Number(t.purchase_amount).toLocaleString()}</td><td className="ad-note">{t.note ?? "-"}</td></tr>
                          ); })}</tbody>
                        </table></div>
                      )}
                    </div>
                  )}
                  {auditLogs.length === 0 ? <div className="ad-empty">ไม่มีบันทึก</div> : (
                    <div className="ad-twrap"><table className="ad-table">
                      <thead><tr><th>#</th><th>วันเวลา</th><th>การกระทำ</th><th>รายละเอียด</th></tr></thead>
                      <tbody>{auditLogs.map((log, i) => (
                        <tr key={log.id}><td className="ad-note">{i + 1}</td><td className="ad-note">{formatDateTime(log.created_at)}</td><td><span className="ad-chip ad-chip--muted">{log.action}</span></td><td style={{ whiteSpace: "normal", maxWidth: 520 }}>{log.detail}</td></tr>
                      ))}</tbody>
                    </table></div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
      {linkTarget && <div className="ad-modal-backdrop" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target && !linkSaving) setLinkTarget(null); }}><section className="ad-modal" role="dialog" aria-modal="true" aria-labelledby="link-modal-title">
        <div className="ad-modal-head"><h2 id="link-modal-title">{linkMode === "manual" ? (linkTarget.customer_id ? "แก้รหัส Hero" : "กรอกรหัส Hero เอง") : "ผูกรหัส Hero ให้ลูกค้า"}</h2><button className="ad-modal-close" aria-label="ปิด" onClick={() => setLinkTarget(null)} disabled={linkSaving}><Icon name="x" size={20} /></button></div>
        {linkMode === "manual" && <>
          <p className="ad-modal-lead">ค้นลูกค้าในโปรแกรม Hero ก่อน แล้วพิมพ์รหัสและชื่อตามที่เห็นในหน้าจอ Hero</p>
          <div className="ad-field"><label htmlFor="link-code">รหัสลูกค้า Hero</label><input id="link-code" className={`ad-input ad-input--num${editError || (editValue && !linkCodeValid) ? " invalid" : ""}`} autoFocus autoComplete="off" placeholder="CUS-00000" value={editValue} onChange={e => { setEditValue(e.target.value.toUpperCase()); setEditError(""); }} aria-invalid={!!editError || (!!editValue && !linkCodeValid)} aria-describedby="link-code-hint" /><span id="link-code-hint" className={editError || (editValue && !linkCodeValid) ? "ad-field-error" : "ad-field-hint"}>{editError || (editValue && !linkCodeValid ? "รูปแบบต้องเป็น CUS-00000" : linkTarget.customer_id ? "เว้นว่าง = ยกเลิกการผูกรหัสเดิม" : "เช่น CUS-00912")}</span></div>
          {!linkIsClear && <div className="ad-field"><label htmlFor="link-hero-name">ชื่อลูกค้าใน Hero</label><input id="link-hero-name" className="ad-input" autoComplete="off" placeholder="พิมพ์ตามที่เห็นในโปรแกรม Hero" value={manualHeroName} onChange={e => { setManualHeroName(e.target.value); setMismatchAck(false); }} /></div>}
        </>}
        {!linkIsClear && <div className="ad-confirm-pairs">
          <div><span>ชื่อที่สมัคร</span><b>{linkMemberName}</b><small className="ad-mono">{fmtPhone(linkTarget.phone)}</small></div>
          <div><span>Hero</span><b>{linkHeroName || (linkMode === "manual" ? "—" : "ไม่มีชื่อใน Hero")}</b><small className="ad-mono">{linkCode || "—"}</small></div>
        </div>}
        {!linkIsClear && linkHeroName && <div className="ad-name-verdict"><NameMatchChip state={linkNameState} />{linkNameState === "mismatch" && <span>ชื่อสองฝั่งไม่ตรงกัน อาจเป็นคนละคน</span>}</div>}
        {linkNeedsAck && <label className="ad-check ad-check--caution"><input type="checkbox" checked={mismatchAck} onChange={e => setMismatchAck(e.target.checked)} /><span>ถามลูกค้าแล้ว ยืนยันว่าเป็นคนเดียวกัน<small>เช่น ใช้ชื่อร้าน ชื่อเล่น หรือเปลี่ยนนามสกุล — ถ้าไม่แน่ใจ อย่าผูก</small></span></label>}
        {linkIsClear && <div className="ad-alert ad-alert--warn">ยกเลิกการผูก <b className="ad-mono">{linkTarget.customer_id}</b> · บิล Hero ใหม่จะไม่ให้แต้มจนกว่าจะผูกใหม่</div>}
        {linkMode === "suggested" && editError && <div className="ad-alert ad-alert--err">{editError}</div>}
        <label className="ad-check"><input type="checkbox" checked={linkChecked} onChange={e => setLinkChecked(e.target.checked)} /><span>ตรวจบัตร/เบอร์บนเครื่องลูกค้าแล้ว</span></label>
        <div className="ad-modal-actions"><button className="ad-btn ad-btn--ghost" onClick={() => setLinkTarget(null)} disabled={linkSaving}>ยกเลิก</button><button className={`ad-btn ${linkIsClear ? "ad-btn--danger" : linkNeedsAck ? "ad-btn--caution-solid" : "ad-btn--ok"}`} disabled={!linkReady} onClick={submitLink}>{linkSaving ? "กำลังบันทึก…" : linkIsClear ? "ยกเลิกการผูกรหัส" : linkNeedsAck ? "ผูกทั้งที่ชื่อไม่ตรง" : "ยืนยันผูกรหัส"}</button></div>
      </section></div>}
      {redeemModal && <div className="ad-modal-backdrop" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target) setRedeemModal(null); }}><section className="ad-modal" role="dialog" aria-modal="true" aria-labelledby="redeem-modal-title">
        <div className="ad-modal-head"><div><span className="ad-mono ad-modal-req">#REQ-{redeemModal.row.id}</span><h2 id="redeem-modal-title">{redeemModal.action === "confirm" ? "ยืนยันการส่งมอบของ" : "ยกเลิกคำขอ"}</h2></div><button className="ad-modal-close" aria-label="ปิด" onClick={() => setRedeemModal(null)}>×</button></div>
        <div className="ad-modal-reward">{redeemModal.row.reward_name}</div>
        <div className="ad-modal-customer"><b>{redeemModal.row.first_name ? `${redeemModal.row.first_name} ${redeemModal.row.last_name ?? ""}` : (redeemModal.row.display_name ?? "-")}</b><span>{fmtPhone(redeemModal.row.phone)}</span></div>
        {redeemModal.action === "confirm"
          ? <div className="ad-points-change"><div>หักแต้มลูกค้า <b>{redeemModal.row.points_required.toLocaleString()} แต้ม</b> ตอนกดยืนยัน</div><small>ตอนลูกค้าขอแลก ระบบแค่จองแต้มไว้ ยังไม่ได้หัก · ของรางวัลลดสต๊อก 1 ชิ้น</small></div>
          : <div className="ad-points-change neutral"><div>ปลดแต้มที่จองไว้ <b>{redeemModal.row.points_required.toLocaleString()} แต้ม</b></div><small>แต้มยังไม่เคยถูกหัก ยอดแต้มลูกค้าจึงไม่เปลี่ยน · ลูกค้านำแต้มไปแลกอย่างอื่นได้ทันที</small></div>}
        {redeemModal.action === "confirm" ? <label className="ad-check"><input type="checkbox" checked={handoffChecked} onChange={e => setHandoffChecked(e.target.checked)} /><span>ส่งมอบของให้ลูกค้าแล้ว</span></label> : <fieldset className="ad-reason-list"><legend>เหตุผลที่ยกเลิก</legend>{(["ลูกค้าไม่มารับ", "ของหมด", "กดผิด"] as const).map(reason => <label key={reason}><input type="radio" name="cancel-reason" value={reason} checked={cancelReason === reason} onChange={() => setCancelReason(reason)} /><span>{reason}</span></label>)}</fieldset>}
        <div className="ad-modal-actions"><button className="ad-btn ad-btn--ghost" onClick={() => setRedeemModal(null)}>กลับ</button><button className={`ad-btn ${redeemModal.action === "confirm" ? "ad-btn--ok" : "ad-btn--danger"}`} disabled={redeemAction[redeemModal.row.id] || (redeemModal.action === "confirm" && !handoffChecked)} onClick={() => handleRedeemAction(redeemModal.row.id, redeemModal.action)}>{redeemModal.action === "confirm" ? `ยืนยัน · หัก ${redeemModal.row.points_required.toLocaleString()} แต้ม` : "ยืนยันยกเลิกคำขอ"}</button></div>
      </section></div>}
      {unlinkTarget && <div className="ad-modal-backdrop" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target && !memberBusy) setUnlinkTarget(null); }}><section className="ad-modal" role="dialog" aria-modal="true" aria-labelledby="unlink-modal-title">
        <div className="ad-modal-head"><h2 id="unlink-modal-title">ปลดบัญชี LINE เดิม</h2><button className="ad-modal-close" aria-label="ปิด" onClick={() => setUnlinkTarget(null)} disabled={memberBusy}>×</button></div>
        <div className="ad-confirm-pairs"><div><span>สมาชิก</span><b>{`${unlinkTarget.first_name ?? "-"} ${unlinkTarget.last_name ?? ""}`.trim()}</b><small className="ad-mono">{fmtPhone(unlinkTarget.phone)}</small></div><div><span>รหัส Hero</span><b className="ad-mono">{unlinkTarget.customer_id ?? "—"}</b><small>{unlinkTarget.points.toLocaleString()} แต้ม · ไม่หายหลังปลด</small></div></div>
        <div className="ad-alert ad-alert--warn">ใช้เมื่อลูกค้าเปลี่ยนเครื่องหรือบัญชี LINE หาย · หลังปลด LINE เดิมจะเปิดบัตรสมาชิกไม่ได้</div>
        <ol className="ad-steps"><li>ให้ลูกค้าเปิด LINE ใหม่ → เมนูสมัครสมาชิก</li><li>กรอกเบอร์ <b className="ad-mono">{fmtPhone(unlinkTarget.phone)}</b> เดิม</li><li>แต้มและระดับจะตามไปเอง</li></ol>
        <div className="ad-modal-actions"><button className="ad-btn ad-btn--ghost" onClick={() => setUnlinkTarget(null)} disabled={memberBusy}>กลับ</button><button className="ad-btn ad-btn--danger" onClick={submitUnlink} disabled={memberBusy}>{memberBusy ? "กำลังปลด…" : "ปลด LINE เดิม"}</button></div>
      </section></div>}
      {phoneTarget && <div className="ad-modal-backdrop" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target && !memberBusy) setPhoneTarget(null); }}><section className="ad-modal" role="dialog" aria-modal="true" aria-labelledby="phone-modal-title">
        <div className="ad-modal-head"><h2 id="phone-modal-title">เปลี่ยนเบอร์สมาชิก</h2><button className="ad-modal-close" aria-label="ปิด" onClick={() => setPhoneTarget(null)} disabled={memberBusy}>×</button></div>
        <div className="ad-confirm-pairs"><div><span>สมาชิก</span><b>{`${phoneTarget.first_name ?? "-"} ${phoneTarget.last_name ?? ""}`.trim()}</b><small>เบอร์เดิม <span className="ad-mono">{fmtPhone(phoneTarget.phone)}</span></small></div></div>
        <div className="ad-field"><label htmlFor="phone-new">เบอร์ใหม่ (10 หลัก)</label><input id="phone-new" className={`ad-input ad-input--num${phoneError ? " invalid" : ""}`} type="tel" inputMode="numeric" maxLength={10} autoFocus value={phoneValue} onChange={e => { setPhoneValue(e.target.value.replace(/\D/g, "")); setPhoneError(""); }} onKeyDown={e => e.key === "Enter" && submitPhone()} aria-invalid={!!phoneError} aria-describedby={phoneError ? "phone-new-error" : undefined} />{phoneError && <span id="phone-new-error" className="ad-field-error">{phoneError}</span>}</div>
        <div className="ad-modal-actions"><button className="ad-btn ad-btn--ghost" onClick={() => setPhoneTarget(null)} disabled={memberBusy}>กลับ</button><button className="ad-btn ad-btn--primary" onClick={submitPhone} disabled={memberBusy}>{memberBusy ? "กำลังบันทึก…" : "บันทึกเบอร์ใหม่"}</button></div>
      </section></div>}
      {toast && <div className={`ad-toast ad-toast--${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>{toast.tone === "ok" && <Icon name="checkCircle" size={18} />}{toast.text}</div>}
    </div>
  );
}
