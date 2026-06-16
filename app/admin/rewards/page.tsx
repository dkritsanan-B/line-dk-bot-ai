"use client";
import { useState, useEffect } from "react";

interface Reward {
  id: number;
  name: string;
  description: string | null;
  points_required: number;
  image_url: string | null;
  stock: number | null;
  active: boolean;
  created_at: string;
}

const EMPTY: Omit<Reward, "id" | "created_at"> = {
  name: "", description: "", points_required: 0,
  image_url: "", stock: null, active: true,
};

export default function RewardsAdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed]     = useState(false);
  const [savedPw, setSavedPw]   = useState("");
  const [rewards, setRewards]   = useState<Reward[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  // form สำหรับ add / edit
  const [form, setForm]         = useState({ ...EMPTY });
  const [editId, setEditId]     = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState("");

  async function fetchRewards(pw: string) {
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/admin/rewards", { headers: { "x-admin-password": pw } });
      if (res.status === 401) { setError("รหัสผ่านไม่ถูกต้อง"); setLoading(false); return; }
      const data = await res.json();
      setRewards(data.rewards ?? []);
      setAuthed(true); setSavedPw(pw);
    } catch { setError("เชื่อมต่อไม่ได้"); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError("กรุณากรอกชื่อของรางวัล"); return; }
    if (!form.points_required || form.points_required <= 0) { setFormError("กรุณากรอกแต้มที่ใช้แลก"); return; }
    setSaving(true); setFormError("");
    try {
      const body = {
        ...form,
        points_required: Number(form.points_required),
        stock: form.stock !== null && form.stock !== undefined && String(form.stock) !== "" ? Number(form.stock) : null,
        image_url: form.image_url?.trim() || null,
        description: form.description?.trim() || null,
        ...(editId ? { id: editId } : {}),
      };
      const res = await fetch("/api/admin/rewards", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": savedPw },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setFormError("เกิดข้อผิดพลาด"); return; }
      await fetchRewards(savedPw);
      setFormOpen(false); setEditId(null); setForm({ ...EMPTY });
    } catch { setFormError("เกิดข้อผิดพลาด"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`ลบ "${name}" ออกจากระบบ?`)) return;
    await fetch(`/api/admin/rewards?id=${id}`, {
      method: "DELETE",
      headers: { "x-admin-password": savedPw },
    });
    setRewards(prev => prev.filter(r => r.id !== id));
  }

  async function toggleActive(r: Reward) {
    const res = await fetch("/api/admin/rewards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": savedPw },
      body: JSON.stringify({ ...r, active: !r.active }),
    });
    const data = await res.json();
    setRewards(prev => prev.map(x => x.id === r.id ? data.reward : x));
  }

  function openEdit(r: Reward) {
    setForm({ name: r.name, description: r.description ?? "", points_required: r.points_required, image_url: r.image_url ?? "", stock: r.stock, active: r.active });
    setEditId(r.id); setFormOpen(true); setFormError("");
  }

  function openAdd() {
    setForm({ ...EMPTY }); setEditId(null); setFormOpen(true); setFormError("");
  }

  if (!authed) return (
    <div style={s.page}>
      <div style={s.loginCard}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🎁</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>จัดการของรางวัล</div>
        <div style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>DK Steel and Tools</div>
        <input type="password" placeholder="รหัสผ่าน Admin"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchRewards(password)}
          style={s.input} autoFocus />
        {error && <div style={{ color: "#e53935", fontSize: 13, margin: "6px 0" }}>{error}</div>}
        <button onClick={() => fetchRewards(password)} disabled={loading} style={s.btn}>
          {loading ? "กำลังโหลด..." : "เข้าสู่ระบบ"}
        </button>
        <a href="/admin" style={{ marginTop: 14, fontSize: 13, color: "#888", textDecoration: "none" }}>← กลับหน้า Admin</a>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800 }}>🎁 จัดการของรางวัล</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>เพิ่ม / แก้ไข / ลบของรางวัลที่ใช้แลกแต้ม</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={openAdd} style={{ ...s.btn, padding: "10px 18px", fontSize: 14 }}>
            + เพิ่มของรางวัล
          </button>
          <a href="/admin" style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", textDecoration: "none", whiteSpace: "nowrap" }}>← Admin</a>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 1000, padding: "0 16px" }}>

        {/* Form เพิ่ม/แก้ไข */}
        {formOpen && (
          <div style={{ background: "white", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", padding: 24, marginBottom: 24, border: "2px solid #1976D2" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 18, color: "#1976D2" }}>
              {editId ? "✏️ แก้ไขของรางวัล" : "➕ เพิ่มของรางวัลใหม่"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={s.label}>ชื่อของรางวัล *</label>
                <input type="text" placeholder="เช่น พัดลม Hatari 16 นิ้ว"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={s.input} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={s.label}>รายละเอียด</label>
                <input type="text" placeholder="เช่น พัดลมตั้งพื้น ขนาด 16 นิ้ว รับประกัน 1 ปี"
                  value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  style={s.input} />
              </div>
              <div>
                <label style={s.label}>แต้มที่ใช้แลก *</label>
                <input type="number" min={1} placeholder="100"
                  value={form.points_required || ""} onChange={e => setForm(f => ({ ...f, points_required: parseInt(e.target.value) || 0 }))}
                  style={s.input} />
              </div>
              <div>
                <label style={s.label}>จำนวนคงเหลือ (ว่าง = ไม่จำกัด)</label>
                <input type="number" min={0} placeholder="ไม่จำกัด"
                  value={form.stock ?? ""} onChange={e => setForm(f => ({ ...f, stock: e.target.value === "" ? null : parseInt(e.target.value) }))}
                  style={s.input} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={s.label}>URL รูปภาพ (ถ้ามี)</label>
                <input type="text" placeholder="https://..."
                  value={form.image_url ?? ""} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                  style={s.input} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                  <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                    style={{ width: 18, height: 18, cursor: "pointer" }} />
                  เปิดให้แลกได้
                </label>
              </div>
            </div>
            {formError && <div style={{ color: "#e53935", fontSize: 13, marginTop: 8 }}>❌ {formError}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={handleSave} disabled={saving} style={{ ...s.btn, padding: "11px 24px" }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
              <button onClick={() => { setFormOpen(false); setEditId(null); }}
                style={{ ...s.btn, background: "#eee", color: "#555", padding: "11px 24px" }}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* รายการของรางวัล */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#aaa" }}>กำลังโหลด...</div>
        ) : rewards.length === 0 ? (
          <div style={{ textAlign: "center", padding: 64, background: "white", borderRadius: 16, color: "#aaa" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎁</div>
            <div>ยังไม่มีของรางวัล กด "+ เพิ่มของรางวัล" เพื่อเริ่ม</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rewards.map(r => (
              <div key={r.id} style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.07)", padding: "16px 20px", display: "flex", gap: 16, alignItems: "center", opacity: r.active ? 1 : 0.55, border: r.active ? "1.5px solid #e8f0fe" : "1.5px dashed #ddd" }}>

                {/* รูป */}
                <div style={{ width: 68, height: 68, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {r.image_url ? (
                    <img src={r.image_url} alt={r.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 28 }}>🎁</span>
                  )}
                </div>

                {/* ข้อมูล */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#222" }}>{r.name}</div>
                  {r.description && <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{r.description}</div>}
                  <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1976D2" }}>⭐ {r.points_required.toLocaleString()} แต้ม</span>
                    <span style={{ fontSize: 13, color: "#888" }}>
                      คงเหลือ: {r.stock !== null ? <strong style={{ color: r.stock === 0 ? "#e53935" : "#333" }}>{r.stock}</strong> : "ไม่จำกัด"}
                    </span>
                    <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 20, fontWeight: 600, background: r.active ? "#E8F5E9" : "#f5f5f5", color: r.active ? "#2e7d32" : "#aaa" }}>
                      {r.active ? "เปิดอยู่" : "ปิดอยู่"}
                    </span>
                  </div>
                </div>

                {/* ปุ่ม */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => toggleActive(r)}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #ddd", background: "white", cursor: "pointer", fontSize: 13, color: "#555", fontFamily: "Leelawadee UI, Tahoma, sans-serif" }}>
                    {r.active ? "ปิด" : "เปิด"}
                  </button>
                  <button onClick={() => openEdit(r)}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#E3F2FD", cursor: "pointer", fontSize: 13, color: "#1565C0", fontWeight: 600, fontFamily: "Leelawadee UI, Tahoma, sans-serif" }}>
                    แก้ไข
                  </button>
                  <button onClick={() => handleDelete(r.id, r.name)}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#FFEBEE", cursor: "pointer", fontSize: 13, color: "#c62828", fontWeight: 600, fontFamily: "Leelawadee UI, Tahoma, sans-serif" }}>
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 12, color: "#ccc", marginTop: 32 }}>
          {rewards.length > 0 && `ทั้งหมด ${rewards.length} รายการ`}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", background: "#f4f6f9",
    fontFamily: "Leelawadee UI, Tahoma, sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center",
    paddingBottom: 48,
  },
  loginCard: {
    marginTop: 120, background: "white", borderRadius: 20,
    boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
    padding: "40px 32px", width: "100%", maxWidth: 340,
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  header: {
    width: "100%", background: "linear-gradient(135deg, #0D1B5E 0%, #1565C0 100%)",
    color: "white", padding: "22px 24px", marginBottom: 24,
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  label: { fontSize: 13, color: "#555", display: "block", marginBottom: 6 },
  input: {
    width: "100%", padding: "11px 14px", fontSize: 14,
    border: "1.5px solid #ddd", borderRadius: 10, outline: "none",
    boxSizing: "border-box", marginBottom: 0,
    fontFamily: "Leelawadee UI, Tahoma, sans-serif",
  },
  btn: {
    padding: "12px 24px", background: "#1976D2",
    color: "white", border: "none", borderRadius: 10,
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    fontFamily: "Leelawadee UI, Tahoma, sans-serif",
    whiteSpace: "nowrap" as const,
  },
};
