"use client";
import { useState, useEffect } from "react";

const LINE_URL   = "https://line.me/R/ti/p/@629jbwyj";
const LINE_ID    = "@629jbwyj";
const PHONE_MAIN = "075-845177";

const TEAM = [
  { name: "คุณเก๋",   phone: "094-651-4309" },
  { name: "คุณหญิง", phone: "088-760-8470" },
  { name: "คุณแพรว", phone: "065-209-4955" },
  { name: "คุณลัย",  phone: "095-023-6382" },
  { name: "คุณมีน",  phone: "094-629-351"  },
];

const PRODUCTS = [
  {
    icon: "🔩", name: "เหล็ก",
    desc: "เหล็กโครงสร้าง เหล็กเส้น เหล็กรูปพรรณ ครบทุกขนาด",
    from: "#1565C0", to: "#1976D2",
  },
  {
    icon: "🔧", name: "เครื่องมือช่าง",
    desc: "อุปกรณ์ช่าง เครื่องมือไฟฟ้าคุณภาพสูง ครบครัน",
    from: "#6A1B9A", to: "#8E24AA",
  },
  {
    icon: "🏗️", name: "เมทัลชีท",
    desc: "หลังคาเมทัลชีท แผ่นเหล็กรีดลอน หลากหลายสี",
    from: "#00695C", to: "#00897B",
  },
  {
    icon: "💧", name: "ท่อ PVC",
    desc: "ท่อน้ำ ท่อระบาย อุปกรณ์ประปาครบชุด",
    from: "#0277BD", to: "#0288D1",
  },
  {
    icon: "⚙️", name: "ปั๊มน้ำ",
    desc: "ปั๊มน้ำทุกชนิด ปั๊มซัมเมิร์ส ทนทาน ใช้งานได้นาน",
    from: "#C62828", to: "#E53935",
  },
  {
    icon: "🔌", name: "เครื่องยนต์",
    desc: "เครื่องยนต์เบนซิน ดีเซล เจนเนอเรเตอร์ทุกขนาด",
    from: "#E65100", to: "#F57C00",
  },
];

const WHY_DK = [
  {
    icon: "✅",
    title: "สินค้าคุณภาพ มีมาตรฐาน",
    desc: "คัดสรรสินค้าคุณภาพสูง ผ่านการตรวจสอบ มีมาตรฐานงานก่อสร้าง",
    color: "#1565C0",
    bg: "#E3F2FD",
  },
  {
    icon: "📦",
    title: "สต็อกสินค้าครบ พร้อมส่ง",
    desc: "สต็อกสินค้าพร้อมส่งเสมอ ไม่ต้องรอนาน รองรับทั้งปลีกและส่ง",
    color: "#2E7D32",
    bg: "#E8F5E9",
  },
  {
    icon: "💬",
    title: "ทีมขายผู้เชี่ยวชาญ",
    desc: "ทีมงานมีประสบการณ์ ให้คำปรึกษาเรื่องวัสดุก่อสร้างได้ตรงจุด",
    color: "#6A1B9A",
    bg: "#F3E5F5",
  },
  {
    icon: "💰",
    title: "ราคาดี คุ้มค่า",
    desc: "ราคายุติธรรม เปรียบเทียบได้ มีโปรโมชันสำหรับลูกค้าประจำ",
    color: "#E65100",
    bg: "#FFF3E0",
  },
];

export default function HomePage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        a { text-decoration: none; color: inherit; }

        .nav-link {
          color: white; font-weight: 600; font-size: 15px; cursor: pointer;
          padding: 6px 4px; border-bottom: 2px solid transparent;
          transition: border-color 0.2s;
        }
        .nav-link:hover { border-color: #FFD600; }

        .hero-btn-primary {
          background: #FFD600; color: #0D1B6E; font-weight: 800;
          padding: 17px 38px; border-radius: 50px; font-size: 16px;
          border: none; cursor: pointer; font-family: inherit;
          box-shadow: 0 6px 24px rgba(255,214,0,0.5);
          transition: transform 0.15s, box-shadow 0.15s;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .hero-btn-primary:hover { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(255,214,0,0.6); }

        .hero-btn-outline {
          background: rgba(255,255,255,0.12); color: white; font-weight: 700;
          padding: 17px 38px; border-radius: 50px; font-size: 16px;
          border: 2px solid rgba(255,255,255,0.5); cursor: pointer;
          font-family: inherit; transition: background 0.2s;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .hero-btn-outline:hover { background: rgba(255,255,255,0.2); }

        /* Product card */
        .product-card {
          background: white; border-radius: 20px; overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.09);
          transition: transform 0.22s, box-shadow 0.22s;
        }
        .product-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.15);
        }
        .product-card-img {
          height: 160px; display: flex; align-items: center;
          justify-content: center; font-size: 64px; position: relative;
          overflow: hidden;
        }
        .product-card-img::after {
          content: ''; position: absolute; inset: 0;
          background: rgba(0,0,0,0.08);
        }

        /* Why DK card */
        .why-card {
          border-radius: 20px; padding: 32px 28px;
          display: flex; flex-direction: column; gap: 12;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .why-card:hover { transform: translateY(-4px); box-shadow: 0 10px 32px rgba(0,0,0,0.1); }

        /* Team card */
        .team-card {
          background: white; border-radius: 16px; padding: 18px 20px;
          display: flex; align-items: center; gap: 14;
          box-shadow: 0 2px 12px rgba(0,0,0,0.07);
          transition: transform 0.15s, box-shadow 0.15s;
          text-decoration: none;
        }
        .team-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(21,101,192,0.15); }

        .line-cta-btn {
          display: inline-flex; align-items: center; gap: 10;
          background: #06C755; color: white;
          font-weight: 800; padding: 18px 48px; border-radius: 50px;
          font-size: 18px; font-family: inherit; border: none; cursor: pointer;
          box-shadow: 0 6px 24px rgba(6,199,85,0.45);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .line-cta-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(6,199,85,0.55); }

        /* Blueprint dot pattern */
        .blueprint-bg {
          background-image: radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        /* section label */
        .section-label {
          font-size: 12px; font-weight: 800; letter-spacing: 3px;
          text-transform: uppercase; margin-bottom: 12px;
        }

        @media (max-width: 900px) {
          .products-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .why-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .contact-grid { grid-template-columns: 1fr !important; }
          .hero-float { display: none !important; }
        }
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .hamburger { display: flex !important; }
          .hero-title { font-size: 38px !important; }
          .hero-btns { flex-direction: column !important; align-items: stretch !important; }
          .stat-row { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 520px) {
          .products-grid { grid-template-columns: 1fr !important; }
          .why-grid { grid-template-columns: 1fr !important; }
          .hero-title { font-size: 32px !important; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: navScrolled ? "rgba(13,27,110,0.96)" : "transparent",
        backdropFilter: navScrolled ? "blur(16px)" : "none",
        boxShadow: navScrolled ? "0 2px 24px rgba(0,0,0,0.25)" : "none",
        transition: "all 0.3s",
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => scrollTo("hero")}>
            <div style={{
              width: 42, height: 42, background: "linear-gradient(135deg,#FFD600,#FFA000)",
              borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              boxShadow: "0 3px 10px rgba(255,160,0,0.4)",
            }}>🏗️</div>
            <div>
              <div style={{ color: "white", fontWeight: 900, fontSize: 19, lineHeight: 1.1 }}>DK วัสดุก่อสร้าง</div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, letterSpacing: 1 }}>DK BUILDING MATERIALS</div>
            </div>
          </div>

          <div className="nav-links" style={{ display: "flex", gap: 36, alignItems: "center" }}>
            {[["สินค้า","products"],["เกี่ยวกับเรา","why"],["ติดต่อ","contact"]].map(([label, id]) => (
              <span key={id} className="nav-link" onClick={() => scrollTo(id)}>{label}</span>
            ))}
            <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{
              background: "#06C755", color: "white", fontWeight: 700,
              padding: "9px 22px", borderRadius: 24, fontSize: 14,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              💬 เพิ่มเพื่อน
            </a>
          </div>

          <button
            className="hamburger"
            style={{ display: "none", flexDirection: "column", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 8 }}
            onClick={() => setMenuOpen(o => !o)}
          >
            {[0,1,2].map(i => (
              <span key={i} style={{ display: "block", width: 26, height: 2, background: "white", borderRadius: 2 }} />
            ))}
          </button>
        </div>

        {menuOpen && (
          <div style={{
            display: "flex", flexDirection: "column",
            background: "rgba(13,27,110,0.98)", borderTop: "1px solid rgba(255,255,255,0.1)",
          }}>
            {[["สินค้า","products"],["เกี่ยวกับเรา","why"],["ติดต่อ","contact"]].map(([label, id]) => (
              <span key={id} onClick={() => scrollTo(id)} style={{
                color: "white", fontWeight: 600, fontSize: 16,
                padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", cursor: "pointer",
              }}>{label}</span>
            ))}
            <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{
              margin: 16, background: "#06C755", color: "white", fontWeight: 700,
              padding: "14px 0", borderRadius: 12, fontSize: 16, textAlign: "center",
            }}>💬 เพิ่มเพื่อน LINE</a>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section id="hero" style={{
        minHeight: "100vh", position: "relative", overflow: "hidden",
        background: "linear-gradient(145deg, #07125C 0%, #0D2080 35%, #1565C0 75%, #1E88E5 100%)",
        display: "flex", alignItems: "center",
        padding: "120px 24px 80px",
      }}>
        {/* Blueprint dot overlay */}
        <div className="blueprint-bg" style={{ position: "absolute", inset: 0, zIndex: 0 }} />

        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -120, right: -120, width: 480, height: 480, borderRadius: "50%", background: "rgba(255,214,0,0.06)", zIndex: 0 }} />
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 340, height: 340, borderRadius: "50%", background: "rgba(255,255,255,0.04)", zIndex: 0 }} />
        <div style={{ position: "absolute", top: "30%", right: "15%", width: 180, height: 180, borderRadius: "50%", border: "2px solid rgba(255,214,0,0.15)", zIndex: 0 }} />
        <div style={{ position: "absolute", top: "25%", right: "12%", width: 240, height: 240, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)", zIndex: 0 }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 60, justifyContent: "space-between" }}>

          {/* Left text */}
          <div style={{ flex: 1, maxWidth: 620 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,214,0,0.15)", color: "#FFD600",
              border: "1px solid rgba(255,214,0,0.3)", borderRadius: 24,
              padding: "6px 18px", fontSize: 13, fontWeight: 700, marginBottom: 28, letterSpacing: 1,
            }}>
              <span>🏗️</span> วัสดุก่อสร้างครบวงจร
            </div>

            <h1 className="hero-title" style={{
              color: "white", fontSize: 56, fontWeight: 900,
              lineHeight: 1.15, margin: "0 0 24px",
            }}>
              ร้าน DK<br />
              <span style={{ color: "#FFD600" }}>วัสดุก่อสร้าง</span>
            </h1>

            <p style={{
              color: "rgba(255,255,255,0.78)", fontSize: 18, lineHeight: 1.75,
              margin: "0 0 44px", maxWidth: 520,
            }}>
              จำหน่ายวัสดุก่อสร้างคุณภาพสูงครบวงจร — เหล็ก เครื่องมือช่าง เมทัลชีท ท่อ PVC ปั๊มน้ำ และเครื่องยนต์ โดยทีมผู้เชี่ยวชาญพร้อมให้คำแนะนำ
            </p>

            <div className="hero-btns" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <a href={LINE_URL} target="_blank" rel="noopener noreferrer">
                <button className="hero-btn-primary">
                  <span>💬</span> เพิ่มเพื่อน LINE {LINE_ID}
                </button>
              </a>
              <button className="hero-btn-outline" onClick={() => scrollTo("contact")}>
                <span>📞</span> ติดต่อทีมขาย
              </button>
            </div>

            {/* Trust badges */}
            <div style={{ marginTop: 48, display: "flex", gap: 28, flexWrap: "wrap" }}>
              {[["🔩","สินค้าครบ"],["⚡","บริการรวดเร็ว"],["🏆","ประสบการณ์ 10+ ปี"]].map(([icon, label]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 600 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span> {label}
                </div>
              ))}
            </div>
          </div>

          {/* Right — floating visual card */}
          <div className="hero-float" style={{ flexShrink: 0, width: 340 }}>
            {/* Main visual card */}
            <div style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 28, padding: "32px 28px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", fontWeight: 600, marginBottom: 20, letterSpacing: 1 }}>
                สินค้าของเรา
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {PRODUCTS.map(({ icon, name, from, to }) => (
                  <div key={name} style={{
                    background: `linear-gradient(135deg, ${from}, ${to})`,
                    borderRadius: 16, padding: "18px 14px", textAlign: "center",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                  }}>
                    <div style={{ fontSize: 30, marginBottom: 6 }}>{icon}</div>
                    <div style={{ color: "white", fontSize: 12, fontWeight: 700 }}>{name}</div>
                  </div>
                ))}
              </div>
              {/* Line contact mini */}
              <div style={{
                marginTop: 20, background: "#06C755", borderRadius: 14,
                padding: "14px 16px", display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 22 }}>💚</span>
                <div>
                  <div style={{ color: "white", fontSize: 12, fontWeight: 600, opacity: 0.85 }}>LINE Official</div>
                  <div style={{ color: "white", fontSize: 15, fontWeight: 800 }}>{LINE_ID}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div style={{ background: "#0D1B6E" }}>
        <div className="stat-row" style={{
          maxWidth: 1200, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          padding: "0 24px",
        }}>
          {[
            ["6+","หมวดสินค้า","🛒"],
            ["10+","ปีประสบการณ์","🏆"],
            ["5","ทีมขายผู้เชี่ยวชาญ","👥"],
            ["24/7","ตอบ LINE ทุกวัน","💬"],
          ].map(([num, label, icon]) => (
            <div key={label} style={{
              padding: "28px 20px", textAlign: "center",
              borderRight: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
              <div style={{ color: "#FFD600", fontSize: 32, fontWeight: 900 }}>{num}</div>
              <div style={{ color: "rgba(255,255,255,0.60)", fontSize: 13, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Products ── */}
      <section id="products" style={{ padding: "100px 24px", background: "#F4F6FB" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div className="section-label" style={{ color: "#1565C0" }}>PRODUCTS</div>
            <h2 style={{ fontSize: 40, fontWeight: 900, color: "#07125C", margin: "0 0 16px" }}>สินค้าของเรา</h2>
            <p style={{ color: "#607D8B", fontSize: 17, maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
              วัสดุก่อสร้างคุณภาพสูง คัดสรรมาอย่างดี ตอบโจทย์งานทุกรูปแบบ
            </p>
          </div>

          <div className="products-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24,
          }}>
            {PRODUCTS.map(({ icon, name, desc, from, to }) => (
              <div key={name} className="product-card">
                {/* Gradient image header */}
                <div className="product-card-img" style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}>
                  <span style={{ position: "relative", zIndex: 1, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>
                    {icon}
                  </span>
                  {/* Subtle diagonal stripe */}
                  <div style={{
                    position: "absolute", top: 0, right: 0, width: 80, height: 80,
                    background: "rgba(255,255,255,0.08)",
                    clipPath: "polygon(100% 0, 0 0, 100% 100%)",
                  }} />
                </div>
                {/* Body */}
                <div style={{ padding: "24px 24px 28px" }}>
                  <div style={{ fontSize: 19, fontWeight: 800, color: "#07125C", marginBottom: 10 }}>{name}</div>
                  <div style={{ fontSize: 14, color: "#607D8B", lineHeight: 1.7 }}>{desc}</div>
                  <div style={{ marginTop: 18 }}>
                    <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: 13, fontWeight: 700, color: from,
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      สอบถามราคา →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why DK ── */}
      <section id="why" style={{
        padding: "100px 24px",
        background: "linear-gradient(160deg, #07125C 0%, #1A237E 100%)",
        position: "relative", overflow: "hidden",
      }}>
        <div className="blueprint-bg" style={{ position: "absolute", inset: 0, opacity: 0.5 }} />
        <div style={{ position: "absolute", bottom: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "rgba(255,214,0,0.05)" }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div className="section-label" style={{ color: "#FFD600" }}>WHY DK</div>
            <h2 style={{ fontSize: 40, fontWeight: 900, color: "white", margin: "0 0 16px" }}>ทำไมต้องเลือก DK?</h2>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 17, maxWidth: 460, margin: "0 auto", lineHeight: 1.7 }}>
              เราให้มากกว่าแค่วัสดุก่อสร้าง — เราเป็นพาร์ทเนอร์ที่ไว้ใจได้ของคุณ
            </p>
          </div>

          <div className="why-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20,
          }}>
            {WHY_DK.map(({ icon, title, desc, color, bg }) => (
              <div key={title} className="why-card" style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 22, padding: "32px 24px",
                backdropFilter: "blur(8px)",
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: bg, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 26, marginBottom: 18,
                }}>
                  {icon}
                </div>
                <div style={{ color: "white", fontWeight: 800, fontSize: 17, marginBottom: 10, lineHeight: 1.3 }}>{title}</div>
                <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 14, lineHeight: 1.7 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <div style={{ background: "#FFD600", padding: "56px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h3 style={{ fontSize: 30, fontWeight: 900, color: "#07125C", margin: "0 0 12px" }}>
            พร้อมให้บริการทุกวัน 💬
          </h3>
          <p style={{ color: "#1A237E", fontSize: 17, margin: "0 0 32px", opacity: 0.85 }}>
            ทักมาถามราคา สอบถามสินค้า หรือขอคำแนะนำได้เลย ไม่มีค่าใช้จ่าย
          </p>
          <a href={LINE_URL} target="_blank" rel="noopener noreferrer">
            <button className="line-cta-btn" style={{ background: "#07125C", boxShadow: "0 6px 24px rgba(7,18,92,0.35)" }}>
              <span style={{ fontSize: 22 }}>💬</span> เพิ่มเพื่อน LINE {LINE_ID}
            </button>
          </a>
        </div>
      </div>

      {/* ── Contact ── */}
      <section id="contact" style={{ padding: "100px 24px", background: "#F4F6FB" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div className="section-label" style={{ color: "#1565C0" }}>CONTACT</div>
            <h2 style={{ fontSize: 40, fontWeight: 900, color: "#07125C", margin: "0 0 16px" }}>ติดต่อเรา</h2>
            <p style={{ color: "#607D8B", fontSize: 17 }}>พร้อมให้บริการและให้คำปรึกษา ทุกวัน</p>
          </div>

          <div className="contact-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>

            {/* Left */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Main phone card */}
              <div style={{
                background: "linear-gradient(135deg, #07125C 0%, #1565C0 100%)",
                borderRadius: 22, padding: "28px 30px",
                boxShadow: "0 8px 32px rgba(7,18,92,0.25)",
              }}>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 700, marginBottom: 10, letterSpacing: 1 }}>
                  📞 โทรศัพท์ร้าน
                </div>
                <a href={`tel:${PHONE_MAIN.replace(/-/g,"")}`} style={{
                  color: "#FFD600", fontSize: 34, fontWeight: 900, display: "block",
                }}>
                  {PHONE_MAIN}
                </a>
              </div>

              {/* LINE card */}
              <div style={{
                background: "white", borderRadius: 22, padding: "28px 30px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                display: "flex", alignItems: "center", gap: 20,
              }}>
                <div style={{
                  width: 60, height: 60, background: "#06C755", borderRadius: 16,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
                  flexShrink: 0,
                }}>💚</div>
                <div>
                  <div style={{ color: "#607D8B", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>LINE Official Account</div>
                  <div style={{ color: "#07125C", fontSize: 22, fontWeight: 900 }}>{LINE_ID}</div>
                  <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{
                    display: "inline-block", marginTop: 10, background: "#06C755",
                    color: "white", fontWeight: 700, padding: "8px 20px",
                    borderRadius: 20, fontSize: 13,
                  }}>
                    เพิ่มเพื่อน →
                  </a>
                </div>
              </div>
            </div>

            {/* Right — Team */}
            <div style={{
              background: "white", borderRadius: 22, padding: "28px 28px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#07125C", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                👥 ทีมขาย
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {TEAM.map(({ name, phone }, i) => (
                  <a key={name} href={`tel:${phone.replace(/-/g,"")}`} className="team-card">
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                      background: `linear-gradient(135deg, ${["#1565C0","#6A1B9A","#00695C","#C62828","#E65100"][i % 5]}, ${["#1976D2","#8E24AA","#00897B","#E53935","#F57C00"][i % 5]})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "white", fontSize: 16, fontWeight: 800,
                    }}>
                      {name.replace("คุณ","")[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#07125C", fontSize: 14 }}>{name}</div>
                      <div style={{ color: "#1565C0", fontSize: 13, fontWeight: 600, marginTop: 2 }}>{phone}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#07125C", padding: "48px 24px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, background: "linear-gradient(135deg,#FFD600,#FFA000)",
              borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            }}>🏗️</div>
            <div>
              <div style={{ color: "white", fontWeight: 900, fontSize: 19 }}>DK วัสดุก่อสร้าง</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 1 }}>DK BUILDING MATERIALS</div>
            </div>
          </div>

          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 8 }}>
            เหล็ก · เครื่องมือช่าง · เมทัลชีท · ท่อ PVC · ปั๊มน้ำ · เครื่องยนต์
          </div>
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 24 }}>
            โทร {PHONE_MAIN} &nbsp;|&nbsp; LINE {LINE_ID}
          </div>

          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 20,
            textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 12,
          }}>
            © {new Date().getFullYear()} DK วัสดุก่อสร้าง · All rights reserved
          </div>
        </div>
      </footer>
    </>
  );
}
