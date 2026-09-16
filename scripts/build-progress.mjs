// สร้างหน้าความคืบหน้าแบบสด สำหรับเจ้าของร้าน (ไม่ใช่โปรแกรมเมอร์)
//   node scripts/build-progress.mjs
// อ่านของจริงจาก: review/<รอบ>/index.json, review/<รอบ>/codex/*.json, progress/state.json
// เขียนออก: progress/index.html  (+ สร้าง progress/state.json ตั้งต้นให้ถ้ายังไม่มี)
// เปิดด้วย file:// ได้ ไม่ใช้ CDN ไม่ใช้ JS ที่ต้องมีเซิร์ฟเวอร์

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REVIEW_DIR = path.join(ROOT, "review");
const PROGRESS_DIR = path.join(ROOT, "progress");
const STATE_FILE = path.join(PROGRESS_DIR, "state.json");
const OUT_FILE = path.join(PROGRESS_DIR, "index.html");

/* ---------- ชิ้นงานตั้งต้นตามบรีฟ (P9 เลื่อนออก ไม่นับ) ---------- */
const PIECES = [
  { id: "P0", name: "ระบบดีไซน์ร่วม", scope: "สี ฟอนต์ ปุ่ม การ์ด ให้ทุกหน้าหน้าตาเป็นชุดเดียวกัน" },
  { id: "P1", name: "หน้าแรกก่อนสมัคร", scope: "ลูกค้าใหม่เปิดมาเห็นว่าได้อะไร 3 ข้อ + ปุ่มสมัครเดียว" },
  { id: "P2", name: "ขั้นสมัคร", scope: "กรอกเบอร์/ชื่อ/วันเกิด · จอรอพนักงานยืนยัน · ข้อความเตือนเป็นภาษาคน" },
  { id: "P3", name: "บัตรสมาชิก/แดชบอร์ด", scope: "แต้ม ระดับ อีกเท่าไหร่เลื่อนขั้น สิทธิ์ตอนนี้ แต้มใกล้หมดอายุ" },
  { id: "P4", name: "หน้าสิทธิ์ตามระดับ", scope: "ตารางเดียวกับป้าย A4 ไฮไลต์ระดับของฉัน" },
  { id: "P5", name: "ประวัติแต้ม", scope: "บิล→แต้ม โบนัส วันเกิด แลกรางวัล หมดอายุ อ้างเลขบิลได้" },
  { id: "P6", name: "รางวัลและการแลก", scope: "แคตตาล็อก ปุ่มแลก จอยืนยัน โค้ดให้แคชเชียร์ สถานะรอรับ/รับแล้ว" },
  { id: "P7", name: "ข้อความ LINE ทุกแบบ", scope: "ต้อนรับ ผูกรหัส แต้มเข้า เลื่อนระดับ วันเกิด ใกล้หมดอายุ แลกสำเร็จ" },
  { id: "P8", name: "ฝั่งแคชเชียร์/แอดมิน", scope: "ยืนยันผูกรหัส ยืนยันรับรางวัล ค้นลูกค้าด้วยเบอร์ 3 ตัวท้าย" },
];

/* ภาพตัวแทนของแต่ละชิ้น — เลือกจากรอบล่าสุดที่มีภาพนั้น (ลองไล่ตามลำดับ) */
const PIECE_SHOTS = {
  P0: [["gold2300", "liff", "mobile"], ["bronze120", "liff", "mobile"]],
  P1: [["new", "liff", "mobile"], ["new", "liff", "desktop"]],
  P2: [["pending", "liff", "mobile"], ["new", "liff", "mobile"]],
  P3: [["gold2300", "liff", "mobile"], ["bronze120", "liff", "mobile"]],
  P4: [["bronze120", "liff", "mobile"], ["diamond", "liff", "mobile"]],
  P5: [["gold2300", "liff:history", "mobile"], ["bronze120", "liff:history", "mobile"]],
  P6: [["bronze120", "rewards", "mobile"], ["gold2300", "rewards", "mobile"], ["new", "rewards", "mobile"]],
  P7: [],
  P8: [],
};

const STATUSES = ["ยังไม่เริ่ม", "กำลังทำ", "รอตรวจ", "ผ่าน", "ติด"];
const STATUS_KEY = { "ยังไม่เริ่ม": "todo", "กำลังทำ": "doing", "รอตรวจ": "review", "ผ่าน": "pass", "ติด": "stuck" };
const SCORE_LABELS = {
  hierarchy: "ลำดับสายตา",
  typography: "ตัวอักษร",
  spacing: "ระยะห่าง",
  color: "สี/contrast",
  consistency: "ความสม่ำเสมอ",
  usability: "ความง่าย",
};

/* ---------- เครื่องมือเล็กๆ ---------- */
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function mtime(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function thaiTime(ms) {
  if (!ms) return "-";
  const d = new Date(ms);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** แปลง path ในเครื่อง (อาจเป็น backslash / absolute) ให้เป็น relative จากโฟลเดอร์ progress */
function relFromProgress(p) {
  if (!p) return null;
  const abs = path.isAbsolute(p) ? p : path.join(ROOT, String(p).replace(/\\/g, path.sep));
  if (!fs.existsSync(abs)) return null;
  return path.relative(PROGRESS_DIR, abs).split(path.sep).map(encodeURIComponent).join("/");
}

/* ---------- state.json ---------- */
function defaultState() {
  return {
    _อ่านก่อน: "ไฟล์นี้คนทำงานแก้เอง แล้วรัน  node scripts/build-progress.mjs  เพื่ออัปเดตหน้าเว็บ",
    _สถานะที่ใช้ได้: STATUSES,
    updatedAt: new Date().toISOString(),
    round: "",
    note: "",
    pieces: PIECES.map((p, i) => ({
      id: p.id,
      name: p.name,
      scope: p.scope,
      status: i === 0 ? "กำลังทำ" : "ยังไม่เริ่ม",
      round: "",
      note: "",
      shot: "",
    })),
    changes: [],
  };
}

function loadState() {
  fs.mkdirSync(PROGRESS_DIR, { recursive: true });
  let state = readJson(STATE_FILE);
  let created = false;
  if (!state || !Array.isArray(state.pieces)) {
    state = defaultState();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
    created = true;
  }
  // เติมชิ้นที่ขาด / ปรับค่าที่พิมพ์ผิดให้ไม่พัง
  const byId = new Map(state.pieces.filter((p) => p && p.id).map((p) => [p.id, p]));
  state.pieces = PIECES.map((def) => {
    const cur = byId.get(def.id) || {};
    const status = STATUSES.includes(cur.status) ? cur.status : "ยังไม่เริ่ม";
    return {
      id: def.id,
      name: cur.name || def.name,
      scope: cur.scope || def.scope,
      status,
      round: cur.round || "",
      note: cur.note || "",
      shot: cur.shot || "",
    };
  });
  state.changes = Array.isArray(state.changes) ? state.changes : [];
  return { state, created };
}

/* ---------- อ่านผลรีวิวจริง ---------- */
function roundOrder(name) {
  const m = /^r(\d+)/i.exec(name);
  return m ? Number(m[1]) : 9999; // ไม่มีเลข (เช่น final) ให้ไปท้ายสุด
}

function loadRounds() {
  if (!fs.existsSync(REVIEW_DIR)) return [];
  let dirs = [];
  try {
    dirs = fs
      .readdirSync(REVIEW_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
  dirs.sort((a, b) => roundOrder(a) - roundOrder(b) || a.localeCompare(b));

  return dirs.map((name) => {
    const dir = path.join(REVIEW_DIR, name);
    const indexFile = path.join(dir, "index.json");
    const idx = readJson(indexFile) || {};
    const shots = Array.isArray(idx.shots) ? idx.shots : [];
    const errors = Array.isArray(idx.errors) ? idx.errors : [];
    const consoleErrors = shots.reduce((n, s) => n + ((Array.isArray(s.consoleErrors) && s.consoleErrors.length) || 0), 0);

    // ผลตรวจจาก codex
    const codexDir = path.join(dir, "codex");
    const reviews = [];
    if (fs.existsSync(codexDir)) {
      let files = [];
      try {
        files = fs.readdirSync(codexDir).filter((f) => f.toLowerCase().endsWith(".json"));
      } catch {
        files = [];
      }
      for (const f of files) {
        const j = readJson(path.join(codexDir, f));
        if (!j) continue;
        const res = j.result || {};
        const scores = res.scores && typeof res.scores === "object" ? res.scores : null;
        const nums = scores ? Object.values(scores).filter((v) => typeof v === "number") : [];
        const piece = j.piece || (/^([Pp]\d+)/.exec(f) || [])[1] || "?";
        reviews.push({
          file: f,
          piece: String(piece).toUpperCase(),
          role: j.role || "",
          scores,
          min: nums.length ? Math.min(...nums) : null,
          avg: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null,
          biggestGap: res.biggest_gap || res.biggestGap || "",
          gapLocation: res.gap_location || "",
          verdict: (res.verdict || "").toString().toLowerCase().startsWith("pass")
            ? "pass"
            : (res.verdict || "").toString().toLowerCase().startsWith("fail")
            ? "fail"
            : "",
          parsedOk: j.parsed_ok !== false,
          time: mtime(path.join(codexDir, f)),
        });
      }
      reviews.sort((a, b) => a.time - b.time);
    }

    return {
      name,
      dir,
      shots,
      errors,
      consoleErrors,
      reviews,
      time: Math.max(mtime(indexFile), mtime(dir)),
      hasIndex: fs.existsSync(indexFile),
    };
  });
}

/* ---------- ประกอบข้อมูลต่อชิ้น ---------- */
function pickShot(piece, rounds) {
  if (piece.shot) {
    const r = relFromProgress(piece.shot);
    if (r) return { href: r, round: "ระบุเอง" };
  }
  const wanted = PIECE_SHOTS[piece.id] || [];
  for (let i = rounds.length - 1; i >= 0; i--) {
    const round = rounds[i];
    for (const [scenario, page, view] of wanted) {
      const hit = round.shots.find((s) => s.scenario === scenario && s.page === page && s.view === view);
      const href = hit && relFromProgress(hit.file);
      if (href) return { href, round: round.name, scenario, page, view };
    }
  }
  return null;
}

function build() {
  const { state, created } = loadState();
  const rounds = loadRounds();
  const latestRound = rounds.length ? rounds[rounds.length - 1] : null;

  const pieces = state.pieces.map((p) => {
    const mine = [];
    for (const r of rounds) for (const rv of r.reviews) if (rv.piece === p.id) mine.push({ ...rv, round: r.name });
    const last = mine.length ? mine[mine.length - 1] : null;
    return {
      ...p,
      statusKey: STATUS_KEY[p.status] || "todo",
      round: p.round || (last ? last.round : ""),
      last,
      reviewCount: mine.length,
      shot: pickShot(p, rounds),
    };
  });

  const passed = pieces.filter((p) => p.status === "ผ่าน").length;
  const stuck = pieces.filter((p) => p.status === "ติด").length;
  const doing = pieces.filter((p) => p.status === "กำลังทำ" || p.status === "รอตรวจ").length;

  /* ---------- สิ่งที่เพิ่งเปลี่ยน ---------- */
  const events = [];
  for (const r of rounds) {
    if (r.hasIndex) {
      const bad = r.errors.length + r.consoleErrors;
      events.push({
        time: r.time,
        kind: "shot",
        text: `ถ่ายภาพหน้าจอรอบ ${r.name} ครบ ${r.shots.length} ภาพ` + (bad ? ` · พบปัญหา ${bad} จุด` : " · ไม่มีปัญหา"),
      });
    }
    for (const rv of r.reviews) {
      const score = rv.avg != null ? ` คะแนนเฉลี่ย ${rv.avg.toFixed(1)} (ต่ำสุด ${rv.min})` : "";
      const verdict = rv.verdict === "pass" ? "ผ่าน" : rv.verdict === "fail" ? "ยังไม่ผ่าน" : "ไม่มีผลชี้ขาด";
      events.push({ time: rv.time, kind: rv.verdict === "pass" ? "pass" : "check", text: `ผลตรวจ ${rv.piece} รอบ ${r.name}: ${verdict}${score}` });
    }
  }
  for (const c of state.changes) {
    if (!c) continue;
    const t = c.time ? Date.parse(c.time) : 0;
    events.push({ time: Number.isFinite(t) && t > 0 ? t : 0, kind: c.kind || "note", text: c.text || String(c) });
  }
  const stateTime = mtime(STATE_FILE);
  events.push({ time: stateTime, kind: "note", text: `อัปเดตสถานะชิ้นงานล่าสุด (${state.round || (latestRound ? latestRound.name : "-")})` });
  events.sort((a, b) => b.time - a.time);
  const recent = events.slice(0, 10);

  const html = render({ pieces, rounds, latestRound, passed, stuck, doing, recent, state });
  fs.mkdirSync(PROGRESS_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, html, "utf8");

  console.log(`[progress] เขียน ${path.relative(ROOT, OUT_FILE)} แล้ว`);
  console.log(`[progress] รอบที่อ่านได้: ${rounds.map((r) => r.name).join(", ") || "(ยังไม่มี)"}`);
  console.log(`[progress] ผ่าน ${passed}/${pieces.length} ชิ้น · ผลตรวจทั้งหมด ${rounds.reduce((n, r) => n + r.reviews.length, 0)} รายการ`);
  if (created) console.log(`[progress] สร้าง ${path.relative(ROOT, STATE_FILE)} ตั้งต้นให้แล้ว — แก้ไฟล์นี้เพื่ออัปเดตสถานะ`);
}

/* ---------- HTML ---------- */
function scoreBars(scores) {
  if (!scores) return "";
  const rows = Object.entries(SCORE_LABELS)
    .filter(([k]) => typeof scores[k] === "number")
    .map(([k, label]) => {
      const v = scores[k];
      const cls = v >= 8 ? "ok" : v >= 6 ? "mid" : "low";
      return `<div class="bar"><span class="bar-l">${esc(label)}</span><span class="bar-t"><i class="${cls}" style="width:${v * 10}%"></i></span><b class="${cls}">${v}</b></div>`;
    })
    .join("");
  return `<div class="bars">${rows}</div>`;
}

function render({ pieces, rounds, latestRound, passed, stuck, doing, recent, state }) {
  const total = pieces.length;
  const pct = Math.round((passed / total) * 100);

  const rows = pieces
    .map((p) => {
      const last = p.last;
      const scoreCell = last
        ? `<div class="score ${last.min != null && last.min >= 8 ? "ok" : "low"}">${last.avg != null ? last.avg.toFixed(1) : "-"}<small>เฉลี่ย</small></div>` +
          (last.min != null ? `<div class="mini">ต่ำสุด ${last.min} · เกณฑ์ผ่านคือทุกด้าน 8 ขึ้นไป</div>` : "") +
          scoreBars(last.scores) +
          `<div class="mini">ตรวจโดย ${esc(last.role || "codex")} รอบ ${esc(last.round)} · ${esc(thaiTime(last.time))}</div>`
        : `<div class="mini">ยังไม่มีผลตรวจ</div>`;
      const gapCell = last && last.biggestGap
        ? `<div class="gap">${esc(last.biggestGap)}</div>` +
          (last.gapLocation ? `<div class="mini">ตรงไหน: ${esc(last.gapLocation)}</div>` : "")
        : `<div class="mini">-</div>`;
      return `<tr>
  <td data-l="ชิ้นงาน"><div class="pid">${esc(p.id)}</div><div class="pname">${esc(p.name)}</div><div class="mini">${esc(p.scope)}</div>${p.note ? `<div class="note">📝 ${esc(p.note)}</div>` : ""}</td>
  <td data-l="สถานะ"><span class="st ${p.statusKey}">${esc(p.status)}</span></td>
  <td data-l="รอบที่"><div class="round">${esc(p.round || "-")}</div><div class="mini">ตรวจแล้ว ${p.reviewCount} ครั้ง</div></td>
  <td data-l="คะแนนล่าสุด">${scoreCell}</td>
  <td data-l="ช่องว่างใหญ่สุด">${gapCell}</td>
</tr>`;
    })
    .join("\n");

  const shotCards = pieces
    .filter((p) => p.shot)
    .map(
      (p) => `<figure class="shot">
  <a href="#img-${esc(p.id)}"><img src="${p.shot.href}" alt="ภาพหน้าจอ ${esc(p.id)} ${esc(p.name)}" loading="lazy"></a>
  <figcaption><b>${esc(p.id)}</b> ${esc(p.name)}<br><span class="mini">${esc(p.shot.round)}${p.shot.scenario ? " · " + esc(p.shot.scenario) : ""}</span></figcaption>
  <div class="lightbox" id="img-${esc(p.id)}">
    <a class="close" href="#ภาพ">✕ ปิด</a>
    <img src="${p.shot.href}" alt="ภาพเต็ม ${esc(p.id)}">
  </div>
</figure>`
    )
    .join("\n");

  const noShots = pieces.filter((p) => !p.shot).map((p) => p.id);

  const changeList = recent.length
    ? recent
        .map(
          (e) =>
            `<li class="ev ${esc(e.kind)}"><span class="when">${esc(thaiTime(e.time))}</span><span class="what">${esc(e.text)}</span></li>`
        )
        .join("\n")
    : `<li class="ev note"><span class="what">ยังไม่มีความเคลื่อนไหว</span></li>`;

  const roundChips = rounds.length
    ? rounds
        .map(
          (r) =>
            `<span class="chip${r === latestRound ? " now" : ""}">${esc(r.name)} · ${r.shots.length} ภาพ · ตรวจ ${r.reviews.length}</span>`
        )
        .join(" ")
    : `<span class="chip">ยังไม่มีรอบถ่ายภาพ</span>`;

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="refresh" content="30">
<title>ความคืบหน้า — ขัดระบบสมาชิก DK</title>
<style>
  :root{
    --navy:#12315e; --navy2:#1b4682; --yellow:#ffc21a; --ink:#16202e; --muted:#5d6b7d;
    --line:#dfe5ec; --bg:#f2f4f7; --card:#fff;
    --pass:#137a3c; --passbg:#e3f6e9; --doing:#0b5fbf; --doingbg:#e2eefc;
    --review:#9a6100; --reviewbg:#fff2d6; --stuck:#b3241d; --stuckbg:#fde6e4; --todo:#5d6b7d; --todobg:#eceff3;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font-family:"Sarabun","Noto Sans Thai","Leelawadee UI","Tahoma",system-ui,sans-serif;
    font-size:17px;line-height:1.6;-webkit-text-size-adjust:100%}
  .wrap{max-width:1100px;margin:0 auto;padding:16px}
  header.top{background:var(--navy);color:#fff;padding:18px 16px;}
  header.top .wrap{padding:0}
  header.top h1{margin:0;font-size:22px;letter-spacing:.2px}
  header.top p{margin:4px 0 0;color:#c8d6ea;font-size:15px}
  .sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0 6px}
  .sum .box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
  .sum .n{font-size:30px;font-weight:800;line-height:1.1}
  .sum .k{color:var(--muted);font-size:14px}
  .sum .box.big .n{color:var(--navy)}
  .progressbar{height:14px;border-radius:99px;background:#dde3ea;overflow:hidden;margin-top:8px;border:1px solid var(--line)}
  .progressbar i{display:block;height:100%;background:linear-gradient(90deg,var(--navy),#2a72c9)}
  .chips{margin:8px 0 0;display:flex;flex-wrap:wrap;gap:6px}
  .chip{background:#fff;border:1px solid var(--line);border-radius:99px;padding:4px 12px;font-size:14px;color:var(--muted)}
  .chip.now{background:var(--yellow);border-color:#e0a900;color:#3a2c00;font-weight:700}
  h2{font-size:19px;margin:26px 0 10px;padding-left:10px;border-left:5px solid var(--yellow)}
  table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
  th{background:#eaeff5;text-align:left;font-size:14px;color:var(--muted);padding:10px 12px;font-weight:700}
  td{padding:12px;border-top:1px solid var(--line);vertical-align:top}
  .pid{font-weight:800;color:var(--navy);font-size:15px}
  .pname{font-weight:700}
  .mini{font-size:13.5px;color:var(--muted);line-height:1.5}
  .note{font-size:14px;background:#fff8e2;border:1px solid #f0dda6;border-radius:8px;padding:6px 8px;margin-top:6px}
  .st{display:inline-block;padding:6px 14px;border-radius:99px;font-weight:800;font-size:15px;white-space:nowrap;min-height:34px}
  .st.pass{background:var(--passbg);color:var(--pass);border:1px solid #8fd3aa}
  .st.doing{background:var(--doingbg);color:var(--doing);border:1px solid #9cc6f2}
  .st.review{background:var(--reviewbg);color:var(--review);border:1px solid #efce84}
  .st.stuck{background:var(--stuckbg);color:var(--stuck);border:1px solid #f1a9a3}
  .st.todo{background:var(--todobg);color:var(--todo);border:1px solid #cfd6df}
  .round{font-weight:700}
  .score{font-size:26px;font-weight:800;line-height:1.1}
  .score small{display:block;font-size:12px;font-weight:600;color:var(--muted)}
  .score.ok{color:var(--pass)} .score.low{color:var(--stuck)}
  .bars{margin:8px 0 6px;display:grid;gap:3px;min-width:190px}
  .bar{display:grid;grid-template-columns:92px 1fr 24px;align-items:center;gap:6px;font-size:13px;color:var(--muted)}
  .bar-t{display:block;height:9px;background:#e6eaef;border-radius:99px;overflow:hidden}
  .bar-t i{display:block;height:100%}
  .bar-t i.ok{background:var(--pass)} .bar-t i.mid{background:#d79a00} .bar-t i.low{background:var(--stuck)}
  .bar b{text-align:right;font-size:13px}
  .bar b.ok{color:var(--pass)} .bar b.mid{color:#9a6100} .bar b.low{color:var(--stuck)}
  .gap{background:#fdf0ee;border:1px solid #f3c9c3;border-radius:10px;padding:8px 10px;font-size:15px}
  .shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
  figure.shot{margin:0;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
  figure.shot img{width:100%;height:190px;object-fit:cover;object-position:top;display:block;background:#f7f8fa}
  figure.shot figcaption{padding:8px 10px;font-size:15px}
  .lightbox{display:none}
  .lightbox:target{display:block;position:fixed;inset:0;background:rgba(10,18,30,.93);z-index:50;overflow:auto;padding:56px 10px 20px;text-align:center}
  .lightbox img{max-width:100%;height:auto;border-radius:10px;background:#fff}
  .lightbox .close{position:fixed;top:10px;right:12px;background:var(--yellow);color:#2a2000;text-decoration:none;
    font-weight:800;padding:10px 18px;border-radius:99px;min-height:44px;display:inline-block}
  ul.ev-list{list-style:none;margin:0;padding:0;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
  li.ev{display:grid;grid-template-columns:150px 1fr;gap:10px;padding:11px 12px;border-top:1px solid var(--line);font-size:15.5px}
  li.ev:first-child{border-top:0}
  li.ev .when{color:var(--muted);font-size:14px}
  li.ev.pass .what{color:var(--pass);font-weight:700}
  li.ev.check .what{color:var(--review)}
  li.ev.shot .what{color:var(--doing)}
  footer{color:var(--muted);font-size:14px;margin:22px 0 40px;text-align:center}
  @media (max-width:720px){
    body{font-size:16px}
    table,thead,tbody,tr,td{display:block;width:100%}
    thead{display:none}
    table{border:0;background:transparent}
    tr{background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:12px;overflow:hidden}
    td{border-top:1px solid var(--line);padding:10px 12px}
    tr td:first-child{border-top:0}
    td::before{content:attr(data-l);display:block;font-size:12.5px;color:var(--muted);font-weight:700;margin-bottom:4px}
    li.ev{grid-template-columns:1fr;gap:2px}
    .bar{grid-template-columns:86px 1fr 22px}
  }
</style>
</head>
<body>
<header class="top">
  <div class="wrap">
    <h1>ความคืบหน้า: ขัดระบบสมาชิก DK</h1>
    <p>หน้านี้รีเฟรชเองทุก 30 วินาที · เปิดค้างไว้ได้เลย</p>
  </div>
</header>

<div class="wrap">
  <section class="sum">
    <div class="box big">
      <div class="n">${passed}/${total}</div>
      <div class="k">ชิ้นงานที่ผ่านแล้ว</div>
      <div class="progressbar"><i style="width:${pct}%"></i></div>
    </div>
    <div class="box"><div class="n">${doing}</div><div class="k">กำลังทำ / รอตรวจ</div></div>
    <div class="box"><div class="n"${stuck ? ' style="color:var(--stuck)"' : ""}>${stuck}</div><div class="k">ติดปัญหา รอเจ้าของร้านตัดสิน</div></div>
    <div class="box"><div class="n" style="font-size:20px">${esc(latestRound ? latestRound.name : "-")}</div><div class="k">รอบล่าสุด · ${esc(thaiTime(latestRound ? latestRound.time : 0))}</div></div>
    <div class="box"><div class="n" style="font-size:20px">${esc(thaiTime(Date.now()))}</div><div class="k">หน้านี้อัปเดตเมื่อ</div></div>
  </section>
  <div class="chips">${roundChips}</div>
  ${state.note ? `<div class="note">📌 ${esc(state.note)}</div>` : ""}

  <h2>ตารางชิ้นงาน P0–P8</h2>
  <table>
    <thead><tr><th>ชิ้นงาน</th><th>สถานะ</th><th>รอบที่</th><th>คะแนนล่าสุด</th><th>ช่องว่างใหญ่สุด</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>

  <h2 id="ภาพ">ภาพหน้าจอล่าสุด (กดที่ภาพเพื่อขยาย)</h2>
  ${shotCards ? `<div class="shots">${shotCards}</div>` : `<p class="mini">ยังไม่มีภาพหน้าจอ</p>`}
  ${noShots.length ? `<p class="mini">ยังไม่มีภาพของ: ${esc(noShots.join(" · "))}</p>` : ""}

  <h2>สิ่งที่เพิ่งเปลี่ยน (10 รายการล่าสุด)</h2>
  <ul class="ev-list">
${changeList}
  </ul>

  <footer>สร้างโดย scripts/build-progress.mjs · ข้อมูลมาจาก review/*/index.json, review/*/codex/*.json และ progress/state.json</footer>
</div>
</body>
</html>
`;
}

build();
