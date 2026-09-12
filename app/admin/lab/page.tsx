"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================
// DK Creative Lab — ห้องทดลองทำสื่อโฆษณา
// ลองได้หลายแบบ: เลือก AI (Gemini/OpenAI) · โหมด (โปสเตอร์เต็มใบ / ภาพล้วน+เทมเพลต)
// · จำนวน variation · อัพรูปฐานให้ AI แต่งต่อ → เทียบกัน → เลือกใบที่ชอบ → เซฟเข้าสินค้า
// ============================================================

type Provider = "gemini" | "openai";
type GenMode = "poster" | "clean";
type Aspect = "square" | "portrait" | "landscape";

interface GenImage { dataUrl: string; provider: Provider }
interface Product { id: number; name: string; category: string }

const PROVIDER_LABEL: Record<Provider, string> = { gemini: "🔵 Gemini", openai: "🟢 GPT" };
const DEFAULT_PHONE = "075-845177";
const DEFAULT_FB = "DK Steel and Tools";

export default function CreativeLabPage() {
  const [password, setPassword] = useState("");
  const [savedPw, setSavedPw] = useState("");
  const [authed, setAuthed] = useState(false);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // ---- ตัวเลือกการสร้าง ----
  const [provider, setProvider] = useState<Provider>("gemini");
  const [mode, setMode] = useState<GenMode>("clean");
  const [aspect, setAspect] = useState<Aspect>("square");
  const [n, setN] = useState(2);
  const [brief, setBrief] = useState("");
  const [baseImage, setBaseImage] = useState<string>("");   // data URL รูปฐาน

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<GenImage[]>([]);
  const [promptResult, setPromptResult] = useState("");   // prompt ที่ทีมขยายไว้ (สำหรับ GPT)
  const [copied, setCopied] = useState(false);

  // ---- เทมเพลต (composer) ----
  const [composerBg, setComposerBg] = useState<string>("");  // รูปพื้นหลังที่กำลังจัดเทมเพลต

  const enter = useCallback(async (pw: string) => {
    setError("");
    try {
      const [pv, cat] = await Promise.all([
        fetch("/api/lab/generate").then(r => r.json()),
        fetch("/api/catalog", { cache: "no-store" }).then(r => r.json()),
      ]);
      const avail: Provider[] = pv.providers ?? [];
      setProviders(avail);
      if (avail.length && !avail.includes("gemini")) setProvider(avail[0]);
      setProducts((cat.products ?? []).map((p: Product) => ({ id: p.id, name: p.name, category: p.category })));
      setSavedPw(pw); setAuthed(true);
    } catch { setError("เชื่อมต่อไม่สำเร็จ"); }
  }, []);

  async function pickBaseImage(file: File) {
    const dataUrl = await fileToDataUrl(file);
    setBaseImage(dataUrl);
  }

  async function generate() {
    if (!brief.trim()) { setError("พิมพ์ brief (สิ่งที่อยากได้) ก่อนนะครับ"); return; }
    // GPT = ให้ทีมขยาย brief เป็น prompt → ผู้ใช้ก๊อปไปรันใน ChatGPT เอง
    if (provider === "openai") { expandForGpt(); return; }

    setBusy(true); setError(""); setResults([]); setPromptResult("");
    try {
      const res = await fetch("/api/lab/generate", {
        method: "POST",
        headers: { "x-admin-password": savedPw, "content-type": "application/json" },
        // หมายเหตุ: ไม่ส่ง baseImage เข้า AI โดยตั้งใจ — เพื่อไม่ให้ AI ไปแก้/เปลี่ยนรูปจริง (รถ+สินค้า) ของผู้ใช้
        // รูปจริงที่อัพไว้ใช้ทำเทมเพลตอย่างเดียว (ปุ่ม "ใส่ข้อความบนรูปนี้เลย")
        body: JSON.stringify({ provider, mode, prompt: brief, n, aspect }),
      });
      const data = await res.json();
      if (!res.ok) { setError((data.error ?? "สร้างรูปไม่สำเร็จ") + (data.detail ? ` — ${data.detail}` : "")); return; }
      setResults(data.images ?? []);
    } catch { setError("สร้างรูปไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  // GPT flow: ทีมขยาย brief → prompt ละเอียด (ไม่สร้างรูปในเว็บ)
  async function expandForGpt() {
    setBusy(true); setError(""); setResults([]); setPromptResult(""); setCopied(false);
    try {
      const res = await fetch("/api/lab/expand", {
        method: "POST",
        headers: { "x-admin-password": savedPw, "content-type": "application/json" },
        body: JSON.stringify({ brief, aspect, mode, hasPhoto: !!baseImage }),
      });
      const data = await res.json();
      if (!res.ok) { setError((data.error ?? "ขยาย brief ไม่สำเร็จ") + (data.detail ? ` — ${data.detail}` : "")); return; }
      setPromptResult(data.prompt ?? "");
    } catch { setError("ขยาย brief ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  // ---- เซฟรูป (data URL) เข้า B2 + ผูกกับสินค้า ผ่าน /api/upload เดิม ----
  async function saveToProduct(dataUrl: string, productId: number) {
    setError("");
    const blob = await (await fetch(dataUrl)).blob();
    const fd = new FormData();
    fd.append("file", blob, "creative.png");
    fd.append("productId", String(productId));
    const res = await fetch("/api/upload", { method: "POST", headers: { "x-admin-password": savedPw }, body: fd });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "เซฟไม่สำเร็จ"); return; }
    alert("เซฟเข้าสินค้าเรียบร้อย ✅");
  }

  if (!authed) {
    return (
      <div style={{ maxWidth: 360, margin: "80px auto", padding: 24, fontFamily: FONT }}>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>🎨 DK Creative Lab</h1>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>ห้องทดลองทำสื่อโฆษณา</p>
        <input type="password" placeholder="รหัสผ่านแอดมิน" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && enter(password)}
          style={inputStyle} />
        <button onClick={() => enter(password)} style={{ ...btnPrimary, width: "100%", marginTop: 12 }}>เข้าสู่ระบบ</button>
        {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto", padding: 16, fontFamily: FONT }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>🎨 DK Creative Lab</h1>
      <p style={{ color: "#666", marginTop: 4 }}>ลองหลายแบบ เลือกใบที่ถูกใจ · <a href="/admin/catalog" style={{ color: "#E05A17" }}>← กลับหน้าจัดการสินค้า</a></p>

      {/* ---------- แผงตั้งค่า ---------- */}
      <div style={panel}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {/* AI เจ้าไหน */}
          <div>
            <label style={lbl}>1. ใช้ AI ตัวไหน</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["gemini", "openai"] as Provider[]).map(pv => {
                // gemini = สร้างรูปในเว็บ (ต้องมี GEMINI key) · GPT = ขยาย brief ไปรันเอง (ตัวขยายใช้ Gemini เช่นกัน)
                const ok = providers.includes("gemini");
                return (
                  <button key={pv} disabled={!ok} onClick={() => setProvider(pv)}
                    title={pv === "openai" ? "ทีมขยาย brief ให้ แล้วคุณเอาไปรันใน ChatGPT เอง" : "สร้างรูปในเว็บด้วย Gemini"}
                    style={chip(provider === pv, !ok)}>
                    {PROVIDER_LABEL[pv]}
                  </button>
                );
              })}
            </div>
          </div>
          {/* โหมด */}
          <div>
            <label style={lbl}>2. โหมด</label>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setMode("clean")} style={chip(mode === "clean", false)}>ภาพล้วน + เทมเพลต</button>
              <button onClick={() => setMode("poster")} style={chip(mode === "poster", false)}>โปสเตอร์เต็มใบ</button>
            </div>
            <p style={hint}>{mode === "clean" ? "AI ทำแค่ภาพ แล้วมาวางข้อความเองในเทมเพลต (ตัวอักษรไทยคมชัด)" : "AI ปั้นทั้งใบรวมข้อความ (เร็ว แต่ตัวอักษรไทยอาจเพี้ยน)"}</p>
          </div>
          {/* สัดส่วน */}
          <div>
            <label style={lbl}>3. สัดส่วน</label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["square", "portrait", "landscape"] as Aspect[]).map(a => (
                <button key={a} onClick={() => setAspect(a)} style={chip(aspect === a, false)}>
                  {a === "square" ? "1:1" : a === "portrait" ? "4:5" : "16:9"}
                </button>
              ))}
            </div>
          </div>
          {/* จำนวน */}
          <div>
            <label style={lbl}>4. จำนวนใบ (เทียบกัน)</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4].map(k => (
                <button key={k} onClick={() => setN(k)} style={chip(n === k, false)}>{k}</button>
              ))}
            </div>
          </div>
        </div>

        {/* รูปฐาน + brief */}
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 16, marginTop: 16, alignItems: "start" }}>
          <div>
            <label style={lbl}>รูปฐาน (ไม่บังคับ)</label>
            <label style={{ ...uploadBox, backgroundImage: baseImage ? `url(${baseImage})` : "none" }}>
              {!baseImage && <span style={{ color: "#999", fontSize: 12, textAlign: "center" }}>📎 อัพรูปจริง<br />ของคุณ</span>}
              <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) pickBaseImage(f); e.target.value = ""; }} />
            </label>
            {baseImage && <>
              <button onClick={() => setComposerBg(baseImage)} style={{ ...btnDark, width: "100%", marginTop: 8, fontSize: 12.5 }}>📝 ใส่ข้อความบนรูปนี้เลย<br /><span style={{ fontSize: 10.5, opacity: 0.85 }}>(AI ไม่แตะ · รถ+สินค้าอยู่ครบ)</span></button>
              <button onClick={() => setBaseImage("")} style={{ ...btnGhost, width: "100%", marginTop: 6, fontSize: 12 }}>ลบรูป</button>
            </>}
          </div>
          <div>
            <label style={lbl}>Brief — อยากได้รูปแบบไหน</label>
            <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={5}
              placeholder={"เช่น: โปรเมทัลชีทบลูสโคป กันฝนกันแดด ส่งถึงหน้างาน · รถเครนกำลังยกเมทัลชีทลงหน้างานก่อสร้าง แดดสวย"}
              style={{ ...inputStyle, resize: "vertical", height: "auto" }} />
            <button onClick={generate} disabled={busy} style={{ ...btnPrimary, marginTop: 10, opacity: busy ? 0.6 : 1 }}>
              {busy ? "⏳ กำลังทำ..." : provider === "openai" ? "✍️ ให้ทีมขยาย Brief สำหรับ GPT" : `✨ ให้ AI สร้างรูปใหม่ ${n} ใบ (🔵 Gemini)`}
            </button>
            {provider === "openai" && <p style={hint}>ทีมงานจะขยาย brief เป็น prompt ละเอียด → คุณก๊อปไปวางใน ChatGPT รันเอง (ไม่เสียค่า API)</p>}
            {provider === "gemini" && baseImage && <p style={{ ...hint, color: "#c0392b" }}>* ปุ่มนี้ AI สร้าง<b>รูปใหม่จาก brief</b> ไม่แตะรูปที่คุณอัพ — ถ้าอยากใช้รูปจริงของคุณ กดปุ่ม “📝 ใส่ข้อความบนรูปนี้เลย” ทางซ้าย</p>}
          </div>
        </div>
        {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}
      </div>

      {/* ---------- ผลลัพธ์ GPT: prompt ที่ทีมขยาย ---------- */}
      {promptResult && (
        <div style={{ ...panel, background: "#f2fbf4", borderColor: "#bfe6c8", marginTop: 24 }}>
          <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>✍️ Prompt ที่ทีมขยายให้ — ก๊อปไปรันใน ChatGPT</h2>
          <p style={{ ...hint, marginBottom: 10 }}>ทำตาม 3 ขั้น: <b>1)</b> กดคัดลอก · <b>2)</b> เปิด ChatGPT {baseImage ? "แนบรูปจริงของคุณ แล้ว" : ""}วาง prompt กด Enter · <b>3)</b> โหลดรูปที่ได้ → กลับมาอัพในช่อง “รูปฐาน” แล้วกด “📝 ใส่ข้อความบนรูปนี้เลย” เพื่อทำเทมเพลต</p>
          <textarea readOnly value={promptResult} rows={8} style={{ ...inputStyle, resize: "vertical", fontFamily: FONT, background: "#fff" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={async () => { await navigator.clipboard.writeText(promptResult); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={btnPrimary}>
              {copied ? "✅ คัดลอกแล้ว" : "📋 คัดลอก prompt"}
            </button>
            <a href="https://chatgpt.com/" target="_blank" rel="noreferrer" style={{ ...btnDark, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>เปิด ChatGPT ↗</a>
            <button onClick={() => setPromptResult("")} style={btnGhost}>ปิด</button>
          </div>
        </div>
      )}

      {/* ---------- ผลลัพธ์ ---------- */}
      {results.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, marginTop: 24 }}>ผลลัพธ์ — {results.length} ใบ (กดเลือกใบที่ชอบ)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {results.map((img, i) => (
              <div key={i} style={{ border: "1px solid #e2e2e2", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
                <img src={img.dataUrl} alt={`result ${i}`} style={{ width: "100%", display: "block" }} />
                <div style={{ padding: 10 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>{PROVIDER_LABEL[img.provider]}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => setComposerBg(img.dataUrl)} style={{ ...btnDark, flex: 1, fontSize: 12 }}>📝 ใส่ข้อความ (เทมเพลต)</button>
                    <a href={img.dataUrl} download={`dk-${Date.now()}.png`} style={{ ...btnGhost, fontSize: 12, textDecoration: "none", display: "inline-block" }}>⬇</a>
                  </div>
                  <SaveToProduct products={products} onSave={pid => saveToProduct(img.dataUrl, pid)} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---------- ตัวจัดเทมเพลต ---------- */}
      {composerBg && (
        <TemplateComposer
          bg={composerBg}
          aspect={aspect}
          products={products}
          onClose={() => setComposerBg("")}
          onSave={(dataUrl, pid) => saveToProduct(dataUrl, pid)}
        />
      )}
    </div>
  );
}

// ============================================================
// ตัวเลือกเซฟเข้าสินค้า (dropdown เล็ก ๆ)
// ============================================================
function SaveToProduct({ products, onSave }: { products: Product[]; onSave: (pid: number) => void }) {
  const [pid, setPid] = useState<string>("");
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <select value={pid} onChange={e => setPid(e.target.value)} style={{ ...inputStyle, flex: 1, height: 34, fontSize: 12, padding: "0 8px" }}>
        <option value="">— เซฟเข้าสินค้า —</option>
        {products.map(p => <option key={p.id} value={p.id}>{p.category} · {p.name}</option>)}
      </select>
      <button disabled={!pid} onClick={() => pid && onSave(Number(pid))} style={{ ...btnPrimary, fontSize: 12, padding: "0 12px", opacity: pid ? 1 : 0.5 }}>เซฟ</button>
    </div>
  );
}

// ============================================================
// TemplateComposer — วางข้อความไทย/โลโก้/แถบติดต่อ ทับภาพ ด้วย canvas
// ตัวอักษรไทยเรนเดอร์ด้วยฟอนต์ระบบ = คมชัด ถูกต้อง
// ============================================================
function TemplateComposer({ bg, aspect, products, onClose, onSave }: {
  bg: string; aspect: Aspect; products: Product[];
  onClose: () => void; onSave: (dataUrl: string, pid: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [headline, setHeadline] = useState("จัดส่งเมทัลชีท ถึงหน้างานจริง!");
  const [subhead, setSubhead] = useState("ส่งใกล้ ส่งไกล งานเล็ก งานใหญ่ ดีเคพร้อมให้บริการ");
  const [bullets, setBullets] = useState("จัดส่งถึงหน้างาน\nช่วยประหยัดเวลาและค่าใช้จ่าย\nสินค้าคุณภาพมาตรฐาน\nพร้อมให้คำแนะนำโดยทีมงานมืออาชีพ");
  const [phone, setPhone] = useState(DEFAULT_PHONE);
  const [fb, setFb] = useState(DEFAULT_FB);
  const [showBar, setShowBar] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [pid, setPid] = useState("");
  const [rendering, setRendering] = useState(false);

  const dims = aspect === "portrait" ? { w: 1080, h: 1350 } : aspect === "landscape" ? { w: 1350, h: 1080 } : { w: 1080, h: 1080 };

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = dims.w; canvas.height = dims.h;
    const W = dims.w, H = dims.h;

    const bgImg = await loadImage(bg);
    drawCover(ctx, bgImg, 0, 0, W, H);

    // ไล่เฉดมืดบน-ล่าง เพื่อให้ตัวอักษรอ่านง่าย
    const gTop = ctx.createLinearGradient(0, 0, 0, H * 0.45);
    gTop.addColorStop(0, "rgba(10,22,60,0.82)"); gTop.addColorStop(1, "rgba(10,22,60,0)");
    ctx.fillStyle = gTop; ctx.fillRect(0, 0, W, H * 0.45);

    const pad = Math.round(W * 0.055);
    let y = pad + 20;

    // โลโก้ มุมขวาบน
    if (showLogo) {
      try {
        const logo = await loadImage("/dk-logo.jpg");
        const ls = Math.round(W * 0.12);
        roundRectPath(ctx, W - pad - ls, pad, ls, ls, 12); ctx.save(); ctx.clip();
        ctx.drawImage(logo, W - pad - ls, pad, ls, ls); ctx.restore();
      } catch { /* ไม่มีโลโก้ก็ข้าม */ }
    }

    // พาดหัว (เหลืองทอง ขอบเข้ม)
    const hlSize = Math.round(W * 0.072);
    ctx.font = `900 ${hlSize}px ${FONT}`;
    ctx.textBaseline = "top";
    const hlLines = wrapText(ctx, headline, W - pad * 2 - (showLogo ? W * 0.14 : 0));
    for (const line of hlLines) {
      ctx.lineWidth = Math.round(hlSize * 0.14); ctx.strokeStyle = "#0a163c";
      ctx.strokeText(line, pad, y);
      ctx.fillStyle = "#FFD200"; ctx.fillText(line, pad, y);
      y += hlSize * 1.14;
    }

    // ซับเฮด (บนแถบทอง)
    if (subhead.trim()) {
      y += 6;
      const shSize = Math.round(W * 0.034);
      ctx.font = `700 ${shSize}px ${FONT}`;
      const shLines = wrapText(ctx, subhead, W - pad * 2 - 24);
      const boxH = shLines.length * shSize * 1.3 + 20;
      ctx.fillStyle = "rgba(226,90,23,0.92)";
      roundRectPath(ctx, pad, y, Math.min(W - pad * 2, maxLineWidth(ctx, shLines) + 28), boxH, 10); ctx.fill();
      let sy = y + 10;
      ctx.fillStyle = "#fff";
      for (const line of shLines) { ctx.fillText(line, pad + 14, sy); sy += shSize * 1.3; }
      y += boxH;
    }

    // bullets (พิลล์เข้ม + ติ๊กถูกเหลือง) วางชิดล่างเหนือแถบ
    const items = bullets.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 5);
    if (items.length) {
      const bSize = Math.round(W * 0.036);
      ctx.font = `700 ${bSize}px ${FONT}`;
      const rowH = bSize * 1.7;
      const barH = showBar ? Math.round(H * 0.11) : 0;
      let by = H - barH - 24 - items.length * (rowH + 10);
      for (const it of items) {
        const tw = ctx.measureText(it).width;
        const pillW = tw + rowH + 28;
        ctx.fillStyle = "rgba(10,22,60,0.72)";
        roundRectPath(ctx, pad, by, Math.min(pillW, W - pad * 2), rowH, rowH / 2); ctx.fill();
        // วงกลมติ๊กถูก
        const cx = pad + rowH / 2, cy = by + rowH / 2, r = rowH * 0.32;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = "#FFD200"; ctx.fill();
        ctx.strokeStyle = "#0a163c"; ctx.lineWidth = Math.max(3, r * 0.28); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy); ctx.lineTo(cx - r * 0.1, cy + r * 0.4); ctx.lineTo(cx + r * 0.5, cy - r * 0.45); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = `700 ${bSize}px ${FONT}`;
        ctx.fillText(it, pad + rowH + 6, by + (rowH - bSize) / 2);
        by += rowH + 10;
      }
    }

    // แถบติดต่อล่าง
    if (showBar) {
      const barH = Math.round(H * 0.11);
      const by = H - barH;
      ctx.fillStyle = "#0a163c"; ctx.fillRect(0, by, W, barH);
      ctx.fillStyle = "#FFD200"; ctx.fillRect(0, by, W, Math.max(4, barH * 0.03));
      // โลโก้เล็กในแถบ
      let tx = pad;
      if (showLogo) {
        try {
          const logo = await loadImage("/dk-logo.jpg");
          const s = Math.round(barH * 0.66);
          ctx.drawImage(logo, pad, by + (barH - s) / 2, s, s);
          tx = pad + s + 20;
        } catch { /* ข้าม */ }
      }
      const fSize = Math.round(barH * 0.26);
      ctx.textBaseline = "middle";
      ctx.font = `900 ${fSize}px ${FONT}`;
      ctx.fillStyle = "#FFD200";
      ctx.fillText(`📞 ${phone}`, tx, by + barH * 0.36);
      ctx.font = `600 ${Math.round(fSize * 0.78)}px ${FONT}`;
      ctx.fillStyle = "#fff";
      ctx.fillText(`f  ${fb}`, tx, by + barH * 0.68);
      ctx.textBaseline = "top";
    }
    setRendering(false);
  }, [bg, dims.w, dims.h, headline, subhead, bullets, phone, fb, showBar, showLogo]);

  useEffect(() => { setRendering(true); const t = setTimeout(draw, 120); return () => clearTimeout(t); }, [draw]);

  function exportDataUrl(): string {
    return canvasRef.current?.toDataURL("image/png") ?? "";
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modal }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 420px) 300px", gap: 20 }}>
          <div>
            <canvas ref={canvasRef} style={{ width: "100%", borderRadius: 8, border: "1px solid #ddd", background: "#111" }} />
            {rendering && <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>กำลังเรนเดอร์...</p>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>📝 ใส่ข้อความบนภาพ</h3>
            <Field label="พาดหัว"><textarea value={headline} onChange={e => setHeadline(e.target.value)} rows={2} style={ta} /></Field>
            <Field label="ข้อความรอง"><textarea value={subhead} onChange={e => setSubhead(e.target.value)} rows={2} style={ta} /></Field>
            <Field label="จุดเด่น (บรรทัดละข้อ · สูงสุด 5)"><textarea value={bullets} onChange={e => setBullets(e.target.value)} rows={5} style={ta} /></Field>
            <div style={{ display: "flex", gap: 8 }}>
              <Field label="เบอร์โทร"><input value={phone} onChange={e => setPhone(e.target.value)} style={{ ...inputStyle, height: 34 }} /></Field>
            </div>
            <Field label="Facebook"><input value={fb} onChange={e => setFb(e.target.value)} style={{ ...inputStyle, height: 34 }} /></Field>
            <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
              <label><input type="checkbox" checked={showBar} onChange={e => setShowBar(e.target.checked)} /> แถบล่าง</label>
              <label><input type="checkbox" checked={showLogo} onChange={e => setShowLogo(e.target.checked)} /> โลโก้</label>
            </div>
            <div style={{ borderTop: "1px solid #eee", paddingTop: 10, marginTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => { const d = exportDataUrl(); if (d) { const a = document.createElement("a"); a.href = d; a.download = `dk-poster-${Date.now()}.png`; a.click(); } }} style={btnDark}>⬇ ดาวน์โหลด PNG</button>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={pid} onChange={e => setPid(e.target.value)} style={{ ...inputStyle, flex: 1, height: 34, fontSize: 12 }}>
                  <option value="">— เซฟเข้าสินค้า —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.category} · {p.name}</option>)}
                </select>
                <button disabled={!pid} onClick={() => { const d = exportDataUrl(); if (d && pid) { onSave(d, Number(pid)); } }} style={{ ...btnPrimary, opacity: pid ? 1 : 0.5 }}>เซฟ</button>
              </div>
              <button onClick={onClose} style={btnGhost}>ปิด</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ flex: 1 }}><label style={lbl}>{label}</label>{children}</div>;
}

// ============================================================
// helpers
// ============================================================
const FONT = `"Leelawadee UI", "Tahoma", "Sarabun", system-ui, sans-serif`;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height, r = w / h;
  let sw = img.width, sh = img.height, sx = 0, sy = 0;
  if (ir > r) { sw = img.height * r; sx = (img.width - sw) / 2; }
  else { sh = img.width / r; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/(\s+)/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (ctx.measureText(cur + w).width > maxW && cur) { lines.push(cur.trim()); cur = w; }
    else cur += w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.length ? lines : [text];
}
function maxLineWidth(ctx: CanvasRenderingContext2D, lines: string[]): number {
  return Math.max(...lines.map(l => ctx.measureText(l).width));
}

// ---- styles ----
const inputStyle: React.CSSProperties = { width: "100%", padding: 10, fontSize: 14, border: "1px solid #ccc", borderRadius: 8, boxSizing: "border-box" };
const ta: React.CSSProperties = { ...inputStyle, resize: "vertical", fontFamily: FONT };
const btnPrimary: React.CSSProperties = { padding: "10px 16px", fontSize: 14, borderRadius: 8, border: "none", background: "#E05A17", color: "#fff", cursor: "pointer", fontWeight: 700 };
const btnDark: React.CSSProperties = { padding: "10px 14px", fontSize: 14, borderRadius: 8, border: "none", background: "#0a163c", color: "#fff", cursor: "pointer" };
const btnGhost: React.CSSProperties = { padding: "8px 14px", fontSize: 13, borderRadius: 8, border: "1px solid #ccc", background: "#fff", color: "#333", cursor: "pointer" };
const panel: React.CSSProperties = { border: "1px solid #e5e5e5", borderRadius: 14, padding: 18, marginTop: 16, background: "#fafafa" };
const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 6 };
const hint: React.CSSProperties = { fontSize: 11, color: "#999", marginTop: 6, marginBottom: 0 };
const uploadBox: React.CSSProperties = { display: "grid", placeItems: "center", width: "100%", aspectRatio: "1/1", border: "2px dashed #ccc", borderRadius: 10, cursor: "pointer", backgroundSize: "cover", backgroundPosition: "center" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 20, maxWidth: 800, width: "100%", maxHeight: "92vh", overflow: "auto", fontFamily: FONT };
function chip(active: boolean, disabled: boolean): React.CSSProperties {
  return { padding: "8px 12px", fontSize: 13, borderRadius: 8, border: active ? "2px solid #E05A17" : "1px solid #ccc", background: disabled ? "#f0f0f0" : active ? "#fff3ec" : "#fff", color: disabled ? "#aaa" : "#333", cursor: disabled ? "not-allowed" : "pointer", fontWeight: active ? 700 : 400 };
}
