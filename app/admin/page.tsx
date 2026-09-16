"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import "./admin.css";

// หน้าแอดมินระบบสมาชิก — รื้อหน้าตา 16 ก.ย. 69: แบ่งเป็นแท็บ (ภาพรวม/สมาชิก/แลกของ/แต้ม/ประวัติ/ตั้งค่า) แทนหน้าเดียวยาว · ตรรกะ/API เดิมทั้งหมด
// สไตล์อยู่ admin.css (คลาส ad-*) · จำการล็อกอินใน sessionStorage (ปิดแท็บ = หลุด)

interface User {
  id: number;
  customer_id: string | null;
  suggested_customer_id?: string | null;   // บอทเดาจากเบอร์โทร รอพนักงานกดยืนยัน
  line_user_id?: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  company: string | null;
  birthday: string | null;
  points: number;
  created_at: string;
}

type Tab = "overview" | "members" | "redeem" | "points" | "history" | "settings";

// เกณฑ์ระดับ (ตรงกับ lib/points.ts) — ของเดิมบนหน้านี้พิมพ์ผิด (Platinum 4,000 / Gold 1,000)
const TIERS = [
  { name: "Diamond",  emoji: "💎", min: 10000, color: "#1565C0" },
  { name: "Platinum", emoji: "🔱", min: 5000,  color: "#546E7A" },
  { name: "Gold",     emoji: "🥇", min: 2000,  color: "#F9A825" },
  { name: "Silver",   emoji: "🥈", min: 500,   color: "#78909C" },
  { name: "Bronze",   emoji: "🥉", min: 100,   color: "#8D6E63" },
  { name: "Welcome",  emoji: "👋", min: 0,     color: "#2B5FB8" },
];
const tierOf = (points: number) => TIERS.find(t => points >= t.min) ?? TIERS[TIERS.length - 1];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}
function formatBirthday(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
const fmtPhone = (p: string) => p.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
const initials = (u: User) => (u.first_name?.[0] ?? u.phone.slice(-2)).toUpperCase();

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
    u.created_at ? new Date(u.created_at).toLocaleDateString("th-TH") : "",
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
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editValue, setEditValue]   = useState("");

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
  const [redeemLoading, setRedeemLoading]   = useState(false);
  const [redeemError, setRedeemError]       = useState("");
  const [redeemAction, setRedeemAction]     = useState<Record<number, boolean>>({});

  const [auditOpen, setAuditOpen]       = useState(false);
  const [auditLogs, setAuditLogs]       = useState<AuditRow[]>([]);
  const [auditCleared, setAuditCleared] = useState<ClearedTx[]>([]);
  const [auditPhone, setAuditPhone]     = useState("");
  const [auditLoading, setAuditLoading] = useState(false);

  async function fetchRedemptions(pw = savedPw) {
    setRedeemLoading(true); setRedeemError("");
    try {
      const res  = await fetch("/api/admin/redemptions", { headers: { "x-admin-password": pw } });
      const data = await res.json();
      if (!res.ok) { setRedeemError(data.error ?? "เกิดข้อผิดพลาด"); return; }
      setRedeemRows(data.requests ?? []);
    } catch { setRedeemError("เชื่อมต่อไม่ได้"); }
    finally { setRedeemLoading(false); }
  }

  async function handleRedeemAction(id: number, action: "confirm" | "cancel") {
    if (!window.confirm(action === "confirm" ? `ยืนยันการแลก #REQ-${id} ?` : `ยกเลิกคำขอ #REQ-${id} ?`)) return;
    setRedeemAction(prev => ({ ...prev, [id]: true }));
    try {
      const res  = await fetch("/api/admin/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "เกิดข้อผิดพลาด"); return; }
      fetchRedemptions();
      fetchUsers(savedPw, search);
    } finally { setRedeemAction(prev => ({ ...prev, [id]: false })); }
  }

  useEffect(() => {
    if (authed && savedPw) fetchRedemptions(savedPw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

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
      fetchUsers(savedPw, search);
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
      fetchUsers(savedPw, search);
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
      fetchUsers(savedPw, search);
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
      const res  = await fetch(`/api/admin/members?search=${encodeURIComponent(q)}`, {
        headers: { "x-admin-password": pw, "x-admin-username": uname },
      });
      if (res.status === 401) { setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"); setAuthed(false); setLoading(false); return; }
      if (!res.ok) { setError(`เกิดข้อผิดพลาด (${res.status}) — กรุณา Redeploy Vercel`); setLoading(false); return; }
      const data = await res.json();
      setUsers(data.users ?? []);
      setAuthed(true);
      setSavedPw(pw);
      setSavedUsername(uname);
      sessionStorage.setItem("admin_pw", pw);
      sessionStorage.setItem("admin_username", uname);
    } catch { setError("เชื่อมต่อ API ไม่ได้ — กรุณาตรวจสอบ Vercel deployment"); }
    finally { setLoading(false); }
  }, [savedUsername]);

  // จำการล็อกอินไว้ใน sessionStorage (เหมือนหน้า /admin/rewards) — รีเฟรชหน้าไม่ต้องล็อกอินใหม่
  useEffect(() => {
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
  function go(t: Tab) { setTab(t); sessionStorage.setItem("admin_tab", t); }
  function logout() {
    sessionStorage.removeItem("admin_pw"); sessionStorage.removeItem("admin_username"); sessionStorage.removeItem("admin_role");
    setAuthed(false); setSavedPw(""); setPassword(""); setUsers([]);
  }

  // เปลี่ยนเบอร์ / ปลด LINE เดิม (ลูกค้าเปลี่ยนเครื่องหรือ LINE หาย → ปลดแล้วให้สมัครใหม่ด้วยเบอร์เดิม แต้มตามไป)
  async function patchMember(userId: number, body: Record<string, unknown>, apply: (u: User) => User) {
    const res = await fetch("/api/admin/update-member", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
      body: JSON.stringify({ id: userId, ...body }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert(d.error || `ไม่สำเร็จ (${res.status})`); return; }
    setUsers(prev => prev.map(u => u.id === userId ? apply(u) : u));
  }
  function changePhone(u: User) {
    const v = prompt(`เบอร์ใหม่ของ ${u.first_name ?? ""} ${u.last_name ?? ""} (10 หลัก)`, u.phone);
    if (v == null) return;
    const tel = v.replace(/\D/g, "");
    if (!/^0\d{9}$/.test(tel)) { alert("เบอร์ต้องเป็น 10 หลัก ขึ้นต้น 0"); return; }
    patchMember(u.id, { phone: tel }, x => ({ ...x, phone: tel }));
  }
  function resetLine(u: User) {
    if (!confirm(`ปลดบัญชี LINE เดิมของ ${u.first_name ?? ""} ${u.last_name ?? ""}?\n\nหลังปลด ลูกค้าเปิด LINE ใหม่ → เมนูสมัครสมาชิก → กรอกเบอร์ ${u.phone} เดิม แต้ม/ระดับจะตามไปเอง`)) return;
    patchMember(u.id, { reset_line: true }, x => ({ ...x, line_user_id: null }));
  }

  async function saveCustomerId(userId: number, value: string) {
    setEditingId(null);
    // รหัสลูกค้า Hero (CUS-xxxxx) — ผูกแล้วบอทให้แต้มจากบิล Hero อัตโนมัติ; API ตัดช่องว่าง/พิมพ์ใหญ่ให้ และกันผูกซ้ำคนอื่น
    const code = value.trim().toUpperCase() || null;
    const res = await fetch("/api/admin/update-member", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
      body: JSON.stringify({ id: userId, customer_id: code }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || `บันทึกรหัสลูกค้าไม่สำเร็จ (${res.status})`);
      return;
    }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, customer_id: code, suggested_customer_id: null } : u));
  }

  function exportTxExcel() {
    const data = txRows.map((t, i) => {
      const dt = new Date(t.created_at);
      const isRedeem = t.type === "redeem";
      return {
        "#": i + 1,
        "ประเภท": isRedeem ? "แลกรางวัล" : "เพิ่มแต้ม",
        "วันที่": dt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }),
        "เวลา": dt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
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
      fetchUsers(savedPw, search);
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
  const suggested = users.filter(u => !u.customer_id && u.suggested_customer_id);
  const noLine = users.filter(u => !u.line_user_id);
  const shown = users.filter(u => memberFilter === "all" ? true : memberFilter === "unlinked" ? !u.customer_id : memberFilter === "suggested" ? (!u.customer_id && !!u.suggested_customer_id) : !u.line_user_id);
  const tierCount = (name: string) => users.filter(u => tierOf(u.points).name === name).length;

  const TabBtn = ({ id, label, icon, badge }: { id: Tab; label: string; icon: string; badge?: number }) => (
    <button className={`ad-tab${tab === id ? " on" : ""}`} onClick={() => go(id)}>{icon} {label}{badge ? <span className="ad-badge">{badge}</span> : null}</button>
  );

  return (
    <div className="ad">
      {/* แถบบน */}
      <div className="ad-top"><div className="ad-top-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dk-logo.jpg" alt="DK" />
        <div>
          <div className="ad-top-name">DK Admin · ระบบสมาชิก</div>
          <div className="ad-top-sub">{savedUsername} <span className="ad-role">{role === "super" ? "Super Admin" : role === "staff" ? "Staff" : "Viewer"}</span></div>
        </div>
        <div className="ad-top-actions">
          {role === "super" && <a className="ad-tbtn" href="/admin/rewards">🎁 ของรางวัล</a>}
          <button className="ad-tbtn" onClick={() => exportCSV(users)}>⬇️ Export CSV</button>
          <button className="ad-tbtn" onClick={logout}>ออกจากระบบ</button>
        </div>
      </div></div>

      {/* แท็บ */}
      <div className="ad-tabs"><div className="ad-tabs-in">
        <TabBtn id="overview" label="ภาพรวม" icon="📊" />
        <TabBtn id="members" label="สมาชิก" icon="👥" badge={suggested.length || undefined} />
        {canEdit && <TabBtn id="redeem" label="คำขอแลกของ" icon="🎁" badge={pending || undefined} />}
        {canEdit && <TabBtn id="points" label="เพิ่ม/หักแต้ม" icon="⭐" />}
        <TabBtn id="history" label="ประวัติแต้ม" icon="📋" />
        {role === "super" && <TabBtn id="settings" label="ตั้งค่า" icon="⚙️" />}
      </div></div>

      <div className="ad-main">
        {error && <div className="ad-alert ad-alert--err" style={{ marginBottom: 12 }}>{error}</div>}
        {role === "viewer" && <div className="ad-alert ad-alert--warn" style={{ marginBottom: 12 }}>👁️ บัญชีนี้ดูข้อมูลได้อย่างเดียว ไม่สามารถเพิ่ม/หักแต้มหรือยืนยันการแลกของได้</div>}

        {/* ═══ ภาพรวม ═══ */}
        {tab === "overview" && (
          <>
            <div className="ad-stats">
              <div className="ad-stat"><i>👥</i><div><b>{users.length.toLocaleString()}</b><span>สมาชิกทั้งหมด</span></div></div>
              <div className="ad-stat"><i>⭐</i><div><b>{totalPoints.toLocaleString()}</b><span>แต้มคงเหลือรวม</span></div></div>
              <div className={`ad-stat${pending ? " hot" : ""}`}><i>🎁</i><div><b>{pending}</b><span>คำขอแลกของรอยืนยัน</span></div></div>
              <div className={`ad-stat${suggested.length ? " hot" : ""}`}><i>🔗</i><div><b>{suggested.length}</b><span>รอกดผูกรหัส Hero (เบอร์ตรง)</span></div></div>
              <div className="ad-stat"><i>❔</i><div><b>{unlinked.length}</b><span>ยังไม่ผูกรหัส Hero</span></div></div>
            </div>
            <div className="ad-grid ad-grid--2">
              <div className="ad-card">
                <div className="ad-card-h"><div><h3>🏅 สมาชิกแยกตามระดับ</h3><p>นับจากแต้มคงเหลือ · เกณฑ์ Bronze 100 · Silver 500 · Gold 2,000 · Platinum 5,000 · Diamond 10,000</p></div></div>
                <div className="ad-twrap"><table className="ad-table"><tbody>
                  {TIERS.map(t => (
                    <tr key={t.name}><td><span className="ad-chip ad-chip--tier" style={{ background: t.color }}>{t.emoji} {t.name}</span></td><td className="ad-note">{t.min > 0 ? `${t.min.toLocaleString()} แต้มขึ้นไป` : "เริ่มต้น"}</td><td className="r"><b>{tierCount(t.name).toLocaleString()}</b> คน</td></tr>
                  ))}
                </tbody></table></div>
              </div>
              <div className="ad-card">
                <div className="ad-card-h"><div><h3>⚡ งานที่ควรทำ</h3><p>สิ่งที่รอพนักงานอยู่ตอนนี้</p></div></div>
                <div className="ad-form">
                  {pending > 0 && <div className="ad-alert ad-alert--warn" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><span>🎁 คำขอแลกของรอยืนยัน <b>{pending}</b> รายการ</span>{canEdit && <button className="ad-btn ad-btn--warn ad-btn--sm" onClick={() => go("redeem")}>ไปยืนยัน</button>}</div>}
                  {suggested.length > 0 && <div className="ad-alert ad-alert--warn" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><span>🔗 บอทพบเบอร์ตรงกับลูกค้า Hero <b>{suggested.length}</b> คน — เช็คชื่อแล้วกดผูก</span>{canEdit && <button className="ad-btn ad-btn--warn ad-btn--sm" onClick={() => { setMemberFilter("suggested"); go("members"); }}>ไปดู</button>}</div>}
                  {unlinked.length - suggested.length > 0 && <div className="ad-alert ad-alert--info" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><span>❔ สมาชิกที่ยังไม่มีรหัส Hero <b>{unlinked.length - suggested.length}</b> คน — ยังไม่ได้แต้มจากบิล</span><button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => { setMemberFilter("unlinked"); go("members"); }}>ไปดู</button></div>}
                  {pending === 0 && suggested.length === 0 && unlinked.length === 0 && <div className="ad-empty"><i>✅</i>ไม่มีงานค้าง</div>}
                  <div className="ad-note" style={{ marginTop: 6 }}>
                    <b>วิธีให้แต้มอัตโนมัติ:</b> ลูกค้าสมัครใน LINE → ผูกรหัส Hero ที่แท็บ "สมาชิก" → บิลขายสด/โอนของรหัสนั้นจะกลายเป็นแต้มเองภายใน 1–2 นาที (บิลเชื่อ K1/K2 และลูกค้าเครดิตไม่นับ)
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══ สมาชิก ═══ */}
        {tab === "members" && (
          <div className="ad-card">
            <div className="ad-card-h">
              <div><h3>👥 สมาชิก <span className="ad-chip ad-chip--muted">{shown.length.toLocaleString()} คน</span></h3><p>คลิกช่องรหัส Hero เพื่อผูก/แก้ · ✏️ เปลี่ยนเบอร์ · 🔓 ปลด LINE เดิมเมื่อลูกค้าเปลี่ยนเครื่อง</p></div>
              <div className="ad-h-actions"><button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => fetchUsers(savedPw, search)} disabled={loading}>{loading ? "กำลังโหลด…" : "🔄 รีเฟรช"}</button></div>
            </div>
            <div className="ad-toolbar">
              <input className="ad-input" type="text" placeholder="ค้นหา ชื่อ / เบอร์ / บริษัท / รหัส Hero…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchUsers(savedPw, search)} />
              <button className="ad-btn ad-btn--primary" onClick={() => fetchUsers(savedPw, search)}>ค้นหา</button>
              {search && <button className="ad-btn ad-btn--ghost" onClick={() => { setSearch(""); fetchUsers(savedPw, ""); }}>ล้าง</button>}
              <div className="ad-filters" style={{ marginLeft: "auto" }}>
                {([["all", "ทั้งหมด"], ["suggested", `รอกดผูก ${suggested.length}`], ["unlinked", `ยังไม่ผูก ${unlinked.length}`], ["noline", `ไม่มี LINE ${noLine.length}`]] as const).map(([k, l]) => (
                  <button key={k} className={`ad-filter${memberFilter === k ? " on" : ""}`} onClick={() => setMemberFilter(k)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="ad-twrap"><table className="ad-table">
              <thead><tr><th>#</th><th>สมาชิก</th><th>เบอร์ / LINE</th><th>รหัส Hero</th><th>ระดับ</th><th className="r">แต้ม</th><th>วันเกิด</th><th>สมัครเมื่อ</th></tr></thead>
              <tbody>
                {shown.length === 0 && <tr><td colSpan={8}><div className="ad-empty"><i>🔍</i>{users.length === 0 ? "ยังไม่มีสมาชิก — รอลูกค้าสมัครผ่าน LINE" : "ไม่พบข้อมูลตามตัวกรอง"}</div></td></tr>}
                {shown.map((u, i) => {
                  const t = tierOf(u.points);
                  const isEditing = editingId === u.id;
                  return (
                    <tr key={u.id}>
                      <td className="ad-note">{i + 1}</td>
                      <td><span className="ad-av">{initials(u)}</span><span className="ad-name" style={{ display: "inline-block", verticalAlign: "middle" }}><b>{u.first_name ? `${u.first_name} ${u.last_name ?? ""}` : "-"}</b>{u.company && <span>🏢 {u.company}</span>}</span></td>
                      <td>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtPhone(u.phone)}</span>
                        {canEdit && <button className="ad-icon" onClick={() => changePhone(u)} title="เปลี่ยนเบอร์">✏️</button>}
                        <div style={{ marginTop: 4 }}>
                          {u.line_user_id
                            ? <span className="ad-chip ad-chip--ok">LINE ✓{canEdit && <button className="ad-icon" style={{ marginLeft: 6 }} onClick={() => resetLine(u)} title="ปลด LINE เดิม (ลูกค้าเปลี่ยนเครื่อง/LINE หาย)">🔓</button>}</span>
                            : <span className="ad-chip ad-chip--danger" title="รอลูกค้าสมัครด้วยเบอร์นี้">ไม่มี LINE</span>}
                        </div>
                      </td>
                      <td>
                        {isEditing ? (
                          <input className="ad-code-in" autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={() => saveCustomerId(u.id, editValue)}
                            onKeyDown={e => { if (e.key === "Enter") saveCustomerId(u.id, editValue); if (e.key === "Escape") setEditingId(null); }} placeholder="CUS-xxxxx" />
                        ) : (
                          <span className={`ad-code${u.customer_id ? "" : " empty"}`} title={canEdit ? "คลิกเพื่อแก้ไข" : ""} onClick={() => { if (!canEdit) return; setEditingId(u.id); setEditValue(u.customer_id ?? u.suggested_customer_id ?? ""); }}>{u.customer_id ?? "ยังไม่ผูก"}</span>
                        )}
                        {!u.customer_id && u.suggested_customer_id && !isEditing && canEdit && (
                          // บอทเจอลูกค้า Hero ที่เบอร์ตรงกัน — ให้พนักงานเช็คชื่อแล้วกดยืนยัน (ไม่ผูกอัตโนมัติ กันคนสมัครด้วยเบอร์คนอื่น)
                          <button className="ad-suggest" onClick={() => saveCustomerId(u.id, u.suggested_customer_id!)} title="บอทพบลูกค้า Hero ที่เบอร์โทรตรงกัน — ตรวจชื่อก่อนกด">🔗 เบอร์ตรง {u.suggested_customer_id} · กดผูก</button>
                        )}
                      </td>
                      <td><span className="ad-chip ad-chip--tier" style={{ background: t.color }}>{t.emoji} {t.name}</span></td>
                      <td className="r"><b>{u.points.toLocaleString()}</b></td>
                      <td className="ad-note">{formatBirthday(u.birthday)}</td>
                      <td className="ad-note">{formatDate(u.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        )}

        {/* ═══ คำขอแลกของรางวัล ═══ */}
        {tab === "redeem" && canEdit && (
          <div className="ad-card">
            <div className="ad-card-h">
              <div><h3>🎁 คำขอแลกของรางวัล {pending > 0 && <span className="ad-badge">{pending} รอยืนยัน</span>}</h3><p>ลูกค้ากดแลกใน LINE → มารับที่ร้าน → ตรวจบัตรสมาชิกแล้วกดยืนยัน ระบบหักแต้มให้</p></div>
              <div className="ad-h-actions"><button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => fetchRedemptions()} disabled={redeemLoading}>{redeemLoading ? "กำลังโหลด…" : "🔄 รีเฟรช"}</button></div>
            </div>
            {redeemError && <div className="ad-alert ad-alert--err" style={{ marginBottom: 10 }}>{redeemError}</div>}
            {redeemRows.length === 0 ? <div className="ad-empty"><i>🎁</i>ยังไม่มีคำขอ</div> : (
              <div className="ad-twrap"><table className="ad-table">
                <thead><tr><th>#REQ</th><th>สถานะ</th><th>ขอเมื่อ</th><th>ลูกค้า</th><th>เบอร์</th><th>ของรางวัล</th><th className="r">แต้ม</th><th></th></tr></thead>
                <tbody>
                  {[...redeemRows].sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1)).map(r => {
                    const name = r.first_name ? `${r.first_name} ${r.last_name}` : (r.display_name ?? "-");
                    const isPending = r.status === "pending", isConfirmed = r.status === "confirmed";
                    const busy = redeemAction[r.id];
                    return (
                      <tr key={r.id}>
                        <td><b style={{ color: "var(--ad-blue)" }}>#{r.id}</b></td>
                        <td><span className={`ad-chip ${isPending ? "ad-chip--warn" : isConfirmed ? "ad-chip--ok" : "ad-chip--danger"}`}>{isPending ? "⏳ รอยืนยัน" : isConfirmed ? "✅ ยืนยันแล้ว" : "❌ ยกเลิก"}</span></td>
                        <td className="ad-note">{formatDateTime(r.created_at)}</td>
                        <td><b>{name}</b></td>
                        <td>{fmtPhone(r.phone)}</td>
                        <td><b>{r.reward_name}</b></td>
                        <td className="r" style={{ color: "var(--ad-orange)", fontWeight: 800 }}>{r.points_required.toLocaleString()}</td>
                        <td>
                          {isPending ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="ad-btn ad-btn--ok ad-btn--sm" onClick={() => handleRedeemAction(r.id, "confirm")} disabled={busy}>{busy ? "…" : "✅ ยืนยัน"}</button>
                              <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => handleRedeemAction(r.id, "cancel")} disabled={busy}>{busy ? "…" : "ยกเลิก"}</button>
                            </div>
                          ) : <span className="ad-note">{isConfirmed && r.confirmed_at ? formatDate(r.confirmed_at) : "-"}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>
        )}

        {/* ═══ เพิ่ม / หักแต้ม ═══ */}
        {tab === "points" && canEdit && (
          <>
            <div className="ad-alert ad-alert--info" style={{ marginBottom: 14 }}>💡 ปกติแต้มเข้าอัตโนมัติจากบิล Hero — ใช้หน้านี้เฉพาะกรณีพิเศษ (บิลก่อนผูกรหัส, แก้ผิด, คืนสินค้า)</div>
            <div className="ad-grid ad-grid--2">
              <div className="ad-card">
                <div className="ad-card-h"><div><h3>⭐ เพิ่มแต้ม</h3><p>ทุก 100 บาท = 1 แต้ม (ปัดเศษทิ้ง)</p></div></div>
                <div className="ad-form">
                  <div className="ad-row">
                    <div className="ad-field" style={{ flex: 1 }}><label>เบอร์มือถือลูกค้า</label><input className="ad-input ad-input--num" type="tel" inputMode="numeric" maxLength={10} placeholder="08XXXXXXXX" value={apPhone} onChange={e => { setApPhone(e.target.value.replace(/\D/g, "")); setApResult(null); setApError(""); }} /></div>
                    <div className="ad-field" style={{ flex: 1 }}><label>ยอดซื้อ (บาท)</label><input className="ad-input ad-input--num" type="number" min={100} step={100} placeholder="1500" value={apAmount} onChange={e => { setApAmount(e.target.value); setApResult(null); setApError(""); }} onKeyDown={e => e.key === "Enter" && handleAddPoints()} /></div>
                  </div>
                  <div className="ad-field"><label>หมายเหตุ (ถ้ามี)</label><input className="ad-input" type="text" placeholder="เช่น บิล IV-690914-0012 ก่อนผูกรหัส" value={apNote} onChange={e => setApNote(e.target.value)} /></div>
                  <div className="ad-row">
                    <button className="ad-btn ad-btn--primary" onClick={handleAddPoints} disabled={apLoading}>{apLoading ? "กำลังเพิ่ม…" : "➕ เพิ่มแต้ม"}</button>
                    {apAmount && parseInt(apAmount) >= 100 && <div className="ad-calc">= <b style={{ color: "var(--ad-blue)" }}>{Math.floor(parseInt(apAmount) / 100)}</b> แต้ม</div>}
                  </div>
                  {apError && <div className="ad-alert ad-alert--err">{apError}</div>}
                  {apResult && <div className="ad-alert ad-alert--ok">✅ <b>{apResult.name}</b> ได้รับ <b>{apResult.pointsEarned} แต้ม</b> · แต้มรวม {apResult.totalPoints.toLocaleString()}</div>}
                </div>
              </div>
              <div className="ad-card">
                <div className="ad-card-h"><div><h3>↩️ หักแต้ม (คืนสินค้า)</h3><p>หักตามยอดเงินที่คืน ทุก 100 บาท = 1 แต้ม</p></div></div>
                <div className="ad-form">
                  <div className="ad-row">
                    <div className="ad-field" style={{ flex: 1 }}><label>เบอร์มือถือลูกค้า</label><input className="ad-input ad-input--num" type="tel" inputMode="numeric" maxLength={10} placeholder="08XXXXXXXX" value={dpPhone} onChange={e => { setDpPhone(e.target.value.replace(/\D/g, "")); setDpResult(null); setDpError(""); }} /></div>
                    <div className="ad-field" style={{ flex: 1 }}><label>ยอดเงินที่คืน (บาท)</label><input className="ad-input ad-input--num" type="number" min={100} step={100} placeholder="1500" value={dpAmount} onChange={e => { setDpAmount(e.target.value); setDpResult(null); setDpError(""); }} onKeyDown={e => e.key === "Enter" && handleDeductPoints()} /></div>
                  </div>
                  <div className="ad-field"><label>หมายเหตุ (ถ้ามี)</label><input className="ad-input" type="text" placeholder="เช่น คืนปูน 5 ถุง" value={dpNote} onChange={e => setDpNote(e.target.value)} /></div>
                  <div className="ad-row">
                    <button className="ad-btn ad-btn--danger" onClick={handleDeductPoints} disabled={dpLoading}>{dpLoading ? "กำลังบันทึก…" : "↩️ หักแต้ม"}</button>
                    {dpAmount && parseInt(dpAmount) >= 100 && <div className="ad-calc">= หัก <b style={{ color: "var(--ad-danger)" }}>{Math.floor(parseInt(dpAmount) / 100)}</b> แต้ม</div>}
                  </div>
                  {dpError && <div className="ad-alert ad-alert--err">{dpError}</div>}
                  {dpResult && <div className="ad-alert ad-alert--warn">✅ <b>{dpResult.name}</b> ถูกหัก <b>{dpResult.pointsDeducted} แต้ม</b> · คงเหลือ {dpResult.totalPoints.toLocaleString()}</div>}
                </div>
              </div>
            </div>

            <div className="ad-card" style={{ marginTop: 14 }}>
              <div className="ad-card-h">
                <div><h3>📂 เพิ่มแต้มหลายรายจากไฟล์</h3><p>Excel (.xlsx) หรือ CSV · 2 คอลัมน์: เบอร์มือถือ, ยอดซื้อ (บาท)</p></div>
                <div className="ad-h-actions"><button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={downloadTemplate}>⬇️ ดาวน์โหลด Template</button></div>
              </div>
              <label className="ad-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f); }}>
                <i>📄</i><b>คลิกเลือกไฟล์ หรือลากมาวางที่นี่</b><span>ระบบจะแสดงรายการให้ตรวจก่อน แล้วค่อยกดยืนยัน</span>
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
                          {csvDone && <td>{r.status === "success" ? <span className="ad-chip ad-chip--ok">✅ +{r.pointsEarned} แต้ม (รวม {r.totalPoints?.toLocaleString()})</span> : <span className="ad-chip ad-chip--danger">❌ {r.message}</span>}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                  <div className="ad-row" style={{ marginTop: 12 }}>
                    {!csvDone ? (
                      <>
                        <button className="ad-btn ad-btn--primary" onClick={handleBulkAddPoints} disabled={csvLoading}>{csvLoading ? "กำลังเพิ่มแต้ม…" : `➕ ยืนยันเพิ่มแต้ม ${csvRows.length} รายการ`}</button>
                        <button className="ad-btn ad-btn--ghost" onClick={() => { setCsvRows([]); setCsvDone(false); setCsvError(""); }}>ยกเลิก</button>
                      </>
                    ) : (
                      <>
                        <div className="ad-alert ad-alert--ok">✅ สำเร็จ {csvRows.filter(r => r.status === "success").length} / {csvRows.length} รายการ</div>
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
              <div><h3>📋 ประวัติแต้ม</h3><p>รายการได้รับ/ใช้แต้มของสมาชิกทุกคน (ล่าสุดก่อน)</p></div>
              <div className="ad-h-actions">
                {txRows.length > 0 && <button className="ad-btn ad-btn--ok ad-btn--sm" onClick={exportTxExcel}>⬇️ Export Excel</button>}
                <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => fetchTransactions()} disabled={txLoading}>{txLoading ? "กำลังโหลด…" : "🔄 รีเฟรช"}</button>
              </div>
            </div>
            <div className="ad-toolbar">
              <input className="ad-input" type="text" placeholder="ค้นหาชื่อ / เบอร์…" value={txSearch} onChange={e => setTxSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchTransactions()} style={{ maxWidth: 260 }} />
              <div className="ad-field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><label>ตั้งแต่</label><input className="ad-input" type="date" value={txFrom} onChange={e => setTxFrom(e.target.value)} style={{ width: 160 }} /></div>
              <div className="ad-field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><label>ถึง</label><input className="ad-input" type="date" value={txTo} onChange={e => setTxTo(e.target.value)} style={{ width: 160 }} /></div>
              <button className="ad-btn ad-btn--primary" onClick={() => fetchTransactions()}>ค้นหา</button>
              {(txSearch || txFrom || txTo) && <button className="ad-btn ad-btn--ghost" onClick={() => { setTxSearch(""); setTxFrom(""); setTxTo(""); fetchTransactions("", "", ""); }}>ล้าง</button>}
            </div>
            {txRows.length === 0 ? <div className="ad-empty"><i>📋</i>{txLoading ? "กำลังโหลด…" : "ยังไม่มีรายการ"}</div> : (
              <div className="ad-twrap"><table className="ad-table">
                <thead><tr><th>#</th><th>ประเภท</th><th>วันเวลา</th><th>ลูกค้า</th><th>เบอร์</th><th className="r">ยอดซื้อ (บาท)</th><th className="r">แต้ม</th><th>หมายเหตุ</th></tr></thead>
                <tbody>
                  {txRows.map((t, i) => {
                    const name = t.first_name ? `${t.first_name} ${t.last_name}` : (t.display_name ?? "-");
                    const isRedeem = t.type === "redeem";
                    return (
                      <tr key={t.id}>
                        <td className="ad-note">{i + 1}</td>
                        <td><span className={`ad-chip ${isRedeem ? "ad-chip--warn" : "ad-chip--blue"}`}>{isRedeem ? "🎁 แลกรางวัล" : "⭐ ได้รับแต้ม"}</span></td>
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
                <div><h3>👥 บัญชีพนักงาน (Admin)</h3><p>Staff = ผูกรหัส/เพิ่มแต้ม/ยืนยันแลกของ · Viewer = ดูอย่างเดียว</p></div>
                <div className="ad-h-actions"><button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={fetchAdminUsers} disabled={adminUsersLoading}>{adminUsersLoading ? "…" : "🔄 รีเฟรช"}</button></div>
              </div>
              <div className="ad-row" style={{ marginBottom: 12 }}>
                <div className="ad-field"><label>ชื่อผู้ใช้</label><input className="ad-input" type="text" placeholder="เช่น cashier1" value={newAdminUsername} onChange={e => setNewAdminUsername(e.target.value)} style={{ width: 170 }} /></div>
                <div className="ad-field"><label>รหัสผ่าน</label><input className="ad-input" type="text" placeholder="รหัสผ่าน" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} style={{ width: 170 }} /></div>
                <div className="ad-field"><label>สิทธิ์</label><select className="ad-input" value={newAdminRole} onChange={e => setNewAdminRole(e.target.value)} style={{ width: 200 }}><option value="staff">Staff (ผูกรหัส/แต้ม/แลกของ)</option><option value="viewer">Viewer (ดูอย่างเดียว)</option></select></div>
                <button className="ad-btn ad-btn--primary" onClick={handleCreateAdmin}>➕ เพิ่มบัญชี</button>
              </div>
              {newAdminError && <div className="ad-alert ad-alert--err" style={{ marginBottom: 10 }}>{newAdminError}</div>}
              {newAdminSuccess && <div className="ad-alert ad-alert--ok" style={{ marginBottom: 10 }}>✅ {newAdminSuccess}</div>}
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
              <div className="ad-card-h"><div><h3>🗑️ เคลียร์ประวัติแต้มสมาชิก</h3><p>รีเซ็ตแต้มเป็น 0 และซ่อนประวัติทั้งหมดของเบอร์นี้ (ย้อนกลับไม่ได้ · บันทึก audit log)</p></div></div>
              <div className="ad-row">
                <div className="ad-field"><label>เบอร์มือถือลูกค้า</label><input className="ad-input ad-input--num" type="tel" inputMode="numeric" maxLength={10} placeholder="08XXXXXXXX" value={clrPhone} onChange={e => { setClrPhone(e.target.value.replace(/\D/g, "")); setClrResult(null); setClrError(""); }} style={{ width: 180 }} /></div>
                <div className="ad-field"><label>รหัสผ่าน Admin (ยืนยัน)</label><input className="ad-input" type="password" value={clrPw} onChange={e => { setClrPw(e.target.value); setClrResult(null); setClrError(""); }} style={{ width: 180 }} /></div>
                <button className="ad-btn ad-btn--danger" onClick={handleClearPoints} disabled={clrLoading}>{clrLoading ? "กำลังดำเนินการ…" : "🗑️ เคลียร์ประวัติ"}</button>
              </div>
              {clrError && <div className="ad-alert ad-alert--err" style={{ marginTop: 10 }}>{clrError}</div>}
              {clrResult && <div className="ad-alert ad-alert--warn" style={{ marginTop: 10 }}>✅ เคลียร์ประวัติของ <b>{clrResult.name}</b> แล้ว · แต้มที่ถูกซ่อน {clrResult.clearedPoints.toLocaleString()}</div>}
            </div>

            <div className="ad-card">
              <div className="ad-card-h">
                <div><h3>🔍 Audit log</h3><p>บันทึกทุกการกระทำของแอดมิน/บอท · ใส่เบอร์เพื่อดูประวัติที่ถูกลบของลูกค้าคนนั้น</p></div>
                <div className="ad-h-actions"><button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => { setAuditOpen(true); fetchAuditLog(""); }} disabled={auditLoading}>{auditLoading ? "…" : auditOpen ? "🔄 รีเฟรช" : "โหลด log"}</button></div>
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
                            <tr key={t.id}><td className="ad-note">{i + 1}</td><td><span className={`ad-chip ${isRedeem ? "ad-chip--warn" : "ad-chip--blue"}`}>{isRedeem ? "🎁 แลกรางวัล" : "⭐ ได้รับแต้ม"}</span></td><td className="ad-note">{formatDateTime(t.created_at)}</td><td className="r"><b style={{ color: isRedeem ? "var(--ad-danger)" : "var(--ad-ok)" }}>{isRedeem ? "−" : "+"}{t.points_earned}</b></td><td className="r">{isRedeem ? "-" : Number(t.purchase_amount).toLocaleString()}</td><td className="ad-note">{t.note ?? "-"}</td></tr>
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
    </div>
  );
}
