"use client";
import { useState, useCallback } from "react";

interface Product {
  id: number;
  category: string;
  name: string;
  unit: string | null;
  price: number | null;
  sale_price: number | null;
  is_focus: boolean;
  selling_point: string | null;
  in_stock: boolean;
  image_url: string | null;
}

export default function CatalogAdminPage() {
  const [password, setPassword] = useState("");
  const [savedPw, setSavedPw]   = useState("");
  const [authed, setAuthed]     = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const load = useCallback(async (pw: string) => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/catalog", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "โหลดข้อมูลไม่สำเร็จ"); return; }
      setProducts(data.products ?? []);
      setSavedPw(pw); setAuthed(true);
    } catch { setError("เชื่อมต่อไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);

  async function handleUpload(productId: number, file: File) {
    setUploadingId(productId); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("productId", String(productId));
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "x-admin-password": savedPw },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "อัพโหลดไม่สำเร็จ"); return; }
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, image_url: data.url } : p));
    } catch { setError("อัพโหลดไม่สำเร็จ"); }
    finally { setUploadingId(null); }
  }

  if (!authed) {
    return (
      <div style={{ maxWidth: 360, margin: "80px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>🔧 จัดการรูปสินค้า — DK Steel</h1>
        <input
          type="password" placeholder="ใส่รหัสผ่านแอดมิน" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && load(password)}
          style={{ width: "100%", padding: 10, fontSize: 15, border: "1px solid #ccc", borderRadius: 8 }}
        />
        <button
          onClick={() => load(password)} disabled={loading}
          style={{ marginTop: 12, width: "100%", padding: 10, fontSize: 15, borderRadius: 8, border: "none", background: "#E05A17", color: "#fff", cursor: "pointer" }}
        >{loading ? "กำลังเข้า..." : "เข้าสู่ระบบ"}</button>
        {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>🔧 จัดการรูปสินค้า — DK Steel</h1>
      <p style={{ color: "#666", marginBottom: 20 }}>อัพรูปให้สินค้าแต่ละตัว (เก็บบน Backblaze B2) — {products.length} รายการ</p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
        {products.map(p => (
          <div key={p.id} style={{ border: "1px solid #e2e2e2", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            <div style={{ aspectRatio: "1/1", background: "#f4f4f4", display: "grid", placeItems: "center", overflow: "hidden" }}>
              {p.image_url
                ? <img src={p.image_url} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ color: "#bbb", fontSize: 13 }}>ยังไม่มีรูป</span>}
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 11, color: "#E05A17", fontWeight: 700 }}>{p.category}{p.is_focus ? " ⭐" : ""}</div>
              <div style={{ fontWeight: 700, fontSize: 15, margin: "2px 0 8px" }}>{p.name}</div>
              <label style={{ display: "block", textAlign: "center", padding: "8px 0", fontSize: 13, borderRadius: 8, background: uploadingId === p.id ? "#ccc" : "#111", color: "#fff", cursor: "pointer" }}>
                {uploadingId === p.id ? "กำลังอัพ..." : (p.image_url ? "เปลี่ยนรูป" : "อัพรูป")}
                <input type="file" accept="image/*" hidden disabled={uploadingId === p.id}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(p.id, f); e.target.value = ""; }} />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
