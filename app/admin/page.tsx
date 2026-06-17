"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import * as XLSX from "xlsx";

interface User {
  id: number;
  customer_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  company: string | null;
  birthday: string | null;
  points: number;
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatBirthday(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
  });
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
  const [password, setPassword]   = useState("");
  const [authed, setAuthed]       = useState(false);
  const [users, setUsers]         = useState<User[]>([]);
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [savedPw, setSavedPw]     = useState("");

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
        headers: { "Content-Type": "application/json", "x-admin-password": savedPw },
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
        headers: { "x-admin-password": savedPw },
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

  async function handleAddPoints() {
    if (!/^0\d{9}$/.test(apPhone)) { setApError("เบอร์ไม่ถูกต้อง (10 หลัก)"); return; }
    const amt = parseInt(apAmount);
    if (!amt || amt < 100) { setApError("ยอดซื้อต้องไม่ต่ำกว่า 100 บาท"); return; }
    setApLoading(true); setApError(""); setApResult(null);
    try {
      const res  = await fetch("/api/admin/add-points", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": savedPw },
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
        headers: { "Content-Type": "application/json", "x-admin-password": savedPw },
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
          // CSV
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
        headers: { "Content-Type": "application/json", "x-admin-password": savedPw },
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

  const fetchUsers = useCallback(async (pw: string, q = "") => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/admin/members?search=${encodeURIComponent(q)}`, {
        headers: { "x-admin-password": pw },
      });
      if (res.status === 401) { setError("รหัสผ่านไม่ถูกต้อง"); setAuthed(false); setLoading(false); return; }
      if (!res.ok) { setError(`เกิดข้อผิดพลาด (${res.status}) — กรุณา Redeploy Vercel`); setLoading(false); return; }
      const data = await res.json();
      setUsers(data.users ?? []);
      setAuthed(true);
      setSavedPw(pw);
      sessionStorage.setItem("admin_pw", pw);
    } catch { setError("เชื่อมต่อ API ไม่ได้ — กรุณาตรวจสอบ Vercel deployment"); }
    finally { setLoading(false); }
  }, []);

  async function saveCustomerId(userId: number, value: string) {
    setEditingId(null);
    await fetch("/api/admin/update-member", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": savedPw },
      body: JSON.stringify({ id: userId, customer_id: value.trim() || null }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, customer_id: value.trim() || null } : u));
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
        headers: { "Content-Type": "application/json", "x-admin-password": clrPw },
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
        headers: { "x-admin-password": savedPw },
      });
      const data = await res.json();
      setTxRows(data.transactions ?? []);
    } catch { /* silent */ }
    finally { setTxLoading(false); }
  }

  /* ── Login ── */
  if (!authed) return (
    <div style={s.page}>
      <div style={s.loginCard}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Admin Panel</div>
        <div style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>ร้าน DK วัสดุก่อสร้าง</div>
        <input
          type="password"
          placeholder="รหัสผ่าน"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchUsers(password)}
          style={s.input}
          autoFocus
        />
        {error && <div style={{ color: "#e53935", fontSize: 13, margin: "8px 0" }}>{error}</div>}
        <button
          onClick={() => fetchUsers(password)}
          disabled={loading}
          style={s.btn}
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </div>
    </div>
  );

  /* ── Dashboard ── */
  const totalPoints = users.reduce((s, u) => s + u.points, 0);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>🏗️ DK Admin Panel</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>ข้อมูลสมาชิกทั้งหมด</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="/admin/rewards"
            style={{ padding: "9px 18px", background: "white", color: "#1565C0", borderRadius: 10, fontSize: 14, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
            🎁 ของรางวัล
          </a>
          <button onClick={() => exportCSV(users)} style={s.exportBtn}>
            ⬇️ Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statNum}>{users.length.toLocaleString()}</div>
          <div style={s.statLabel}>สมาชิกทั้งหมด</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statNum}>{totalPoints.toLocaleString()}</div>
          <div style={s.statLabel}>แต้มรวม</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statNum}>{users.filter(u => u.points >= 10000).length}</div>
          <div style={s.statLabel}>💎 Diamond (10,000+)</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statNum}>{users.filter(u => u.points >= 4000 && u.points < 10000).length}</div>
          <div style={s.statLabel}>🔱 Platinum (4,000+)</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statNum}>{users.filter(u => u.points >= 1000 && u.points < 4000).length}</div>
          <div style={s.statLabel}>🥇 Gold (1,000+)</div>
        </div>
      </div>

      {/* เพิ่มแต้ม */}
      <div style={{ width: "100%", maxWidth: 1100, background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", padding: "24px", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>⭐ เพิ่มแต้มให้ลูกค้า</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>เบอร์มือถือลูกค้า</div>
            <input
              type="tel" inputMode="numeric" maxLength={10}
              placeholder="0812345678"
              value={apPhone}
              onChange={e => { setApPhone(e.target.value.replace(/\D/g, "")); setApResult(null); setApError(""); }}
              style={{ ...s.input, width: 180, marginBottom: 0 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>ยอดซื้อ (บาท)</div>
            <input
              type="number" min={100} step={100}
              placeholder="1500"
              value={apAmount}
              onChange={e => { setApAmount(e.target.value); setApResult(null); setApError(""); }}
              onKeyDown={e => e.key === "Enter" && handleAddPoints()}
              style={{ ...s.input, width: 160, marginBottom: 0 }}
            />
          </div>
          {apAmount && parseInt(apAmount) >= 100 && (
            <div style={{ fontSize: 13, color: "#888", paddingBottom: 10 }}>
              = <strong style={{ color: "#1976D2", fontSize: 16 }}>{Math.floor(parseInt(apAmount) / 100)}</strong> แต้ม
            </div>
          )}
          <button onClick={handleAddPoints} disabled={apLoading} style={{ ...s.btn, paddingBottom: 12, paddingTop: 12 }}>
            {apLoading ? "กำลังเพิ่ม..." : "➕ เพิ่มแต้ม"}
          </button>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>หมายเหตุ (ถ้ามี)</div>
          <input type="text" placeholder="เช่น ซื้อปูน 10 ถุง" value={apNote}
            onChange={e => setApNote(e.target.value)}
            style={{ ...s.input, maxWidth: 400, marginBottom: 0 }} />
        </div>
        {apError && <div style={{ color: "#e53935", fontSize: 13, marginTop: 10 }}>❌ {apError}</div>}
        {apResult && (
          <div style={{ marginTop: 12, padding: "12px 16px", background: "#E8F5E9", borderRadius: 10, fontSize: 14, color: "#2e7d32" }}>
            ✅ เพิ่มแต้มสำเร็จ! <strong>{apResult.name}</strong> ได้รับ <strong>{apResult.pointsEarned} แต้ม</strong> — แต้มรวม: <strong>{apResult.totalPoints.toLocaleString()} แต้ม</strong>
          </div>
        )}
      </div>

      {/* หักแต้ม (คืนสินค้า) */}
      <div style={{ width: "100%", maxWidth: 1100, background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", padding: "24px", marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>↩️ หักแต้ม (กรณีลูกค้าคืนสินค้า)</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>เบอร์มือถือลูกค้า</div>
            <input type="tel" inputMode="numeric" maxLength={10} placeholder="0812345678"
              value={dpPhone}
              onChange={e => { setDpPhone(e.target.value.replace(/\D/g, "")); setDpResult(null); setDpError(""); }}
              style={{ ...s.input, width: 180, marginBottom: 0 }} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>ยอดเงินที่คืน (บาท)</div>
            <input type="number" min={100} step={100} placeholder="1500"
              value={dpAmount}
              onChange={e => { setDpAmount(e.target.value); setDpResult(null); setDpError(""); }}
              onKeyDown={e => e.key === "Enter" && handleDeductPoints()}
              style={{ ...s.input, width: 160, marginBottom: 0 }} />
          </div>
          {dpAmount && parseInt(dpAmount) >= 100 && (
            <div style={{ fontSize: 13, color: "#888", paddingBottom: 10 }}>
              = หัก <strong style={{ color: "#e53935", fontSize: 16 }}>{Math.floor(parseInt(dpAmount) / 100)}</strong> แต้ม
            </div>
          )}
          <button onClick={handleDeductPoints} disabled={dpLoading}
            style={{ ...s.btn, background: "#e53935", paddingBottom: 12, paddingTop: 12 }}>
            {dpLoading ? "กำลังบันทึก..." : "↩️ หักแต้ม"}
          </button>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>หมายเหตุ (ถ้ามี)</div>
          <input type="text" placeholder="เช่น คืนปูน 5 ถุง" value={dpNote}
            onChange={e => setDpNote(e.target.value)}
            style={{ ...s.input, maxWidth: 400, marginBottom: 0 }} />
        </div>
        {dpError && <div style={{ color: "#e53935", fontSize: 13, marginTop: 10 }}>❌ {dpError}</div>}
        {dpResult && (
          <div style={{ marginTop: 12, padding: "12px 16px", background: "#FFF3E0", borderRadius: 10, fontSize: 14, color: "#e65100" }}>
            ✅ หักแต้มสำเร็จ! <strong>{dpResult.name}</strong> ถูกหัก <strong>{dpResult.pointsDeducted} แต้ม</strong> — แต้มคงเหลือ: <strong>{dpResult.totalPoints.toLocaleString()} แต้ม</strong>
          </div>
        )}
      </div>

      {/* ── คำขอแลกของรางวัล (ลูกค้าส่งมาเอง) ── */}
      <div style={{ width: "100%", maxWidth: 1100, background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", padding: "24px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            📬 คำขอแลกของรางวัล
            {redeemRows.filter(r => r.status === "pending").length > 0 && (
              <span style={{ marginLeft: 8, background: "#e53935", color: "white", borderRadius: 20, padding: "2px 10px", fontSize: 13, fontWeight: 800 }}>
                {redeemRows.filter(r => r.status === "pending").length} รายการใหม่
              </span>
            )}
          </div>
          <button onClick={() => fetchRedemptions()} disabled={redeemLoading}
            style={{ ...s.btn, fontSize: 13, padding: "8px 16px" }}>
            {redeemLoading ? "กำลังโหลด..." : "🔄 รีเฟรช"}
          </button>
        </div>

        {redeemError && <div style={{ color: "#e53935", fontSize: 13, marginBottom: 10 }}>❌ {redeemError}</div>}

        {redeemRows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#aaa", fontSize: 14 }}>ไม่มีคำขอ</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr style={{ background: "#f5f7fa" }}>
                  {["#REQ", "สถานะ", "วันที่ร้องขอ", "ชื่อลูกค้า", "เบอร์", "ของรางวัล", "แต้ม", "การดำเนินการ"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {redeemRows.map((r, i) => {
                  const name    = r.first_name ? `${r.first_name} ${r.last_name}` : (r.display_name ?? "-");
                  const dt      = new Date(r.created_at);
                  const dateStr = dt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) + " " + dt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
                  const isPending   = r.status === "pending";
                  const isConfirmed = r.status === "confirmed";
                  const statusBg    = isPending ? "#FFF8E1" : isConfirmed ? "#E8F5E9" : "#FFEBEE";
                  const statusColor = isPending ? "#E65100" : isConfirmed ? "#2e7d32" : "#b71c1c";
                  const statusLabel = isPending ? "⏳ รอยืนยัน" : isConfirmed ? "✅ ยืนยันแล้ว" : "❌ ยกเลิก";
                  const busy        = redeemAction[r.id];
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                      <td style={{ ...s.td, fontWeight: 700, color: "#1565C0" }}>#{r.id}</td>
                      <td style={s.td}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: statusBg, color: statusColor }}>
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontSize: 12, color: "#888" }}>{dateStr}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{name}</td>
                      <td style={s.td}>{r.phone}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{r.reward_name}</td>
                      <td style={{ ...s.td, fontWeight: 700, textAlign: "right", color: "#e65100" }}>{r.points_required.toLocaleString()}</td>
                      <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                        {isPending ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => handleRedeemAction(r.id, "confirm")}
                              disabled={busy}
                              style={{ padding: "6px 14px", background: "#2e7d32", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Leelawadee UI, Tahoma, sans-serif" }}>
                              {busy ? "..." : "✅ ยืนยัน"}
                            </button>
                            <button
                              onClick={() => handleRedeemAction(r.id, "cancel")}
                              disabled={busy}
                              style={{ padding: "6px 14px", background: "#e53935", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Leelawadee UI, Tahoma, sans-serif" }}>
                              {busy ? "..." : "❌ ยกเลิก"}
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#aaa" }}>
                            {isConfirmed && r.confirmed_at ? new Date(r.confirmed_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* เพิ่มแต้มแบบ CSV */}
      <div style={{ width: "100%", maxWidth: 1100, background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", padding: "24px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>📂 เพิ่มแต้มหลายรายจาก CSV</div>
          <button onClick={downloadTemplate} style={{ ...s.btn, background: "#f5f5f5", color: "#555", fontSize: 13, padding: "8px 14px" }}>
            ⬇️ ดาวน์โหลด Template CSV
          </button>
        </div>

        <label
          style={{ border: "2px dashed #ccc", borderRadius: 12, padding: "28px", textAlign: "center", cursor: "pointer", background: "#fafafa", display: "block" }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f); }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: 14, color: "#666" }}>คลิกหรือลากไฟล์มาวางที่นี่</div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>รองรับ Excel (.xlsx) และ CSV · คอลัมน์: เบอร์มือถือ, ยอดซื้อ (บาท)</div>
          <input ref={csvInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); e.target.value = ""; }} />
        </label>

        {csvError && <div style={{ color: "#e53935", fontSize: 13, marginTop: 10 }}>❌ {csvError}</div>}

        {csvRows.length > 0 && (
          <>
            <div style={{ marginTop: 16, overflowX: "auto" }}>
              <table style={{ ...s.table, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f5f7fa" }}>
                    {["#", "เบอร์มือถือ", "ยอดซื้อ (บาท)", "แต้มที่จะได้", ...(csvDone ? ["ชื่อลูกค้า", "ผลลัพธ์"] : [])].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={s.td}>{i + 1}</td>
                      <td style={s.td}>{r.phone}</td>
                      <td style={s.td}>{r.amount.toLocaleString()}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: "#1976D2" }}>{Math.floor(r.amount / 100)}</td>
                      {csvDone && <td style={s.td}>{r.name ?? "-"}</td>}
                      {csvDone && (
                        <td style={{ ...s.td, color: r.status === "success" ? "#2e7d32" : "#e53935", fontWeight: 600 }}>
                          {r.status === "success" ? `✅ +${r.pointsEarned} แต้ม (รวม ${r.totalPoints?.toLocaleString()})` : `❌ ${r.message}`}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!csvDone && (
              <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={handleBulkAddPoints} disabled={csvLoading} style={s.btn}>
                  {csvLoading ? "กำลังเพิ่มแต้ม..." : `➕ ยืนยันเพิ่มแต้ม ${csvRows.length} รายการ`}
                </button>
                <button onClick={() => { setCsvRows([]); setCsvDone(false); setCsvError(""); }}
                  style={{ ...s.btn, background: "#eee", color: "#555" }}>
                  ยกเลิก
                </button>
              </div>
            )}
            {csvDone && (
              <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ fontSize: 14, color: "#2e7d32", fontWeight: 600 }}>
                  ✅ สำเร็จ {csvRows.filter(r => r.status === "success").length} / {csvRows.length} รายการ
                </div>
                <button onClick={() => { setCsvRows([]); setCsvDone(false); }}
                  style={{ ...s.btn, background: "#eee", color: "#555", fontSize: 13, padding: "8px 14px" }}>
                  อัพโหลดไฟล์ใหม่
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Search */}
      <div style={{ width: "100%", maxWidth: 1100, marginBottom: 16, display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="ค้นหา ชื่อ / นามสกุล / เบอร์ / บริษัท..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchUsers(savedPw, search)}
          style={{ ...s.input, flex: 1, marginBottom: 0 }}
        />
        <button onClick={() => fetchUsers(savedPw, search)} style={s.btn}>
          🔍 ค้นหา
        </button>
        {search && (
          <button onClick={() => { setSearch(""); fetchUsers(savedPw, ""); }}
            style={{ ...s.btn, background: "#eee", color: "#555" }}>
            ล้าง
          </button>
        )}
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr style={{ background: "#f5f7fa" }}>
              {["#", "รหัสลูกค้า", "ชื่อ-นามสกุล", "เบอร์", "บริษัท", "วันเกิด", "แต้ม", "ระดับ", "สมัครเมื่อ"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#aaa" }}>ไม่พบข้อมูล</td></tr>
            )}
            {users.map((u, i) => {
              const level = u.points >= 10000 ? "💎 Diamond" : u.points >= 4000 ? "🔱 Platinum" : u.points >= 1000 ? "🥇 Gold" : u.points >= 300 ? "🥈 Silver" : u.points >= 100 ? "🥉 Bronze" : "👋 Welcome";
              const levelColor = u.points >= 10000 ? "#1565C0" : u.points >= 4000 ? "#607D8B" : u.points >= 1000 ? "#F9A825" : u.points >= 300 ? "#78909C" : u.points >= 100 ? "#A1887F" : "#888888";
              const isEditing = editingId === u.id;
              return (
                <tr key={u.id} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                  <td style={s.td}>{i + 1}</td>
                  <td style={{ ...s.td, minWidth: 110 }}>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => saveCustomerId(u.id, editValue)}
                        onKeyDown={e => { if (e.key === "Enter") saveCustomerId(u.id, editValue); if (e.key === "Escape") setEditingId(null); }}
                        style={{ width: 100, padding: "4px 8px", border: "1.5px solid #1976D2", borderRadius: 6, fontSize: 13 }}
                      />
                    ) : (
                      <div
                        onClick={() => { setEditingId(u.id); setEditValue(u.customer_id ?? ""); }}
                        title="คลิกเพื่อแก้ไข"
                        style={{ cursor: "pointer", padding: "4px 8px", borderRadius: 6, minWidth: 80, minHeight: 24, border: "1.5px dashed #ddd", color: u.customer_id ? "#333" : "#bbb", fontSize: 13 }}>
                        {u.customer_id ?? "คลิกกรอก"}
                      </div>
                    )}
                  </td>
                  <td style={s.td}>
                    <div style={{ fontWeight: 600 }}>
                      {u.first_name ? `${u.first_name} ${u.last_name}` : <span style={{ color: "#aaa" }}>-</span>}
                    </div>
                  </td>
                  <td style={s.td}>{u.phone}</td>
                  <td style={s.td}>{u.company ?? <span style={{ color: "#ccc" }}>-</span>}</td>
                  <td style={s.td}>{formatBirthday(u.birthday)}</td>
                  <td style={{ ...s.td, fontWeight: 700, textAlign: "right" }}>{u.points.toLocaleString()}</td>
                  <td style={{ ...s.td, color: levelColor, fontWeight: 600 }}>{level}</td>
                  <td style={s.td}>{formatDate(u.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── เคลียร์ประวัติสมาชิก ── */}
      <div style={{ width: "100%", maxWidth: 1100, background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", padding: "24px", marginTop: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🗑️ เคลียร์ประวัติแต้มสมาชิก</div>
        <div style={{ fontSize: 13, color: "#e53935", marginBottom: 16 }}>⚠️ ลบประวัติทั้งหมดและรีเซ็ตแต้มเป็น 0 — ข้อมูลจะถูกซ่อน (soft delete) และบันทึก audit log</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>เบอร์มือถือลูกค้า</div>
            <input type="tel" inputMode="numeric" maxLength={10} placeholder="0812345678"
              value={clrPhone}
              onChange={e => { setClrPhone(e.target.value.replace(/\D/g, "")); setClrResult(null); setClrError(""); }}
              style={{ ...s.input, width: 180, marginBottom: 0 }} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>รหัสผ่าน Admin (ยืนยัน)</div>
            <input type="password" placeholder="รหัสผ่าน"
              value={clrPw}
              onChange={e => { setClrPw(e.target.value); setClrResult(null); setClrError(""); }}
              style={{ ...s.input, width: 180, marginBottom: 0 }} />
          </div>
          <button onClick={handleClearPoints} disabled={clrLoading}
            style={{ ...s.btn, background: "#b71c1c", paddingBottom: 12, paddingTop: 12 }}>
            {clrLoading ? "กำลังดำเนินการ..." : "🗑️ เคลียร์ประวัติ"}
          </button>
        </div>
        {clrError && <div style={{ color: "#e53935", fontSize: 13, marginTop: 10 }}>❌ {clrError}</div>}
        {clrResult && (
          <div style={{ marginTop: 12, padding: "12px 16px", background: "#FFF3E0", borderRadius: 10, fontSize: 14, color: "#e65100" }}>
            ✅ เคลียร์ประวัติของ <strong>{clrResult.name}</strong> สำเร็จ — แต้มที่ถูกซ่อน: <strong>{clrResult.clearedPoints.toLocaleString()} แต้ม</strong>
          </div>
        )}
      </div>

      {/* ── Audit Log (แอบๆ) ── */}
      <div style={{ width: "100%", maxWidth: 1100, marginTop: 40, textAlign: "center" }}>
        <span
          onClick={() => { setAuditOpen(o => !o); if (!auditOpen) fetchAuditLog(""); }}
          style={{ fontSize: 12, color: "#bbb", cursor: "pointer", userSelect: "none", letterSpacing: 1 }}>
          · · · system log · · ·
        </span>
      </div>

      {auditOpen && (
        <div style={{ width: "100%", maxWidth: 1100, background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", padding: "24px", marginTop: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#555" }}>🔍 Audit Log</div>

          {/* ค้นหา cleared transactions */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            <input type="tel" inputMode="numeric" maxLength={10} placeholder="กรอกเบอร์เพื่อดูประวัติที่ถูกลบ"
              value={auditPhone}
              onChange={e => setAuditPhone(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && fetchAuditLog()}
              style={{ ...s.input, maxWidth: 280, marginBottom: 0 }} />
            <button onClick={() => fetchAuditLog()} disabled={auditLoading}
              style={{ ...s.btn, fontSize: 13, padding: "10px 16px" }}>
              {auditLoading ? "..." : "🔍 ค้นหา"}
            </button>
            {auditPhone && (
              <button onClick={() => { setAuditPhone(""); fetchAuditLog(""); }}
                style={{ ...s.btn, background: "#eee", color: "#555", fontSize: 13, padding: "10px 16px" }}>
                ล้าง
              </button>
            )}
          </div>

          {/* Cleared Transactions */}
          {auditPhone && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e53935", marginBottom: 8 }}>
                ประวัติที่ถูกลบ {auditPhone ? `(เบอร์ ${auditPhone})` : ""}
              </div>
              {auditCleared.length === 0 ? (
                <div style={{ fontSize: 13, color: "#aaa" }}>ไม่มีรายการที่ถูกลบ</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={s.table}>
                    <thead>
                      <tr style={{ background: "#fff3f3" }}>
                        {["#", "ประเภท", "วันที่", "แต้ม", "ยอดซื้อ (บาท)", "หมายเหตุ"].map(h => <th key={h} style={s.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {auditCleared.map((t, i) => {
                        const isRedeem = t.type === "redeem";
                        const dt = new Date(t.created_at);
                        return (
                          <tr key={t.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td style={s.td}>{i + 1}</td>
                            <td style={s.td}>
                              <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 20, background: isRedeem ? "#FFE0B2" : "#E3F2FD", color: isRedeem ? "#e65100" : "#1565C0", fontWeight: 600 }}>
                                {isRedeem ? "🎁 แลกรางวัล" : "⭐ เพิ่มแต้ม"}
                              </span>
                            </td>
                            <td style={s.td}>{dt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })} {dt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</td>
                            <td style={{ ...s.td, color: isRedeem ? "#e53935" : "#2e7d32", fontWeight: 700 }}>
                              {isRedeem ? `-${t.points_earned}` : `+${t.points_earned}`}
                            </td>
                            <td style={{ ...s.td, textAlign: "right" }}>{isRedeem ? "-" : Number(t.purchase_amount).toLocaleString()}</td>
                            <td style={{ ...s.td, color: "#888" }}>{t.note ?? "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Audit Log Table */}
          <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>บันทึกการดำเนินการ admin</div>
          {auditLogs.length === 0 ? (
            <div style={{ fontSize: 13, color: "#aaa" }}>ไม่มีบันทึก</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr style={{ background: "#f5f7fa" }}>
                    {["#", "วันเวลา", "Action", "รายละเอียด"].map(h => <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, i) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={s.td}>{i + 1}</td>
                      <td style={{ ...s.td, color: "#888", fontSize: 12 }}>
                        {new Date(log.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}{" "}
                        {new Date(log.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={s.td}>
                        <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 20, background: "#FCE4EC", color: "#b71c1c", fontWeight: 600 }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ ...s.td, color: "#555", maxWidth: 400 }}>{log.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ประวัติการเพิ่มแต้ม ── */}
      <div style={{ width: "100%", maxWidth: 1100, background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", padding: "24px", marginTop: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>📋 ประวัติการเพิ่มแต้ม</div>
          <div style={{ display: "flex", gap: 8 }}>
            {txRows.length > 0 && (
              <button onClick={exportTxExcel} style={{ ...s.exportBtn, fontSize: 13, padding: "8px 14px" }}>
                ⬇️ Export Excel
              </button>
            )}
            <button onClick={() => fetchTransactions()} style={{ ...s.btn, fontSize: 13, padding: "8px 16px" }}>
              {txLoading ? "กำลังโหลด..." : "🔄 โหลดประวัติ"}
            </button>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <input
            type="text" placeholder="ค้นหาชื่อ / เบอร์..."
            value={txSearch} onChange={e => setTxSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchTransactions()}
            style={{ ...s.input, flex: 1, minWidth: 180, marginBottom: 0 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#555", whiteSpace: "nowrap" }}>ตั้งแต่</span>
            <input type="date" value={txFrom} onChange={e => setTxFrom(e.target.value)}
              style={{ ...s.input, width: 160, marginBottom: 0 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#555", whiteSpace: "nowrap" }}>ถึง</span>
            <input type="date" value={txTo} onChange={e => setTxTo(e.target.value)}
              style={{ ...s.input, width: 160, marginBottom: 0 }} />
          </div>
          <button onClick={() => fetchTransactions()} style={s.btn}>🔍 ค้นหา</button>
          {(txSearch || txFrom || txTo) && (
            <button onClick={() => { setTxSearch(""); setTxFrom(""); setTxTo(""); fetchTransactions("", "", ""); }}
              style={{ ...s.btn, background: "#eee", color: "#555" }}>ล้าง</button>
          )}
        </div>

        {txRows.length === 0 && !txLoading && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#aaa", fontSize: 14 }}>
            กด "โหลดประวัติ" เพื่อดูข้อมูล
          </div>
        )}

        {txRows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr style={{ background: "#f5f7fa" }}>
                  {["#", "ประเภท", "วันที่", "เวลา", "ชื่อลูกค้า", "เบอร์", "ยอดซื้อ (บาท)", "แต้ม", "หมายเหตุ"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txRows.map((t, i) => {
                  const dt = new Date(t.created_at);
                  const dateStr = dt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
                  const timeStr = dt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                  const name = t.first_name ? `${t.first_name} ${t.last_name}` : (t.display_name ?? "-");
                  const isRedeem = t.type === "redeem";
                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f0f0f0", background: isRedeem ? "#FFF8F5" : (i % 2 === 0 ? "white" : "#fafafa") }}>
                      <td style={s.td}>{i + 1}</td>
                      <td style={s.td}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: isRedeem ? "#FFE0B2" : "#E3F2FD", color: isRedeem ? "#e65100" : "#1565C0" }}>
                          {isRedeem ? "🎁 แลกรางวัล" : "⭐ เพิ่มแต้ม"}
                        </span>
                      </td>
                      <td style={s.td}>{dateStr}</td>
                      <td style={s.td}>{timeStr}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{name}</td>
                      <td style={s.td}>{t.phone}</td>
                      <td style={{ ...s.td, textAlign: "right" }}>{isRedeem ? "-" : Number(t.purchase_amount).toLocaleString()}</td>
                      <td style={{ ...s.td, textAlign: "right", fontWeight: 700, color: isRedeem ? "#e53935" : "#2e7d32" }}>
                        {isRedeem ? `-${t.points_earned}` : `+${t.points_earned}`}
                      </td>
                      <td style={{ ...s.td, color: "#888", maxWidth: 200 }}>{t.note ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: "12px 14px", fontSize: 12, color: "#aaa" }}>
              แสดง {txRows.length} รายการล่าสุด
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", background: "#f4f6f9",
    fontFamily: "Leelawadee UI, Tahoma, sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "0 16px 40px",
  },
  loginCard: {
    marginTop: 120, background: "white", borderRadius: 20,
    boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
    padding: "40px 32px", width: "100%", maxWidth: 360,
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  header: {
    width: "100%", maxWidth: 1100, display: "flex",
    justifyContent: "space-between", alignItems: "center",
    padding: "28px 0 16px",
  },
  statsRow: {
    width: "100%", maxWidth: 1100,
    display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
    gap: 12, marginBottom: 20,
  },
  statCard: {
    background: "white", borderRadius: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
    padding: "16px 20px", textAlign: "center",
  },
  statNum: { fontSize: 28, fontWeight: 800, color: "#1976D2" },
  statLabel: { fontSize: 12, color: "#888", marginTop: 4 },
  tableWrap: {
    width: "100%", maxWidth: 1100, background: "white",
    borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    overflow: "auto",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { padding: "12px 14px", textAlign: "left", fontSize: 13, color: "#555", fontWeight: 600, whiteSpace: "nowrap" },
  td: { padding: "12px 14px", color: "#333", whiteSpace: "nowrap" },
  input: {
    width: "100%", padding: "12px 14px", fontSize: 15,
    border: "1.5px solid #ddd", borderRadius: 10, outline: "none",
    boxSizing: "border-box", marginBottom: 12,
    fontFamily: "Leelawadee UI, Tahoma, sans-serif",
  },
  btn: {
    padding: "12px 24px", background: "#1976D2",
    color: "white", border: "none", borderRadius: 10,
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    fontFamily: "Leelawadee UI, Tahoma, sans-serif",
    whiteSpace: "nowrap",
  },
  exportBtn: {
    padding: "10px 20px", background: "#2e7d32",
    color: "white", border: "none", borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: "pointer",
    fontFamily: "Leelawadee UI, Tahoma, sans-serif",
  },
};
