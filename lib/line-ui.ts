// ชิ้นส่วนข้อความ LINE OA (Flex / quick reply / location) — แยกออกจาก webhook ให้แก้หน้าตาได้ที่เดียว (14 ก.ย. 69)
// ข้อมูลร้านตรงกับหน้าเว็บ app/page.tsx และแผนที่ที่ใช้ใน rich menu
export const SHOP = {
  name: "DK STEEL AND TOOLS",
  legal: "บจก.ดีเค สตีลแอนด์ทูลส์",
  phone: "075-845177",
  tel: "075845177",
  lineId: "@629jbwyj",
  hours: "จันทร์–เสาร์ 8:00–17:00",
  mapsUrl: "https://maps.app.goo.gl/kaxxDP9ywmorkXPC6",
  lat: 8.2059645,
  lng: 99.5781291,
  liffUrl: "https://liff.line.me/2010392141-TXmVNdGl",
  rewardsUrl: "https://liff.line.me/2010392141-TXmVNdGl/rewards",
  base: "https://line-dk-bot-ai.vercel.app",
};
export const BRAND = {
  navy: "#0B2A5B", blue: "#1B5FC1", yellow: "#F5C518", orange: "#D9530B",
  line: "#06C755", ink: "#16213A", muted: "#5A6679", sky: "#E8F0FC",
  success: "#12805C", warn: "#B45309", warnBg: "#FFF4E0", panel: "#F4F6FA",
};
export const QUIZ_TRIGGER = "🎮 เล่นเกมตอบคำถาม";

export const SALES_STAFF = [
  { name: "คุณเก๋",   phone: "094-651-4309", tel: "0946514309", lineId: "0946514309", photo: `${SHOP.base}/staff-gae.png` },
  { name: "คุณแพรว", phone: "065-209-4955", tel: "0652094955", lineId: "0652094955", photo: `${SHOP.base}/staff-praew.png` },
  { name: "คุณลัย",  phone: "095-023-6382", tel: "0950236382", lineId: "0950236382", photo: `${SHOP.base}/staff-lai.png` },
  { name: "คุณมีน",  phone: "094-629-3510", tel: "0946293510", lineId: "somdk5004",  photo: `${SHOP.base}/staff-meen.png` },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Msg = Record<string, any>;

// แถบปุ่มลัดใต้ข้อความ — ลูกค้าไม่ต้องจำคำสั่ง (LINE ให้ฟรี ไม่กินโควตา)
export function quickReplies(): Msg {
  return {
    items: [
      { type: "action", action: { type: "uri", label: "💳 บัตรสมาชิก", uri: SHOP.liffUrl } },
      { type: "action", action: { type: "message", label: "⭐ เช็คแต้ม", text: "แต้ม" } },
      { type: "action", action: { type: "uri", label: "🎁 ของรางวัล", uri: SHOP.rewardsUrl } },
      { type: "action", action: { type: "message", label: "📞 ติดต่อฝ่ายขาย", text: "ติดต่อฝ่ายขาย" } },
      { type: "action", action: { type: "message", label: "📍 แผนที่ร้าน", text: "แผนที่" } },
      { type: "action", action: { type: "message", label: "🎮 เล่นเกม", text: QUIZ_TRIGGER } },
    ],
  };
}

export function textMsg(text: string): Msg { return { type: "text", text }; }

export function locationMsg(): Msg {
  return { type: "location", title: SHOP.name, address: `${SHOP.legal} · ${SHOP.hours} · โทร ${SHOP.phone}`, latitude: SHOP.lat, longitude: SHOP.lng };
}


const btn = (label: string, action: Msg, color = BRAND.blue, style: "primary" | "secondary" | "link" = "primary", height: "sm" | "md" = "md"): Msg =>
  ({ type: "button", style, height, color: style === "primary" ? color : undefined, action: { label, ...action } });

// ---------- สีระดับ (ชุดเดียวใช้ทั้งไฟล์) ----------
// สีหลักของระดับ = สีเดียวกับบัตร LIFF (app/liff) · Gold ใช้ #F9A825 ทุกการ์ด ไม่มีเหลืองมะนาวอีกแล้ว
export const TIER_COLOR: Record<string, string> = {
  Diamond: "#1565C0", Platinum: "#546E7A", Gold: "#F9A825", Silver: "#78909C", Bronze: "#8D6E63", Welcome: "#2B5FB8",
};

// ตัวอักษรบนพื้นสีระดับ — Gold/Silver พื้นสว่างจึงใช้น้ำเงินเข้ม
export const TIER_TEXT: Record<string, string> = {
  Diamond: "#FFFFFF", Platinum: "#FFFFFF", Gold: BRAND.navy, Silver: BRAND.navy, Bronze: "#FFFFFF", Welcome: "#FFFFFF",
};

// ชุดสีต่อระดับ: bg = พื้นหัวการ์ด (Silver ใช้เงินโลหะ #B8C4CC — #78909C กับน้ำเงินคอนทราสต์ไม่ถึง 4.5, #CFD8DC ซีดจนดูเป็นการ์ดปิดใช้งาน)
// ink = สีตัวอักษรระดับบนพื้นขาว/tint · tint = พื้นป้ายระดับในเนื้อการ์ด · bar = สีแถบความคืบหน้า (สีสว่างใช้น้ำเงินเข้มแทน)
// ทุกคู่ตัวอักษร/พื้นตรวจคอนทราสต์ ≥ 4.5:1 ใน scripts/validate-line-messages.mjs
export const TIER_THEME: Record<string, { bg: string; text: string; ink: string; tint: string; bar: string }> = {
  Diamond:  { bg: TIER_COLOR.Diamond,  text: "#FFFFFF", ink: "#1565C0", tint: "#E3EEFB", bar: TIER_COLOR.Diamond },
  Platinum: { bg: TIER_COLOR.Platinum, text: "#FFFFFF", ink: "#455A64", tint: "#ECEFF1", bar: TIER_COLOR.Platinum },
  Gold:     { bg: TIER_COLOR.Gold,     text: BRAND.navy, ink: "#7A4F00", tint: "#FFF3D6", bar: BRAND.navy },
  Silver:   { bg: "#B8C4CC",           text: BRAND.navy, ink: "#455A64", tint: "#ECEFF1", bar: BRAND.navy },
  Bronze:   { bg: TIER_COLOR.Bronze,   text: "#FFFFFF", ink: "#6D4C41", tint: "#F3ECE9", bar: TIER_COLOR.Bronze },
  Welcome:  { bg: TIER_COLOR.Welcome,  text: "#FFFFFF", ink: "#2B5FB8", tint: "#E8F0FC", bar: TIER_COLOR.Welcome },
};
const tierTheme = (tierName: string, fallbackColor?: string) =>
  TIER_THEME[tierName] ?? { bg: fallbackColor ?? BRAND.navy, text: "#FFFFFF", ink: BRAND.navy, tint: BRAND.sky, bar: fallbackColor ?? BRAND.navy };

// เกณฑ์แต้มสะสมของแต่ละระดับ — สำเนาจาก TIERS ใน lib/points.ts (import ตรงไม่ได้เพราะไฟล์นั้นต่อฐานข้อมูล) ตัวตรวจเทียบให้ทุกครั้ง
export const TIER_MIN: Record<string, number> = { Diamond: 10000, Platinum: 5000, Gold: 2000, Silver: 500, Bronze: 100, Welcome: 0 };
// เหมือน getTierFromPoints() ใน lib/points.ts
const tierFromPoints = (points: number): string =>
  Object.entries(TIER_MIN).sort((a, b) => b[1] - a[1]).find(([, min]) => points >= min)?.[0] ?? "Welcome";
const TIER_RANK = (name: string) => TIER_MIN[name] ?? -1;

// ---------- ตัวช่วยข้อความ ----------
// ชื่อจาก DB เป็น first_name ("สมชาย"), ค่าสำรอง "คุณ" หรือเบอร์โทร → ทำให้ขึ้นต้นด้วย "คุณ" ครั้งเดียว ไม่โชว์เบอร์
const who = (name: string | null | undefined): string => {
  const t = (name ?? "").trim();
  if (!t || /^[\d\s+-]+$/.test(t)) return "คุณ";
  return t.startsWith("คุณ") ? t : `คุณ${t}`;
};
// ความกว้างที่ตาเห็น (ไม่นับสระบน/ล่าง วรรณยุกต์) — หัวข้อเกิน 16 ตัวย่อเป็น lg ให้อยู่บรรทัดเดียวที่ kilo
export const visualLength = (s: string): number => s.replace(/\p{M}/gu, "").length;
export const TITLE_MAX = 16;
const fmt = (n: number) => n.toLocaleString("en-US");
// ไม่ใส่อีโมจิระดับ (🥇 สื่อ "ที่ 1" ซึ่ง Gold ไม่ใช่ระดับสูงสุด) — next.emoji รับไว้ให้จุดเรียกเดิมคอมไพล์ได้
const progressText = (remaining: number, next: NextTier) => `อีก ${fmt(remaining)} แต้ม → ${next.name}`;

// ---------- การ์ดแจ้งเตือนสมาชิก (โครงกลาง) ----------
type NoticeRow = { label: string; value: string; color?: string };
type NoticeTone = "info" | "warn" | "neutral" | "birthday" | "success";
type NoticeChip = { text: string; color: string; background: string };
type NoticeMetric = {
  value: string; unit?: string; caption?: string; color?: string; size?: "xl" | "xxl" | "3xl";
  captionColor?: string; strike?: boolean; ticket?: boolean;
  label?: string;          // ป้ายเหนือตัวเลข (อ่านจากบนลงล่าง: ป้าย → ค่า → คำอธิบาย)
  chip?: NoticeChip;       // ป้ายสถานะเล็กข้างตัวเลข เช่น "อีก 30 วัน"
  follow?: { text: string; color?: string };  // บรรทัดตัวหนาใต้คำอธิบาย เช่น "ยังใช้ได้ 2,150 แต้ม"
};
type NoticeButton = { label: string; action: Msg; style?: "primary" | "secondary"; color?: string };
type HeaderStyle = { background: string; eyebrow: string; title: string };

export const TONE_STYLE: Record<NoticeTone, HeaderStyle> = {
  info: { background: BRAND.navy, eyebrow: TIER_COLOR.Gold, title: "#FFFFFF" },
  warn: { background: BRAND.warnBg, eyebrow: BRAND.warn, title: BRAND.ink },
  neutral: { background: "#EEF1F6", eyebrow: BRAND.muted, title: BRAND.ink },
  birthday: { background: "#FDE7EF", eyebrow: "#A3244F", title: BRAND.ink },
  // สถานะเสร็จสิ้น (รับของแล้ว) — ต่างจากหัวน้ำเงินของ "จองแล้ว" ชัดเจน
  success: { background: "#E7F5EE", eyebrow: "#0E6B4C", title: BRAND.ink },
};

const noticeBtn = (button: NoticeButton): Msg => ({
  type: "button",
  style: button.style ?? "primary",
  height: "md",
  color: (button.style ?? "primary") === "primary" ? (button.color ?? BRAND.blue) : undefined,
  action: { label: button.label, ...button.action },
});

const rowBox = (row: NoticeRow): Msg => ({
  type: "box", layout: "horizontal", spacing: "sm", alignItems: "center",
  contents: [
    { type: "text", text: row.label, size: "sm", color: BRAND.muted, flex: 5, wrap: true },
    { type: "text", text: row.value, size: "sm", weight: "bold", color: row.color ?? BRAND.navy, align: "end", flex: 7, wrap: true },
  ],
});

function metricBlock(m: NoticeMetric): Msg {
  const color = m.color ?? BRAND.blue;
  const valueText: Msg = {
    type: "text", wrap: true, ...(m.ticket ? { align: "center" } : {}),
    contents: [
      { type: "span", text: m.value, size: m.size ?? (visualLength(m.value) > 12 ? "xl" : "3xl"), weight: "bold", color, ...(m.strike ? { decoration: "line-through" } : {}) },
      // หน่วย % ติดตัวเลข ไม่เว้นวรรค
      ...(m.unit ? [{ type: "span", text: m.unit === "%" ? "%" : ` ${m.unit}`, size: "md", weight: "bold", color }] : []),
    ],
  };
  const caption: Msg[] = m.caption ? [{ type: "text", text: m.caption, size: "xs", color: m.captionColor ?? BRAND.muted, wrap: true, ...(m.ticket ? { align: "center" } : {}) }] : [];
  if (m.ticket) {
    // ป้ายหมายเลขแบบตั๋ว: ป้ายกำกับอยู่บน ตัวเลขใหญ่ตรงกลาง พื้นฟ้าอ่อน ขอบน้ำเงิน
    return {
      type: "box", layout: "vertical", spacing: "xs", backgroundColor: BRAND.sky, cornerRadius: "md",
      borderWidth: "normal", borderColor: BRAND.blue, paddingAll: "12px",
      contents: [...caption, valueText],
    };
  }
  const valueRow: Msg = m.chip ? {
    type: "box", layout: "horizontal", spacing: "md", alignItems: "center",
    contents: [
      { ...valueText, flex: 0 },
      { type: "box", layout: "vertical", flex: 0, backgroundColor: m.chip.background, cornerRadius: "xxl",
        paddingTop: "3px", paddingBottom: "3px", paddingStart: "10px", paddingEnd: "10px",
        contents: [{ type: "text", text: m.chip.text, size: "xs", weight: "bold", color: m.chip.color }] },
    ],
  } : valueText;
  const label: Msg[] = m.label ? [{ type: "text", text: m.label, size: "xs", weight: "bold", color: BRAND.muted, wrap: true }] : [];
  const follow: Msg[] = m.follow ? [{ type: "text", text: m.follow.text, size: "md", weight: "bold", color: m.follow.color ?? BRAND.navy, wrap: true, margin: "sm" }] : [];
  return { type: "box", layout: "vertical", spacing: "xs", contents: [...label, valueRow, ...caption, ...follow] };
}

function memberNoticeFlex(o: {
  altText: string;
  eyebrow: string;
  title: string;
  message?: string;
  tone?: NoticeTone;
  header?: HeaderStyle;
  lead?: Msg[];            // แทน metric เมื่อหัวใจของการ์ดไม่ใช่ตัวเลข (เช่นป้ายระดับ/ประโยคนำ)
  metric?: NoticeMetric;
  rows?: NoticeRow[];
  panelExtra?: Msg[];      // ต่อท้ายในกล่องข้อมูล (คั่นด้วยเส้น)
  bodyExtra?: Msg[];
  buttons?: NoticeButton[];
  note?: string;
}): Msg {
  const tone = o.header ?? TONE_STYLE[o.tone ?? "info"];
  const rows = (o.rows ?? []).slice(0, 3);
  const buttons = (o.buttons ?? []).slice(0, 2);
  const panelContents: Msg[] = [
    ...rows.map(rowBox),
    ...(o.panelExtra?.length ? [...(rows.length ? [{ type: "separator", margin: "md", color: "#DDE2EA" }] : []), { type: "box", layout: "vertical", spacing: "sm", margin: rows.length ? "md" : undefined, contents: o.panelExtra }] : []),
  ];
  const bubble: Msg = {
    type: "bubble", size: "kilo",
    header: {
      type: "box", layout: "vertical", backgroundColor: tone.background, paddingAll: "18px", spacing: "sm",
      contents: [
        { type: "text", text: o.eyebrow, size: "xs", weight: "bold", color: tone.eyebrow, wrap: true },
        { type: "text", text: o.title, size: visualLength(o.title) > TITLE_MAX ? "lg" : "xl", weight: "bold", color: tone.title, wrap: true },
      ],
    },
    body: {
      type: "box", layout: "vertical", paddingAll: "18px", spacing: "md",
      contents: [
        ...(o.lead ?? []),
        ...(o.metric ? [metricBlock(o.metric)] : []),
        ...(o.message ? [{ type: "text", text: o.message, size: "sm", color: BRAND.ink, wrap: true }] : []),
        ...(o.bodyExtra ?? []),
        ...(panelContents.length ? [{
          type: "box", layout: "vertical", spacing: "sm", backgroundColor: BRAND.panel, cornerRadius: "md", paddingAll: "12px",
          contents: panelContents,
        }] : []),
        ...(o.note ? [{ type: "text", text: o.note, size: "xs", color: BRAND.muted, wrap: true }] : []),
      ],
    },
    ...(buttons.length ? {
      footer: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "14px",
        contents: buttons.map(noticeBtn),
      },
      styles: { footer: { separator: true } },
    } : {}),
  };
  return { type: "flex", altText: o.altText, contents: bubble };
}

type NextTier = { name: string; emoji?: string; min: number };

// หลอดความคืบหน้า: เติม = แต้มสะสมตลอดอายุ / เกณฑ์ระดับถัดไป (กติกาเดียวกับหน้าบัตร LIFF) จึงตรงกับป้าย "สะสมแล้ว X / Y"
const progressPct = (totalEarned: number, nextMin: number) =>
  Math.max(3, Math.min(100, Math.round((Math.max(0, totalEarned) / Math.max(1, nextMin)) * 100)));

const progressBar = (pct: number, fill: string): Msg => ({
  type: "box", layout: "vertical", backgroundColor: "#DDE2EA", cornerRadius: "6px", height: "8px",
  contents: [{ type: "box", layout: "vertical", backgroundColor: fill, cornerRadius: "6px", height: "8px", width: `${pct}%`, contents: [] }],
});

// label: การ์ดแจ้งแต้มเข้าใช้ "สะสมเลื่อนระดับ" (ผ่านรีวิวแล้ว) · บัตรเช็คแต้มใช้ "แต้มสะสม" ให้ตรงหน้าบัตร LIFF
const progressBlock = (totalEarned: number, next: NextTier, fill: string = BRAND.blue, label = "สะสมเลื่อนระดับ"): Msg[] => [
  { type: "text", text: progressText(Math.max(0, next.min - totalEarned), next), size: "sm", weight: "bold", color: BRAND.ink, wrap: true },
  progressBar(progressPct(totalEarned, next.min), fill),
  { type: "text", text: `${label} ${fmt(totalEarned)} / ${fmt(next.min)}`, size: "xs", color: BRAND.muted, wrap: true },
];

export function pointsEarnedFlex(o: {
  name: string; points: number; balance: number; billNo: string;
  tierName?: string; tierEmoji?: string; totalEarned?: number; tierMin?: number; next?: NextTier | null;
}): Msg {
  const hasProgress = o.next && o.totalEarned != null;
  return memberNoticeFlex({
    altText: `⭐ +${fmt(o.points)} แต้ม · ดูแต้มและของรางวัล`,
    eyebrow: `DK MEMBER${o.tierName ? ` · ${o.tierName}` : ""}`,  // tierEmoji ไม่แสดง (ดูหมายเหตุเหรียญที่ tierUpFlex)
    title: "แต้มเข้าแล้ว",
    message: `${who(o.name)} ขอบคุณที่อุดหนุน DK ค่ะ`,
    tone: "info",
    metric: { value: `+${fmt(o.points)}`, unit: "แต้ม", caption: `จากบิล ${o.billNo}`, color: BRAND.success },
    rows: [{ label: "แต้มคงเหลือ", value: `${fmt(o.balance)} แต้ม` }],
    panelExtra: hasProgress ? progressBlock(o.totalEarned!, o.next!) : undefined,
    buttons: [{ label: "🎁 ดูแต้มและของรางวัล", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

// สรุปเพื่อแสดงผลจาก lib/tierRules.ts และ app/api/cron/birthday/route.ts
// (line-ui ต้อง import ได้ด้วย `node` ตรง ๆ สำหรับตัวตรวจข้อความในเครื่อง)
export const MEMBER_BENEFITS: Record<string, { discount: number; steelBonus: number; birthday: number }> = {
  Welcome: { discount: 0, steelBonus: 0, birthday: 0 },
  Bronze: { discount: 0, steelBonus: 0, birthday: 100 },
  Silver: { discount: 1, steelBonus: 0, birthday: 200 },
  Gold: { discount: 2, steelBonus: 1, birthday: 500 },
  Platinum: { discount: 3, steelBonus: 1.5, birthday: 800 },
  Diamond: { discount: 4, steelBonus: 2, birthday: 1000 },
};
const fmtRate = (value: number): string => Number.isInteger(value) ? value.toFixed(0) : value.toString();

// ลำดับระดับจากต่ำไปสูง (เหมือน TIER_ORDER ใน lib/tierRules.ts)
const TIER_ASC = Object.keys(TIER_MIN).sort((a, b) => TIER_MIN[a] - TIER_MIN[b]);
const nextTierOf = (tierName: string): string | null => {
  const i = TIER_ASC.indexOf(tierName);
  return i >= 0 && i < TIER_ASC.length - 1 ? TIER_ASC[i + 1] : null;
};
// ระดับแรกที่ได้สิทธิ์นั้น (ใช้กับข้อความต้อนรับ)
const firstTierWith = (key: "discount" | "steelBonus" | "birthday"): string =>
  TIER_ASC.find((t) => (MEMBER_BENEFITS[t]?.[key] ?? 0) > 0) ?? "Welcome";

// สิทธิ์ของระดับ — ข้อความตรงกับกติกาจริงเท่านั้น (ส่วนลดหน้าร้าน = หมวดปลีก, แต้มคืนเหล็ก = ไม่รวมเหล็กเส้น)
const benefitText = {
  discount: (v: number) => `ส่วนลดหน้าร้าน ${fmtRate(v)}% (สินค้าปลีก)`,
  steelBonus: (v: number) => `แต้มคืนเหล็ก ${fmtRate(v)}% (ไม่รวมเหล็กเส้น)`,
  birthday: (v: number) => `แต้มของขวัญวันเกิด ${fmt(v)} แต้ม/ปี`,
};
type BenefitKey = keyof typeof benefitText;
const BENEFIT_KEYS: BenefitKey[] = ["discount", "steelBonus", "birthday"];

function tierBenefitLines(tierName: string): string[] {
  const b = MEMBER_BENEFITS[tierName] ?? MEMBER_BENEFITS.Welcome;
  return BENEFIT_KEYS.filter((k) => b[k] > 0).map((k) => benefitText[k](b[k]));
}
// สิทธิ์ที่จะเสียถ้าระดับตก (คำนวณจาก MEMBER_BENEFITS เท่านั้น) — ใช้บนการ์ดใกล้ลดระดับ
const lossLabel: Record<BenefitKey, string> = { discount: "ส่วนลด", steelBonus: "แต้มคืนเหล็ก", birthday: "แต้มวันเกิด" };
const lossValue: Record<BenefitKey, (v: number) => string> = {
  discount: (v) => v > 0 ? `${fmtRate(v)}%` : "ไม่มี",
  steelBonus: (v) => v > 0 ? `${fmtRate(v)}%` : "ไม่มี",
  birthday: (v) => v > 0 ? fmt(v) : "ไม่มี",  // หน่วยอยู่ในป้าย "แต้มวันเกิด" ค่าไม่ตกบรรทัด
};
function tierLossRows(from: string, to: string): NoticeRow[] {
  const a = MEMBER_BENEFITS[from], b = MEMBER_BENEFITS[to];
  if (!a || !b) return [];
  return BENEFIT_KEYS.filter((k) => b[k] < a[k])
    .map((k) => ({ label: lossLabel[k], value: `${lossValue[k](a[k])} → ${lossValue[k](b[k])}`, color: BRAND.warn }));
}

const checkRow = (line: string): Msg => ({
  type: "box", layout: "horizontal", spacing: "sm",
  contents: [
    { type: "text", text: "✓", size: "sm", weight: "bold", color: BRAND.success, flex: 0 },
    { type: "text", text: line, size: "sm", color: BRAND.ink, flex: 1, wrap: true },
  ],
});

// เหรียญ 🥇🥈🥉 สื่อ "ที่ 1/2/3" ซึ่งกลับด้านกับลำดับระดับ (Gold ไม่ใช่ระดับสูงสุด) → การ์ดเลื่อนระดับไม่ใช้อีโมจิระดับ
// tierEmoji ยังรับไว้ให้จุดเรียกเดิมคอมไพล์ได้
export function tierUpFlex(o: { name: string; tierName: string; tierEmoji: string; points: number; earned: number; billNo: string }): Msg {
  const theme = tierTheme(o.tierName);
  const benefits = tierBenefitLines(o.tierName);
  const next = nextTierOf(o.tierName);
  const rank = TIER_ASC.indexOf(o.tierName);
  return memberNoticeFlex({
    altText: `🎉 เลื่อนเป็น ${o.tierName} แล้ว · ดูสิทธิ์สมาชิกใหม่`,
    eyebrow: "DK MEMBER · ยินดีด้วย",
    // หัวข้อกลาง ๆ — ชื่อระดับอยู่ที่ป้ายใหญ่ในเนื้อการ์ดที่เดียว
    title: "เลื่อนระดับแล้ว",
    header: { background: theme.bg, eyebrow: theme.text, title: theme.text },
    lead: [{
      type: "box", layout: "vertical", backgroundColor: theme.tint, cornerRadius: "md", paddingAll: "12px", spacing: "xs",
      contents: [
        { type: "text", text: o.tierName.toUpperCase(), size: "3xl", weight: "bold", color: theme.ink, align: "center" },
        { type: "text", text: rank > 0 ? `ระดับใหม่ของคุณ · ขั้น ${rank} จาก ${TIER_ASC.length - 1}` : "ระดับใหม่ของคุณ", size: "xs", color: theme.ink, align: "center" },
      ],
    }],
    message: benefits.length ? `${who(o.name)}ได้รับสิทธิ์เหล่านี้แล้วค่ะ` : `${who(o.name)}สะสมแต้มต่อเพื่อปลดล็อกสิทธิ์ค่ะ`,
    bodyExtra: benefits.length ? [{ type: "box", layout: "vertical", spacing: "sm", contents: benefits.map(checkRow) }] : undefined,
    // ระดับถัดไปเหลือบรรทัดเดียว (ไม่ไล่สิทธิ์ถัดไปซ้ำ การ์ดจึงไม่ยาวเกินการ์ดอื่น)
    panelExtra: next ? [{ type: "text", size: "xs", wrap: true, contents: [
      { type: "span", text: "ถัดไป ", color: BRAND.muted },
      { type: "span", text: next, weight: "bold", color: BRAND.navy },
      { type: "span", text: ` · ครบ ${fmt(TIER_MIN[next])} แต้ม`, color: BRAND.muted },
    ] }] : undefined,
    note: `บิล ${o.billNo} · +${fmt(o.earned)} แต้ม`,
    buttons: [{ label: "💳 ดูบัตรสมาชิกของฉัน", action: { type: "uri", uri: SHOP.liffUrl } }],
  });
}

// balance = แต้มคงเหลือหลังบวกของขวัญ (ไม่บังคับ — cron มี users.points + pts อยู่แล้ว)
export function birthdayGiftFlex(o: { name: string; tierName: string; tierEmoji: string; points: number; balance?: number }): Msg {
  return memberNoticeFlex({
    altText: `🎂 +${fmt(o.points)} แต้มวันเกิด · ใช้แลกของรางวัล`,
    eyebrow: "DK MEMBER · วันเกิด",
    title: "สุขสันต์วันเกิด",
    tone: "birthday",
    // คำอวยพรมาก่อนตัวเลข (การ์ดฉลอง ไม่ใช่ใบเสร็จ) · ตัวเลขใช้สีวันเกิด ไม่ใช่เขียวแบบแต้มจากบิล
    lead: [{ type: "text", text: `${who(o.name)} ขอให้ปีนี้งานเข้าไม่ขาดสาย ขอบคุณที่อยู่กับ DK ค่ะ`, size: "sm", color: BRAND.ink, wrap: true }],
    metric: { value: `+${fmt(o.points)}`, unit: "แต้ม", caption: `ของขวัญวันเกิดสมาชิก ${o.tierName} · เข้าบัญชีแล้ว`, color: TONE_STYLE.birthday.eyebrow },
    rows: o.balance == null ? undefined : [{ label: "แต้มคงเหลือ", value: `${fmt(o.balance)} แต้ม` }],
    buttons: [{ label: "🎁 ใช้แต้มแลกของรางวัล", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

export function pointsExpiringFlex(o: { name: string; points: number; daysLeft: number; expiryDate: string; balance?: number }): Msg {
  return memberNoticeFlex({
    altText: `⏳ ${fmt(o.points)} แต้มใกล้หมดอายุ · แลกก่อน ${o.expiryDate}`,
    eyebrow: "DK MEMBER · แจ้งเตือนแต้ม",
    title: "แต้มใกล้หมดอายุ",
    message: `${who(o.name)} แลกเป็นของรางวัลได้ทันทีค่ะ`,
    tone: "warn",
    metric: {
      value: fmt(o.points), unit: "แต้ม", caption: `หมดอายุ ${o.expiryDate}`, color: BRAND.warn,
      chip: { text: `อีก ${fmt(o.daysLeft)} วัน`, color: "#FFFFFF", background: BRAND.warn },
    },
    rows: o.balance == null ? undefined : [{ label: "แต้มคงเหลือ", value: `${fmt(o.balance)} แต้ม` }],
    buttons: [{ label: "🎁 แลกของรางวัลตอนนี้", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

export function pointsExpiredFlex(o: { name: string; points: number; balance: number }): Msg {
  const hasBalance = o.balance > 0;
  return memberNoticeFlex({
    altText: `🔔 ${fmt(o.points)} แต้มหมดอายุ · คงเหลือ ${fmt(o.balance)} แต้ม`,
    eyebrow: "DK MEMBER · แจ้งผลแต้ม",
    title: hasBalance ? "แต้มบางส่วนหมดอายุ" : "แต้มหมดอายุแล้ว",
    // ยอดที่ยังใช้ได้อยู่ในบล็อกตัวเลขแล้ว ข้อความจึงไม่พูดตัวเลขซ้ำ
    message: hasBalance
      ? `${who(o.name)} แต้มมีอายุ 1 ปีค่ะ ใช้แต้มที่เหลือแลกของรางวัลได้เลย`
      : `${who(o.name)} แต้มมีอายุ 1 ปีค่ะ ซื้อครั้งถัดไปรับแต้มใหม่ทุก 100 บาทค่ะ`,
    tone: "neutral",
    // ตัวเลขขีดฆ่า = แต้มที่หมดอายุ (ไม่ต้องมีป้ายซ้ำ) · ถ้ายังมีแต้ม ยอดที่ใช้ได้อยู่ในบล็อกเดียวกันเป็นสีน้ำเงิน
    // ยอดเหลือ 0 ไม่ต้องมีกล่องข้อมูล — บอกในคำอธิบายใต้ตัวเลขบรรทัดเดียว
    metric: {
      value: fmt(o.points), unit: "แต้ม", caption: hasBalance ? "ตัดออกจากบัญชีแล้ว" : `ตัดออกจากบัญชีแล้ว · คงเหลือ ${fmt(Math.max(0, o.balance))} แต้ม`, color: BRAND.muted, strike: true,
      ...(hasBalance ? { follow: { text: `ยังใช้ได้ ${fmt(o.balance)} แต้ม` } } : {}),
    },
    buttons: [{ label: hasBalance ? "🎁 แลกของรางวัล" : "🎁 ดูของรางวัล", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

// หมายเลขคำขอเว้นช่องแคบระหว่างตัว ให้พนักงานอ่านง่ายแบบตั๋ว (U+200A hair space)
const ticketCode = (id: number) => `#REQ-${id}`.split("").join(" ");

export function redemptionRequestedFlex(o: { rewardName: string; points: number; requestId: number; availablePoints: number }): Msg {
  return memberNoticeFlex({
    altText: `🎁 #REQ-${o.requestId} จองแล้ว · แสดงที่เคาน์เตอร์`,
    eyebrow: "DK MEMBER · ของรางวัล",
    title: "จองของรางวัลแล้ว",
    message: "แสดงหมายเลขนี้ที่เคาน์เตอร์เพื่อรับของ",
    tone: "info",
    metric: { value: ticketCode(o.requestId), size: "xxl", caption: "หมายเลขคำขอ", color: BRAND.navy, ticket: true },
    rows: [
      { label: "ของรางวัล", value: o.rewardName },
      { label: "ใช้แต้ม", value: `${fmt(o.points)} แต้ม` },
      { label: "แต้มคงเหลือ", value: `${fmt(o.availablePoints)} แต้ม` },
    ],
    buttons: [
      { label: "🎁 ดูคำขอของฉัน", action: { type: "uri", uri: SHOP.rewardsUrl } },
      { label: "📍 เส้นทางไปร้าน", action: { type: "uri", uri: SHOP.mapsUrl }, style: "secondary" },
    ],
  });
}

export function redemptionConfirmedFlex(o: { rewardName: string; points: number; balance: number; requestId?: number }): Msg {
  return memberNoticeFlex({
    altText: `✅ รับ ${o.rewardName} แล้ว · ดูรางวัลถัดไป`,
    eyebrow: "DK MEMBER · ของรางวัล",
    title: "รับของรางวัลแล้ว",
    message: "ขอบคุณที่ใช้แต้มกับ DK ค่ะ",
    tone: "success",
    metric: { value: o.rewardName, size: "xl", caption: `✓ แลกสำเร็จ · ใช้ ${fmt(o.points)} แต้ม`, color: BRAND.navy, captionColor: BRAND.success },
    rows: [
      ...(o.requestId != null ? [{ label: "หมายเลขคำขอ", value: `#REQ-${o.requestId}` }] : []),
      { label: "แต้มคงเหลือ", value: `${fmt(o.balance)} แต้ม` },
    ],
    buttons: [{ label: "🎁 ดูของรางวัลถัดไป", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

export function redemptionCancelledFlex(o: { rewardName: string; points: number; requestId: number; reason?: string; balance?: number }): Msg {
  return memberNoticeFlex({
    altText: `❌ #REQ-${o.requestId} ยกเลิกแล้ว · แต้มไม่ถูกหัก ใช้แลกได้ตามเดิม`,
    eyebrow: "DK MEMBER · ของรางวัล",
    title: "ยกเลิกคำขอแล้ว",
    // เหตุผล (ถ้ามี) เป็นแถวแรกในกล่องข้อมูล · "ไม่ถูกหัก" พูดครั้งเดียวเป็นบรรทัดสีเขียวใต้ตัวเลข
    message: "ขออภัยในความไม่สะดวกค่ะ",
    tone: "neutral",
    // คำขอแค่ "จอง" แต้มไว้ — แต้มถูกหักตอนพนักงานยืนยันเท่านั้น ยกเลิกแล้วยอดแต้มจึงเท่าเดิม (app/api/admin/redemptions/logic.ts)
    // จึงห้ามใช้คำว่า "คืน" · ตัวเลขขนาด xl ไม่มีเครื่องหมาย + (ไม่ใช่แต้มที่ได้เพิ่ม) ให้คำยืนยันสีเขียวเด่นกว่าตัวเลข
    metric: { label: "แต้มของคำขอนี้", value: fmt(o.points), unit: "แต้ม", size: "xl", color: BRAND.navy,
      follow: { text: "✓ ไม่ถูกหัก ยังใช้แลกได้ตามเดิม", color: BRAND.success } },
    rows: [
      ...(o.reason ? [{ label: "เหตุผล", value: o.reason }] : []),
      { label: "ของรางวัล", value: o.rewardName },
      ...(o.balance != null ? [{ label: "แต้มคงเหลือ", value: `${fmt(o.balance)} แต้ม` }] : []),
    ],
    note: `หมายเลขคำขอ #REQ-${o.requestId}`,
    buttons: [{ label: "🎁 เลือกของรางวัลอื่น", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

// จุดเรียกจริง (cron notify-expiry) ส่ง deadline = ซื้อล่าสุด + 365 วัน มาเสมอ → ตัวเลขหลักเป็นวันที่ · ไม่มี deadline ใช้ประโยคสำรอง
// กติกาจริง (getEffectiveTier ใน lib/points.ts): ไม่มีบิลภายใน 365 วันนับจากซื้อล่าสุด → ระดับคิดจาก "แต้มคงเหลือ" แทนแต้มสะสม
// ชื่อระดับที่จะตกไปแสดงเฉพาะเมื่อผู้เรียกส่ง tierName + points (แต้มคงเหลือ) มาให้คำนวณ ไม่เดาเอง
export function tierExpiryWarningFlex(o: { name: string; tierName?: string; deadline?: string; lastPurchaseDate?: string; points?: number }): Msg {
  const fallback = o.points != null ? tierFromPoints(o.points) : null;
  const drops = !!(o.tierName && fallback && TIER_RANK(fallback) < TIER_RANK(o.tierName));
  // รู้ระดับที่จะตก → ทักชื่อ + บอกระดับ + แถวสิทธิ์ที่จะเสีย (จาก MEMBER_BENEFITS) · ไม่รู้ → ประโยคสั้นไม่ทักชื่อ ("ค่ะ" ไม่ตกบรรทัดเดี่ยว)
  const message = drops
    ? `${who(o.name)} ถ้าไม่มีบิลใหม่ ระดับ ${o.tierName} จะกลับเป็น ${fallback} ค่ะ`  // เว้นวรรคหลังชื่อระดับภาษาอังกฤษ
    : "ถ้าไม่มีบิลใหม่ ระดับอาจลดลงค่ะ";
  const lastRow: NoticeRow[] = o.lastPurchaseDate ? [{ label: "ซื้อล่าสุด", value: o.lastPurchaseDate }] : [];
  const loss = drops ? tierLossRows(o.tierName!, fallback!).slice(0, 2) : [];  // สูงสุด 2 แถว การ์ดไม่ยาวเกิน

  return memberNoticeFlex({
    altText: `📌 ${o.tierName ? `ระดับ ${o.tierName} ` : "ระดับสมาชิก"}ใกล้หมดอายุ · ซื้อ 1 บิล${o.deadline ? `ภายใน ${o.deadline}` : "เพื่อคงระดับ"}`,
    eyebrow: `DK MEMBER · ${o.tierName ? `ระดับ ${o.tierName}` : "แจ้งเตือนระดับ"}`,
    title: "ระดับใกล้หมดอายุ",
    tone: "warn",
    ...(o.deadline
      ? { metric: { label: "ซื้อสินค้า 1 บิลภายใน", value: o.deadline, size: "xl" as const, caption: "เพื่อคงระดับไว้", color: BRAND.warn } }
      : { lead: [{ type: "text", size: "sm", color: BRAND.ink, wrap: true, contents: [
          { type: "span", text: "ซื้อสินค้า 1 บิล", weight: "bold", color: BRAND.warn },
          { type: "span", text: " ภายใน 365 วันนับจากบิลล่าสุด เพื่อคงระดับไว้" },
        ] }] }),
    message,
    rows: [...loss, ...lastRow],
    // ปุ่มเดียว — ติดต่อฝ่ายขายอยู่ในแถบปุ่มลัด (quick reply) แล้ว
    buttons: [{ label: "💳 ดูระดับและเงื่อนไข", action: { type: "uri", uri: SHOP.liffUrl } }],
  });
}

// ข้อความต้อนรับตอนเพิ่มเพื่อน — การ์ดเดียว ปุ่มหลักสมัครสมาชิก ปุ่มรองคู่กันแถวเดียว
export function welcomeFlex(): Msg {
  const discounts = Object.values(MEMBER_BENEFITS).map((b) => b.discount).filter((d) => d > 0);
  const discountFrom = firstTierWith("discount");
  const discountRange = `${fmtRate(Math.min(...discounts))}–${fmtRate(Math.max(...discounts))}%`;
  return {
    type: "flex",
    altText: "👋 ยินดีต้อนรับสู่ DK · สมัครสมาชิกฟรี รับแต้มทุกบิล",
    contents: {
      type: "bubble",
      size: "mega",
      hero: { type: "image", url: `${SHOP.base}/herobanner2.png`, size: "full", aspectRatio: "20:13", aspectMode: "cover" },
      body: {
        type: "box", layout: "vertical", spacing: "md", paddingAll: "20px", paddingBottom: "8px",
        contents: [
          { type: "text", text: "ยินดีต้อนรับสู่ DK", weight: "bold", size: "xl", color: BRAND.ink },
          { type: "text", text: "สมัครฟรี ใช้ได้ทันทีที่ร้าน DK", size: "sm", color: BRAND.muted, wrap: true },
          // ผู้ติดตามใหม่ยังไม่รู้จักชื่อระดับ → บอกเงื่อนไขเป็นจำนวนแต้มสะสม (จาก TIER_MIN) · แถวละสิทธิ์เดียว
          ...[
            ["★", "สะสมแต้มทุกบิล", "ทุก 100 บาท = 1 แต้ม ใช้แลกของรางวัลได้"],
            ["%", "ส่วนลดสินค้าปลีก", `ลด ${discountRange} เริ่มเมื่อสะสมครบ ${fmt(TIER_MIN[discountFrom])} แต้ม`],
            ["✦", "แต้มวันเกิดทุกปี", `เมื่อสะสมครบ ${fmt(TIER_MIN[firstTierWith("birthday")])} แต้ม`],
          ].map(([ic, t, d], i) => ({
            type: "box", layout: "horizontal", spacing: "md", alignItems: "center", ...(i === 0 ? { margin: "lg" } : {}),
            contents: [
              // ไอคอนวงกลมสีแบรนด์ชุดเดียว เป็นตัวอักษรทั้งหมด (★ % ✦) — อีโมจิหน้าตาต่างกันแต่ละเครื่อง
              { type: "box", layout: "vertical", flex: 0, width: "32px", height: "32px", cornerRadius: "16px",
                backgroundColor: BRAND.sky, justifyContent: "center", alignItems: "center",
                contents: [{ type: "text", text: ic, size: "md", weight: "bold", color: BRAND.navy, align: "center" }] },
              { type: "box", layout: "vertical", contents: [
                { type: "text", text: t, weight: "bold", size: "sm", color: BRAND.ink },
                { type: "text", text: d, size: "xs", color: BRAND.muted, wrap: true },
              ] },
            ],
          })),
        ],
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", paddingTop: "8px",
        contents: [
          btn("💳 สมัครสมาชิกฟรี", { type: "uri", uri: SHOP.liffUrl }, BRAND.blue),
          { type: "box", layout: "horizontal", spacing: "sm", contents: [
            btn("📞 ฝ่ายขาย", { type: "message", text: "ติดต่อฝ่ายขาย" }, BRAND.blue, "secondary", "sm"),
            btn("📍 แผนที่ร้าน", { type: "uri", uri: SHOP.mapsUrl }, BRAND.blue, "secondary", "sm"),
          ] },
          { type: "text", text: `${SHOP.hours} · โทร ${SHOP.phone}`, size: "xs", color: BRAND.muted, align: "center", margin: "sm" },
        ],
      },
    },
  };
}

// ติดต่อฝ่ายขาย: ใบแรกเป็นใบร้าน (แบนเนอร์ DK + เวลาทำการ + โทรร้าน/แผนที่) แล้วตามด้วยการ์ดพนักงาน 4 ใบ
// การ์ดพนักงานคงดีไซน์ที่เจ้าของชอบ (รูปใหญ่ + โทร/เพิ่มเพื่อน) แต่ตัดแบนเนอร์ซ้ำ/บรรทัดเวลาซ้ำออก ใช้หัวน้ำเงินบางแทน
export function contactFlex(): Msg {
  // ใบร้านไม่ใช้แบนเนอร์ (ตัวหนังสือเล็กในแบนเนอร์อ่านไม่ออกที่ kilo) → หัวน้ำเงินกับโลโก้ DK
  // เนื้อการ์ด space-between: กล่องเวลาทำการชิดล่าง ปุ่มจึงอยู่ระดับเดียวกับการ์ดพนักงานตอนปัด
  const intro: Msg = {
    type: "bubble", size: "kilo",
    header: {
      type: "box", layout: "horizontal", backgroundColor: BRAND.navy, paddingAll: "16px", spacing: "md", alignItems: "center",
      contents: [
        { type: "box", layout: "vertical", flex: 0, width: "56px", height: "56px", cornerRadius: "md", contents: [
          { type: "image", url: `${SHOP.base}/dk-logo.jpg`, size: "full", aspectRatio: "1:1", aspectMode: "cover" },
        ] },
        { type: "box", layout: "vertical", flex: 1, contents: [
          { type: "text", text: "DK STEEL AND TOOLS", size: "xs", weight: "bold", color: TIER_COLOR.Gold, wrap: true },
          { type: "text", text: "ฝ่ายขาย DK", size: "xl", weight: "bold", color: "#FFFFFF" },
        ] },
      ],
    },
    body: {
      type: "box", layout: "vertical", paddingAll: "16px", spacing: "sm", justifyContent: "space-between",
      contents: [
        { type: "box", layout: "vertical", spacing: "sm", contents: [
          // ป้าย "พนักงานขาย" ครั้งเดียวที่ใบนี้ (การ์ดพนักงานมีแค่ชื่อ ไม่แต่งความถนัดขึ้นเอง)
          { type: "text", text: `พนักงานขาย ${SALES_STAFF.length} คน`, size: "md", weight: "bold", color: BRAND.ink },
          { type: "text", text: "ปัดขวาเพื่อโทรหรือแอด LINE →", size: "sm", color: BRAND.muted, wrap: true },
        ] },
        { type: "box", layout: "vertical", spacing: "sm", margin: "lg", backgroundColor: BRAND.panel, cornerRadius: "md", paddingAll: "12px",
          contents: [
            { type: "text", text: "เวลาทำการ", size: "xs", color: BRAND.muted },
            { type: "text", text: SHOP.hours, size: "sm", weight: "bold", color: BRAND.navy, margin: "none" },
            { type: "separator", margin: "md", color: "#DDE2EA" },
            rowBox({ label: "โทรร้าน", value: SHOP.phone }),
          ] },
      ],
    },
    // ปุ่มซ้อนเต็มความกว้างแบบเดียวกับการ์ดพนักงาน ขอบล่างทุกใบจึงตรงกันตอนปัด
    footer: {
      type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px",
      contents: [
        btn("📞 โทรร้าน", { type: "uri", uri: `tel:${SHOP.tel}` }, BRAND.blue, "primary", "sm"),
        btn("📍 แผนที่ร้าน", { type: "uri", uri: SHOP.mapsUrl }, BRAND.blue, "secondary", "sm"),
      ],
    },
  };
  const staff: Msg[] = SALES_STAFF.map((s) => ({
    type: "bubble", size: "kilo",
    body: {
      type: "box", layout: "vertical", paddingAll: "16px", paddingBottom: "4px",
      contents: [
        { type: "box", layout: "vertical", cornerRadius: "md", contents: [
          { type: "image", url: s.photo, size: "full", aspectRatio: "5:6", aspectMode: "cover" },
        ] },
        // ชื่ออย่างเดียว — ป้าย "พนักงานขาย" อยู่ที่ใบร้านครั้งเดียว (ไม่มีข้อมูลความถนัดจริง จึงไม่แต่งขึ้นเอง) · เบอร์อยู่ที่ปุ่มโทรแล้ว
        { type: "text", text: s.name, size: "lg", weight: "bold", color: BRAND.ink, align: "center", margin: "md" },
      ],
    },
    footer: {
      type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px",
      contents: [
        { type: "button", style: "primary", height: "sm", color: BRAND.blue, action: { type: "uri", label: `📞 โทรหา${s.name}`, uri: `tel:${s.tel}` } },
        { type: "button", style: "secondary", height: "sm", action: { type: "uri", label: `💬 LINE ${s.name}`, uri: `https://line.me/ti/p/~${s.lineId}` } },
      ],
    },
  }));
  return {
    type: "flex",
    altText: `📞 ติดต่อฝ่ายขาย DK · ${SHOP.hours} · โทรร้าน ${SHOP.phone}`,
    contents: { type: "carousel", contents: [intro, ...staff] },
  };
}

// เช็คแต้ม: บัตรย่อสีตามระดับ (หัวแสดงชื่อระดับอย่างเดียว ไม่ใช้เหรียญ — tierEmoji รับไว้ให้จุดเรียกเดิมคอมไพล์ได้) + หลอดความคืบหน้า + ปุ่มเปิดบัตร/ของรางวัล
export function pointsFlex(o: { name: string; tierName: string; tierEmoji: string; tierColor: string; points: number; totalEarned: number; tierMin: number; next: { name: string; emoji: string; min: number } | null; inactiveRealTier?: string }): Msg {
  const theme = tierTheme(o.tierName, o.tierColor);
  // ระดับพักอยู่ (ไม่มีบิลเกิน 1 ปี): แต้มสะสมเกินเกณฑ์ระดับถัดไปแล้ว หลอดจะหลอกตา → แสดงกล่องเตือนแทนหลอด
  const showProgress = !!o.next && !o.inactiveRealTier;
  // จุดเรียกส่งมาเป็น "🥇 Gold" → ตัดอีโมจิออก (ไอคอนในเนื้อการ์ดเป็นตัวอักษร/ป้ายสีเท่านั้น)
  const realTier = (o.inactiveRealTier ?? "").replace(/[\p{Extended_Pictographic}️]/gu, "").trim();
  return {
    type: "flex",
    altText: `⭐ ${fmt(o.points)} แต้ม · เปิดดูบัตร ${o.tierName}`,
    contents: {
      type: "bubble", size: "kilo",
      header: {
        type: "box", layout: "vertical", backgroundColor: theme.bg, paddingAll: "18px",
        contents: [
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "DK MEMBER", size: "xs", color: theme.text, weight: "bold" },
            { type: "text", text: o.tierName, size: "xs", color: theme.text, weight: "bold", align: "end" },
          ] },
          { type: "text", text: who(o.name), size: "md", color: theme.text, weight: "bold", margin: "sm", wrap: true },
          { type: "text", text: fmt(o.points), size: "3xl", color: theme.text, weight: "bold", margin: "md" },
          { type: "text", text: "แต้มคงเหลือ", size: "xs", color: theme.text },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", paddingBottom: "12px",
        contents: [
          ...(showProgress ? progressBlock(o.totalEarned, o.next!, theme.bar, "แต้มสะสม") : []),
          ...(!o.next ? [
            { type: "text", text: "★ ระดับสูงสุด ขอบคุณที่ไว้ใจ DK ค่ะ", size: "sm", color: BRAND.ink, wrap: true },
            progressBar(100, theme.bar),
          ] : []),
          ...(o.inactiveRealTier ? [{
            type: "box", layout: "vertical", backgroundColor: BRAND.warnBg, cornerRadius: "md", paddingAll: "10px", spacing: "xs",
            contents: [
              // ป้ายสีแบบเดียวกับ "อีก 30 วัน" แทนอีโมจิ ⚠️
              { type: "box", layout: "horizontal", spacing: "sm", alignItems: "center", contents: [
                { type: "box", layout: "vertical", flex: 0, backgroundColor: BRAND.warn, cornerRadius: "xxl",
                  paddingTop: "2px", paddingBottom: "2px", paddingStart: "8px", paddingEnd: "8px",
                  contents: [{ type: "text", text: "พักระดับ", size: "xs", weight: "bold", color: "#FFFFFF" }] },
                { type: "text", text: `ระดับสะสม ${realTier}`, size: "sm", weight: "bold", color: BRAND.warn, wrap: true, flex: 1 },
              ] },
              { type: "text", text: "ซื้อสินค้า 1 บิล เพื่อกลับสู่ระดับเดิม", size: "xs", color: BRAND.ink, wrap: true },
            ],
          }] : []),
          { type: "text", text: "ทุก 100 บาท = 1 แต้ม · แต้มมีอายุ 1 ปี", size: "xs", color: BRAND.muted, wrap: true, margin: "md" },
        ],
      },
      footer: {
        type: "box", layout: "horizontal", spacing: "sm", paddingAll: "12px",
        contents: [
          // ปุ่มสูง md เท่าการ์ดแจ้งเตือนทุกใบ
          btn("💳 เปิดบัตร", { type: "uri", uri: SHOP.liffUrl }, BRAND.blue, "primary", "md"),
          btn("🎁 ของรางวัล", { type: "uri", uri: SHOP.rewardsUrl }, BRAND.blue, "secondary", "md"),
        ],
      },
    },
  };
}
