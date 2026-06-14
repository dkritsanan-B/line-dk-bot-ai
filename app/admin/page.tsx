"use client";
import { useState, useCallback } from "react";

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

  // เพิ่มแต้ม
  const [apPhone, setApPhone]     = useState("");
  const [apAmount, setApAmount]   = useState("");
  const [apLoading, setApLoading] = useState(false);
  const [apResult, setApResult]   = useState<{ name: string; pointsEarned: number; totalPoints: number } | null>(null);
  const [apError, setApError]     = useState("");

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
