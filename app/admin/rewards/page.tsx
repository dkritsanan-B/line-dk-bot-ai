"use client";
import { useState, useEffect, useRef } from "react";
import "../admin.css";

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
  const [authed, setAuthed]       = useState(false);
  const [savedPw, setSavedPw]     = useState("");
  const [savedUsername, setSavedUsername] = useState("");
  const [rewards, setRewards]   = useState<Reward[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  // form สำหรับ add / edit
  const [form, setForm]         = useState({ ...EMPTY });
  const [editId, setEditId]     = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState<number | null>(null);
  const dragIndex                 = useRef<number | null>(null);

  useEffect(() => {
    const pw    = sessionStorage.getItem("admin_pw") ?? "";
    const uname = sessionStorage.getItem("admin_username") ?? "";
    const role  = sessionStorage.getItem("admin_role") ?? "";
    if (!pw) { window.location.href = "/admin"; return; }
    if (role && role !== "super") { window.location.href = "/admin"; return; }
    setSavedUsername(uname);
    fetchRewards(pw, uname);
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleUpload(file);
          break;
        }
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [formOpen, savedPw]);

  async function fetchRewards(pw: string, uname = savedUsername) {
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/admin/rewards", { headers: { "x-admin-password": pw, "x-admin-username": uname } });
      if (res.status === 401) { window.location.href = "/admin"; return; }
      const text = await res.text();
      let data: { rewards?: Reward[]; error?: string };
      try { data = JSON.parse(text); } catch { setError(`HTTP ${res.status} — ${text.substring(0, 300) || "(empty body)"}`); return; }
      if (!res.ok) { setError(`Error ${res.status}: ${data.error ?? text}`); return; }
      setRewards(data.rewards ?? []);
      setAuthed(true); setSavedPw(pw); setSavedUsername(uname);
    } catch (e) { setError(`เชื่อมต่อไม่ได้: ${String(e)}`); }
    finally { setLoading(false); }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/admin/upload", { method: "POST", headers: { "x-admin-password": savedPw, "x-admin-username": savedUsername }, body: fd });
      const data = await res.json();
      if (!res.ok) { setFormError(`อัพโหลดรูปไม่ได้: ${data.error}`); return; }
      setForm(f => ({ ...f, image_url: data.url }));
    } catch { setFormError("อัพโหลดรูปไม่ได้"); }
    finally { setUploading(false); }
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
      const res  = await fetch("/api/admin/rewards", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(`เกิดข้อผิดพลาด: ${data.error}`); return; }
      await fetchRewards(savedPw);
      setFormOpen(false); setEditId(null); setForm({ ...EMPTY });
    } catch (e) { setFormError(`เกิดข้อผิดพลาด: ${String(e)}`); }
    finally { setSaving(false); }
  }

  async function saveOrder(list: Reward[]) {
    const order = list.map((r, i) => ({ id: r.id, sort_order: i }));
    await fetch("/api/admin/rewards", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
      body: JSON.stringify({ order }),
    });
  }

  function handleDrop(dropIndex: number) {
    if (dragIndex.current === null || dragIndex.current === dropIndex) {
      setDragOver(null); return;
    }
    const next = [...rewards];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(dropIndex, 0, moved);
    setRewards(next);
    setDragOver(null);
    dragIndex.current = null;
    saveOrder(next);
  }

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`ลบ "${name}" ออกจากระบบ?`)) return;
    await fetch(`/api/admin/rewards?id=${id}`, {
      method: "DELETE",
      headers: { "x-admin-password": savedPw, "x-admin-username": savedUsername },
    });
    setRewards(prev => prev.filter(r => r.id !== id));
  }

  async function toggleActive(r: Reward) {
    const res = await fetch("/api/admin/rewards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": savedPw, "x-admin-username": savedUsername },
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
    <div className="ad"><div className="ad-empty" style={{ paddingTop: 80 }}>
      {error ? (<><div className="ad-alert ad-alert--err" style={{ display: "inline-block", marginBottom: 12 }}>{error}</div><br /><a href="/admin" style={{ color: "var(--ad-blue)" }}>← กลับหน้าแอดมิน</a></>) : "กำลังโหลด…"}
    </div></div>
  );

  return (
    <div className="ad">
      <div className="ad-top"><div className="ad-top-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dk-logo.jpg" alt="DK" />
        <div>
          <div className="ad-top-name">🎁 ของรางวัล</div>
          <div className="ad-top-sub">เพิ่ม / แก้ไข / จัดลำดับของที่ใช้แลกแต้ม · {savedUsername}</div>
        </div>
        <div className="ad-top-actions">
          <button className="ad-tbtn ad-tbtn--solid" onClick={openAdd}>➕ เพิ่มของรางวัล</button>
          <a className="ad-tbtn" href="/admin">← หน้าแอดมิน</a>
        </div>
      </div></div>

      <div className="ad-main" style={{ maxWidth: 960 }}>
        {formOpen && (
          <div className="ad-card" style={{ border: "2px solid var(--ad-blue)", marginBottom: 14 }}>
            <div className="ad-card-h"><div><h3>{editId ? "✏️ แก้ไขของรางวัล" : "➕ เพิ่มของรางวัลใหม่"}</h3><p>วางรูปด้วย Ctrl+V ได้เลย</p></div></div>
            <div className="ad-form">
              <div className="ad-field"><label>ชื่อของรางวัล *</label><input className="ad-input" type="text" placeholder="เช่น พัดลม Hatari 16 นิ้ว" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="ad-field"><label>รายละเอียด</label><input className="ad-input" type="text" placeholder="เช่น พัดลมตั้งพื้น 16 นิ้ว รับประกัน 1 ปี" value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="ad-row">
                <div className="ad-field" style={{ flex: 1 }}><label>แต้มที่ใช้แลก *</label><input className="ad-input ad-input--num" type="number" min={1} placeholder="100" value={form.points_required || ""} onChange={e => setForm(f => ({ ...f, points_required: parseInt(e.target.value) || 0 }))} /></div>
                <div className="ad-field" style={{ flex: 1 }}><label>จำนวนคงเหลือ (ว่าง = ไม่จำกัด)</label><input className="ad-input ad-input--num" type="number" min={0} placeholder="ไม่จำกัด" value={form.stock ?? ""} onChange={e => setForm(f => ({ ...f, stock: e.target.value === "" ? null : parseInt(e.target.value) }))} /></div>
              </div>
              <div className="ad-field"><label>รูปภาพ (ถ้ามี)</label>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {form.image_url && <img src={form.image_url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, border: "1.5px solid var(--ad-line)", flexShrink: 0 }} />}
                  <label className="ad-drop" style={{ flex: 1, padding: "14px 16px" }}>
                    <b style={{ fontSize: 13 }}>{uploading ? "⏳ กำลังอัปโหลด…" : form.image_url ? "📷 เปลี่ยนรูป" : "📷 อัปโหลดรูป"}</b><span>คลิกเลือกไฟล์ หรือ Ctrl+V วางรูป</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} disabled={uploading} />
                  </label>
                  {form.image_url && <button type="button" className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => setForm(f => ({ ...f, image_url: "" }))}>ลบรูป</button>}
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} style={{ width: 18, height: 18, cursor: "pointer" }} /> เปิดให้แลกได้
              </label>
              {formError && <div className="ad-alert ad-alert--err">{formError}</div>}
              <div className="ad-row">
                <button className="ad-btn ad-btn--primary" onClick={handleSave} disabled={saving}>{saving ? "กำลังบันทึก…" : "💾 บันทึก"}</button>
                <button className="ad-btn ad-btn--ghost" onClick={() => { setFormOpen(false); setEditId(null); }}>ยกเลิก</button>
              </div>
            </div>
          </div>
        )}

        {loading ? <div className="ad-empty">กำลังโหลด…</div>
          : rewards.length === 0 ? <div className="ad-card ad-empty"><i>🎁</i>ยังไม่มีของรางวัล กด &quot;เพิ่มของรางวัล&quot; เพื่อเริ่ม</div>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="ad-note" style={{ textAlign: "center" }}>จับที่ ≡ แล้วลากเพื่อจัดลำดับที่ลูกค้าเห็น</div>
              {rewards.map((r, i) => (
                <div key={r.id} draggable
                  onDragStart={() => { dragIndex.current = i; }}
                  onDragOver={e => { e.preventDefault(); setDragOver(i); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={() => { setDragOver(null); dragIndex.current = null; }}
                  className="ad-card"
                  style={{ padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", opacity: r.active ? 1 : 0.55, outline: dragOver === i ? "2.5px solid var(--ad-blue)" : "none", cursor: "grab", marginTop: 0 }}>
                  <div style={{ fontSize: 20, color: "#B7C1D1", userSelect: "none" }}>≡</div>
                  <div style={{ width: 60, height: 60, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "#F3F6FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {r.image_url ? <img src={r.image_url} alt={r.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} /> : <span style={{ fontSize: 24 }}>🎁</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{r.name}</div>
                    {r.description && <div className="ad-note">{r.description}</div>}
                    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <span className="ad-chip ad-chip--blue">⭐ {r.points_required.toLocaleString()} แต้ม</span>
                      <span className={`ad-chip ${r.stock === 0 ? "ad-chip--danger" : "ad-chip--muted"}`}>{r.stock !== null ? `คงเหลือ ${r.stock}` : "ไม่จำกัดจำนวน"}</span>
                      <span className={`ad-chip ${r.active ? "ad-chip--ok" : "ad-chip--muted"}`}>{r.active ? "เปิดอยู่" : "ปิดอยู่"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => toggleActive(r)}>{r.active ? "ปิด" : "เปิด"}</button>
                    <button className="ad-btn ad-btn--primary ad-btn--sm" onClick={() => openEdit(r)}>แก้ไข</button>
                    <button className="ad-btn ad-btn--ghost ad-btn--sm" style={{ color: "var(--ad-danger)" }} onClick={() => handleDelete(r.id, r.name)}>ลบ</button>
                  </div>
                </div>
              ))}
              <div className="ad-note" style={{ textAlign: "center", marginTop: 8 }}>ทั้งหมด {rewards.length} รายการ</div>
            </div>
          )}
      </div>
    </div>
  );
}
