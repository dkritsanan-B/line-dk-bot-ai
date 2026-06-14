"use client";
import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

interface User {
  id: number;
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
  const header = ["ลำดับ", "ชื่อ", "นามสกุล", "เบอร์", "บริษัท", "วันเกิด", "แต้ม", "สมัครเมื่อ"];
  const rows = users.map((u, i) => [
    i + 1,
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
  const [apLoading, setApLoading] = useState(false);
  const [apResult, setApResult]   = useState<{ name: string; pointsEarned: number; totalPoints: number } | null>(null);
  const [apError, setApError]     = useState("");

  // เพิ่มแต้มแบบ CSV
  type BulkRow = { phone: string; amount: number; status?: string; name?: string; pointsEarned?: number; totalPoints?: number; message?: string };
  const [csvRows, setCsvRows]       = useState<BulkRow[]>([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvDone, setCsvDone]       = useState(false);
  const [csvError, setCsvError]     = useState("");
  const csvInputRef                 = useRef<HTMLInputElement>(null);

  // ประวัติการเพิ่มแต้ม
  interface TxRow { id: number; purchase_amount: number; points_earned: number; created_at: string; phone: string; first_name: string | null; last_name: string | null; display_name: string | null; }
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
        body: JSON.stringify({ phone: apPhone, amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) { setApError(data.error ?? "เกิดข้อผิดพลาด"); return; }
      setApResult(data);
      setApPhone(""); setApAmount("");
      fetchUsers(savedPw, search);
    } catch { setApError("เกิดข้อผิดพลาด"); }
    finally { setApLoading(false); }
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
      const data = await res.json();
      if (res.status === 401) { setError("รหัสผ่านไม่ถูกต้อง"); setAuthed(false); return; }
      setUsers(data.users ?? []);
      setAuthed(true);
      setSavedPw(pw);
    } catch { setError("เกิดข้อผิดพลาด"); }
    finally { setLoading(false); }
  }, []);

  function exportTxExcel() {
    const data = txRows.map((t, i) => {
      const dt = new Date(t.created_at);
      return {
        "#": i + 1,
        "วันที่": dt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }),
        "เวลา": dt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        "ชื่อลูกค้า": t.first_name ? `${t.first_name} ${t.last_name}` : (t.display_name ?? "-"),
        "เบอร์มือถือ": t.phone,
        "ยอดซื้อ (บาท)": t.purchase_amount,
        "แต้มที่ได้": t.points_earned,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 5 }, { wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ประวัติแต้ม");
    const date = new Date().toISOString().substring(0, 10);
    XLSX.writeFile(wb, `dk-transactions-${date}.xlsx`);
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
        <button onClick={() => exportCSV(users)} style={s.exportBtn}>
          ⬇️ Export CSV
        </button>
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
          <div style={s.statNum}>
            {users.filter(u => u.points >= 10000).length}
          </div>
          <div style={s.statLabel}>🥇 GOLD (10,000+)</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statNum}>
            {users.filter(u => u.points >= 3001 && u.points < 10000).length}
          </div>
          <div style={s.statLabel}>🥈 SILVER (3,001-10,000)</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statNum}>
            {users.filter(u => u.points < 3001).length}
          </div>
          <div style={s.statLabel}>🥉 BRONZE (0-3,000)</div>
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
        {apError && <div style={{ color: "#e53935", fontSize: 13, marginTop: 10 }}>❌ {apError}</div>}
        {apResult && (
          <div style={{ marginTop: 12, padding: "12px 16px", background: "#E8F5E9", borderRadius: 10, fontSize: 14, color: "#2e7d32" }}>
            ✅ เพิ่มแต้มสำเร็จ! <strong>{apResult.name}</strong> ได้รับ <strong>{apResult.pointsEarned} แต้ม</strong> — แต้มรวม: <strong>{apResult.totalPoints.toLocaleString()} แต้ม</strong>
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
              {["#", "ชื่อ-นามสกุล", "เบอร์", "บริษัท", "วันเกิด", "แต้ม", "ระดับ", "สมัครเมื่อ"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "#aaa" }}>ไม่พบข้อมูล</td></tr>
            )}
            {users.map((u, i) => {
              const level = u.points >= 10000 ? "🥇 GOLD" : u.points >= 3001 ? "🥈 SILVER" : "🥉 BRONZE";
              const levelColor = u.points >= 10000 ? "#F9A825" : u.points >= 3001 ? "#757575" : "#8D6E63";
              return (
                <tr key={u.id} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                  <td style={s.td}>{i + 1}</td>
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
                  {["#", "วันที่", "เวลา", "ชื่อลูกค้า", "เบอร์", "ยอดซื้อ (บาท)", "แต้มที่ได้"].map(h => (
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
                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                      <td style={s.td}>{i + 1}</td>
                      <td style={s.td}>{dateStr}</td>
                      <td style={s.td}>{timeStr}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{name}</td>
                      <td style={s.td}>{t.phone}</td>
                      <td style={{ ...s.td, textAlign: "right" }}>{Number(t.purchase_amount).toLocaleString()}</td>
                      <td style={{ ...s.td, textAlign: "right", fontWeight: 700, color: "#1976D2" }}>+{t.points_earned}</td>
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
