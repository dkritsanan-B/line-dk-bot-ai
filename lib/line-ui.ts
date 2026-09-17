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
      { type: "action", action: { type: "uri", label: "🎴 บัตรสมาชิก", uri: SHOP.liffUrl } },
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

// ชุดสีต่อระดับ: bg = พื้นหัวการ์ด (Silver ใช้เงินอ่อน #B0BEC5 จากบัตร LIFF เพราะ #78909C กับน้ำเงินคอนทราสต์ไม่ถึง 4.5)
// ink = สีตัวอักษรระดับบนพื้นขาว/tint · tint = พื้นป้ายระดับในเนื้อการ์ด · bar = สีแถบความคืบหน้า (สีสว่างใช้น้ำเงินเข้มแทน)
// ทุกคู่ตัวอักษร/พื้นตรวจคอนทราสต์ ≥ 4.5:1 ใน scripts/validate-line-messages.mjs
export const TIER_THEME: Record<string, { bg: string; text: string; ink: string; tint: string; bar: string }> = {
  Diamond:  { bg: TIER_COLOR.Diamond,  text: "#FFFFFF", ink: "#1565C0", tint: "#E3EEFB", bar: TIER_COLOR.Diamond },
  Platinum: { bg: TIER_COLOR.Platinum, text: "#FFFFFF", ink: "#455A64", tint: "#ECEFF1", bar: TIER_COLOR.Platinum },
  Gold:     { bg: TIER_COLOR.Gold,     text: BRAND.navy, ink: "#7A4F00", tint: "#FFF3D6", bar: BRAND.navy },
  Silver:   { bg: "#B0BEC5",           text: BRAND.navy, ink: "#455A64", tint: "#ECEFF1", bar: BRAND.navy },
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
const progressText = (remaining: number, next: NextTier) => `อีก ${fmt(remaining)} แต้ม → ${next.emoji ? `${next.emoji} ` : ""}${next.name}`;

// ---------- การ์ดแจ้งเตือนสมาชิก (โครงกลาง) ----------
type NoticeRow = { label: string; value: string; color?: string };
type NoticeTone = "info" | "warn" | "neutral" | "birthday";
type NoticeMetric = {
  value: string; unit?: string; caption: string; color?: string; size?: "xl" | "xxl" | "3xl";
  captionColor?: string; strike?: boolean; ticket?: boolean;
};
type NoticeButton = { label: string; action: Msg; style?: "primary" | "secondary"; color?: string };
type HeaderStyle = { background: string; eyebrow: string; title: string };

export const TONE_STYLE: Record<NoticeTone, HeaderStyle> = {
  info: { background: BRAND.navy, eyebrow: TIER_COLOR.Gold, title: "#FFFFFF" },
  warn: { background: BRAND.warnBg, eyebrow: BRAND.warn, title: BRAND.ink },
  neutral: { background: "#EEF1F6", eyebrow: BRAND.muted, title: BRAND.ink },
  birthday: { background: "#FDE7EF", eyebrow: "#A3244F", title: BRAND.ink },
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
  const caption: Msg = { type: "text", text: m.caption, size: "xs", color: m.captionColor ?? BRAND.muted, wrap: true, ...(m.ticket ? { align: "center" } : {}) };
  if (m.ticket) {
    // ป้ายหมายเลขแบบตั๋ว: ป้ายกำกับอยู่บน ตัวเลขใหญ่ตรงกลาง พื้นฟ้าอ่อน ขอบน้ำเงิน
    return {
      type: "box", layout: "vertical", spacing: "xs", backgroundColor: BRAND.sky, cornerRadius: "md",
      borderWidth: "normal", borderColor: BRAND.blue, paddingAll: "12px",
      contents: [caption, valueText],
    };
  }
  return { type: "box", layout: "vertical", spacing: "xs", contents: [valueText, caption] };
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
        ...(o.note ? [{ type: "text", text: o.note, size: "xxs", color: BRAND.muted, wrap: true }] : []),
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

const progressBlock = (totalEarned: number, next: NextTier, fill: string = BRAND.blue): Msg[] => [
  { type: "text", text: progressText(Math.max(0, next.min - totalEarned), next), size: "sm", weight: "bold", color: BRAND.ink, wrap: true },
  progressBar(progressPct(totalEarned, next.min), fill),
  { type: "text", text: `สะสมแล้ว ${fmt(totalEarned)} / ${fmt(next.min)} แต้ม`, size: "xs", color: BRAND.muted },
];

export function pointsEarnedFlex(o: {
  name: string; points: number; balance: number; billNo: string;
  tierName?: string; tierEmoji?: string; totalEarned?: number; tierMin?: number; next?: NextTier | null;
}): Msg {
  const hasProgress = o.next && o.totalEarned != null;
  return memberNoticeFlex({
    altText: `⭐ +${fmt(o.points)} แต้ม · ดูแต้มและของรางวัล`,
    eyebrow: `DK MEMBER${o.tierName ? ` · ${o.tierEmoji ? `${o.tierEmoji} ` : ""}${o.tierName}` : ""}`,
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

function tierBenefitLines(tierName: string): string[] {
  const { discount, steelBonus, birthday } = MEMBER_BENEFITS[tierName] ?? MEMBER_BENEFITS.Welcome;
  return [
    ...(discount > 0 ? [`ส่วนลดหน้าร้านสูงสุด ${fmtRate(discount)}%`] : ["รับแต้มทุก 100 บาท = 1 แต้ม"]),
    ...(steelBonus > 0 ? [`โบนัสแต้มหมวดเหล็ก ${fmtRate(steelBonus)}%`] : []),
    ...(birthday > 0 ? [`แต้มของขวัญวันเกิด ${fmt(birthday)} แต้ม`] : []),
  ].slice(0, 3);
}

const checkRow = (line: string): Msg => ({
  type: "box", layout: "horizontal", spacing: "sm",
  contents: [
    { type: "text", text: "✓", size: "sm", weight: "bold", color: BRAND.success, flex: 0 },
    { type: "text", text: line, size: "sm", color: BRAND.ink, flex: 1, wrap: true },
  ],
});

export function tierUpFlex(o: { name: string; tierName: string; tierEmoji: string; points: number; earned: number; billNo: string }): Msg {
  const theme = tierTheme(o.tierName);
  return memberNoticeFlex({
    altText: `🎉 เลื่อนเป็น ${o.tierName} แล้ว · ดูสิทธิ์สมาชิกใหม่`,
    eyebrow: "DK MEMBER · ระดับสมาชิก",
    title: `เลื่อนเป็น ${o.tierName} แล้ว`,
    header: { background: theme.bg, eyebrow: theme.text, title: theme.text },
    lead: [{
      type: "box", layout: "vertical", backgroundColor: theme.tint, cornerRadius: "md", paddingAll: "12px", spacing: "xs",
      contents: [
        { type: "text", text: `${o.tierEmoji} ${o.tierName}`, size: "3xl", weight: "bold", color: theme.ink, align: "center" },
        { type: "text", text: "ระดับใหม่ของคุณ", size: "xs", color: theme.ink, align: "center" },
      ],
    }],
    message: `${who(o.name)}ได้รับสิทธิ์เหล่านี้แล้วค่ะ`,
    bodyExtra: [{ type: "box", layout: "vertical", spacing: "sm", contents: tierBenefitLines(o.tierName).map(checkRow) }],
    note: `บิล ${o.billNo} · +${fmt(o.earned)} แต้ม`,
    buttons: [{ label: `🎴 ดูบัตร ${o.tierName} ของฉัน`, action: { type: "uri", uri: SHOP.liffUrl } }],
  });
}

export function birthdayGiftFlex(o: { name: string; tierName: string; tierEmoji: string; points: number }): Msg {
  return memberNoticeFlex({
    altText: `🎂 +${fmt(o.points)} แต้มวันเกิด · ใช้แลกของรางวัล`,
    eyebrow: "DK MEMBER · วันเกิด",
    title: "สุขสันต์วันเกิด 🎂",
    message: `${who(o.name)} ขอให้ปีนี้งานเข้าไม่ขาดสาย ขอบคุณที่อยู่กับ DK ค่ะ`,
    tone: "birthday",
    metric: { value: `+${fmt(o.points)}`, unit: "แต้ม", caption: "ของขวัญวันเกิดเข้าบัญชีแล้ว", color: BRAND.success },
    buttons: [{ label: "🎁 ใช้แต้มแลกของรางวัล", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

export function pointsExpiringFlex(o: { name: string; points: number; daysLeft: number; expiryDate: string; balance?: number }): Msg {
  return memberNoticeFlex({
    altText: `⏳ ${fmt(o.points)} แต้มใกล้หมดอายุ · แลกก่อน ${o.expiryDate}`,
    eyebrow: "DK MEMBER · แจ้งเตือนแต้ม",
    title: "แต้มใกล้หมดอายุ",
    message: "แลกเป็นของรางวัลได้ทันทีค่ะ",
    tone: "warn",
    metric: { value: fmt(o.points), unit: "แต้ม", caption: `หมดอายุ ${o.expiryDate} (อีก ${fmt(o.daysLeft)} วัน)`, color: BRAND.warn },
    rows: o.balance == null ? undefined : [{ label: "แต้มคงเหลือ", value: `${fmt(o.balance)} แต้ม` }],
    buttons: [{ label: "🎁 แลกของรางวัลตอนนี้", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

export function pointsExpiredFlex(o: { name: string; points: number; balance: number }): Msg {
  const hasBalance = o.balance > 0;
  return memberNoticeFlex({
    altText: `🔔 ${fmt(o.points)} แต้มหมดอายุ · คงเหลือ ${fmt(o.balance)} แต้ม`,
    eyebrow: "DK MEMBER · แจ้งผลแต้ม",
    title: "แต้มบางส่วนหมดอายุ",
    message: hasBalance ? "แลกแต้มที่เหลือได้เลยค่ะ" : "ซื้อสินค้าครั้งถัดไป รับแต้มใหม่ทุก 100 บาทค่ะ",
    tone: "neutral",
    metric: { value: fmt(o.points), unit: "แต้ม", caption: "หมดอายุแล้ว", color: BRAND.muted, strike: true },
    rows: [{ label: "แต้มคงเหลือ", value: `${fmt(o.balance)} แต้ม` }],
    buttons: [{ label: hasBalance ? "🎁 แลกของรางวัล" : "🎁 ดูของรางวัล", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

// หมายเลขคำขอเว้นช่องแคบระหว่างตัว ให้พนักงานอ่านง่ายแบบตั๋ว (U+200A hair space)
const ticketCode = (id: number) => `#REQ-${id}`.split("").join(" ");

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
      { label: "คงเหลือ", value: `${fmt(o.availablePoints)} แต้ม` },
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
    tone: "info",
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
    altText: `❌ #REQ-${o.requestId} ยกเลิกแล้ว · ปลดแต้มที่จองไว้ ${fmt(o.points)} แต้ม`,
    eyebrow: "DK MEMBER · ของรางวัล",
    title: "ยกเลิกคำขอแล้ว",
    message: o.balance != null ? `ตอนนี้ใช้ได้ ${fmt(o.balance)} แต้มค่ะ` : undefined,
    tone: "neutral",
    // คำขอแค่ "จอง" แต้มไว้ — ยกเลิกแล้วแต้มไม่เคยถูกหัก จึงไม่ใช่ "คืนแต้ม" (app/api/admin/redemptions/logic.ts)
    metric: { value: fmt(o.points), unit: "แต้ม", caption: "ปลดแต้มที่จองไว้แล้ว · ไม่ได้หัก", color: BRAND.navy },
    rows: [
      { label: "หมายเลขคำขอ", value: `#REQ-${o.requestId}` },
      { label: "ของรางวัล", value: o.rewardName },
      ...(o.reason ? [{ label: "เหตุผล", value: o.reason }] : []),
    ],
    buttons: [{ label: "🎁 เลือกของรางวัลอื่น", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

// กติกาจริง (getEffectiveTier ใน lib/points.ts): ไม่มีบิลภายใน 365 วันนับจากซื้อล่าสุด → ระดับคิดจาก "แต้มคงเหลือ" แทนแต้มสะสม
// ชื่อระดับที่จะตกไปแสดงเฉพาะเมื่อผู้เรียกส่ง tierName + points (แต้มคงเหลือ) มาให้คำนวณ ไม่เดาเอง
export function tierExpiryWarningFlex(o: { name: string; tierName?: string; deadline?: string; lastPurchaseDate?: string; points?: number }): Msg {
  const fallback = o.points != null ? tierFromPoints(o.points) : null;
  const drops = !!(o.tierName && fallback && TIER_RANK(fallback) < TIER_RANK(o.tierName));
  const consequence = drops
    ? `ถ้าไม่มีบิลใหม่ ระดับ ${o.tierName} จะกลับเป็น ${fallback}`
    : `ถ้าไม่มีบิลใหม่ ระดับ${o.tierName ? ` ${o.tierName} ` : ""}จะคิดจากแต้มคงเหลือ และอาจลดลง`;
  const action = "ซื้อสินค้า 1 บิล เพื่อคงระดับไว้";
  const leadText = "ซื้อสินค้า 1 บิลภายใน 1 ปีนับจากการซื้อล่าสุด เพื่อคงระดับไว้";
  return memberNoticeFlex({
    altText: `📌 ${o.tierName ? `ระดับ ${o.tierName} ` : "ระดับสมาชิก"}ใกล้หมดอายุ · ซื้อ 1 บิล${o.deadline ? `ภายใน ${o.deadline}` : "เพื่อคงระดับ"}`,
    eyebrow: "DK MEMBER · แจ้งเตือนระดับ",
    title: "ระดับใกล้หมดอายุ",
    tone: "warn",
    ...(o.deadline
      ? { metric: { value: `ภายใน ${o.deadline}`, size: "xl" as const, caption: action, color: BRAND.warn } }
      : { lead: [{ type: "text", text: leadText, size: "md", weight: "bold", color: BRAND.warn, wrap: true }] }),
    message: `${who(o.name)} ${consequence}ค่ะ`,
    rows: o.lastPurchaseDate ? [{ label: "ซื้อล่าสุด", value: o.lastPurchaseDate }] : undefined,
    buttons: [
      { label: "🎴 ดูบัตรสมาชิก", action: { type: "uri", uri: SHOP.liffUrl } },
      { label: "📞 ติดต่อฝ่ายขาย", action: { type: "message", text: "ติดต่อฝ่ายขาย" }, style: "secondary" },
    ],
  });
}

// ข้อความต้อนรับตอนเพิ่มเพื่อน — การ์ดเดียว ปุ่มหลักสมัครสมาชิก ปุ่มรองคู่กันแถวเดียว
export function welcomeFlex(): Msg {
  const maxDiscount = Math.max(...Object.values(MEMBER_BENEFITS).map((benefit) => benefit.discount));
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
          { type: "text", text: "ยินดีต้อนรับสู่ DK 👋", weight: "bold", size: "xl", color: BRAND.ink },
          { type: "text", text: "วัสดุก่อสร้าง เหล็ก เครื่องมือช่าง เมทัลชีท ท่อ PVC ปั๊มน้ำ ครบจบที่เดียว", size: "sm", color: BRAND.muted, wrap: true },
          ...[
            ["⭐", "สะสมแต้ม", "ทุก 100 บาท = 1 แต้ม เข้าอัตโนมัติจากบิล"],
            ["🏷️", "ส่วนลดสมาชิก", `ลดสูงสุด ${maxDiscount}% ตามระดับ`],
            ["🎁", "ของรางวัล + วันเกิด", "แลกแต้มที่ร้าน รับแต้มของขวัญวันเกิดทุกปี"],
          ].map(([ic, t, d], i) => ({
            type: "box", layout: "horizontal", spacing: "md", alignItems: "center", ...(i === 0 ? { margin: "lg" } : {}),
            contents: [
              { type: "text", text: ic, size: "xl", flex: 0 },
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
          btn("🎴 สมัครสมาชิกฟรี", { type: "uri", uri: SHOP.liffUrl }, BRAND.blue),
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
  const intro: Msg = {
    type: "bubble", size: "kilo",
    hero: { type: "image", url: `${SHOP.base}/herobanner2.png`, size: "full", aspectRatio: "20:13", aspectMode: "cover" },
    body: {
      type: "box", layout: "vertical", paddingAll: "16px", spacing: "sm",
      contents: [
        { type: "text", text: "ฝ่ายขาย DK", size: "xl", weight: "bold", color: BRAND.ink },
        { type: "text", text: "ปัดขวาเพื่อดูพนักงานขาย →", size: "sm", color: BRAND.muted, wrap: true },
        { type: "box", layout: "vertical", spacing: "sm", margin: "md", backgroundColor: BRAND.panel, cornerRadius: "md", paddingAll: "12px",
          contents: [
            { type: "text", text: "เวลาทำการ", size: "xs", color: BRAND.muted },
            { type: "text", text: SHOP.hours, size: "sm", weight: "bold", color: BRAND.navy, margin: "none" },
            { type: "text", text: `โทรร้าน ${SHOP.phone}`, size: "sm", color: BRAND.ink },
          ] },
      ],
    },
    footer: {
      type: "box", layout: "horizontal", spacing: "sm", paddingAll: "12px",
      contents: [
        btn("📞 โทรร้าน", { type: "uri", uri: `tel:${SHOP.tel}` }, BRAND.blue, "primary", "sm"),
        btn("📍 แผนที่", { type: "uri", uri: SHOP.mapsUrl }, BRAND.blue, "secondary", "sm"),
      ],
    },
  };
  const staff: Msg[] = SALES_STAFF.map((s) => ({
    type: "bubble", size: "kilo",
    header: {
      type: "box", layout: "vertical", backgroundColor: BRAND.navy, paddingAll: "10px", paddingStart: "16px",
      contents: [{ type: "text", text: "DK STEEL · ฝ่ายขาย", size: "xs", weight: "bold", color: "#FFFFFF" }],
    },
    body: {
      type: "box", layout: "vertical", paddingAll: "16px", paddingBottom: "4px",
      contents: [
        { type: "image", url: s.photo, size: "full", aspectRatio: "10:9", aspectMode: "cover" },
        { type: "text", text: s.name, size: "lg", weight: "bold", color: BRAND.ink, align: "center", margin: "md" },
        { type: "text", text: s.phone, size: "sm", color: BRAND.muted, align: "center", margin: "xs" },
      ],
    },
    footer: {
      type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px",
      contents: [
        { type: "button", style: "primary", height: "sm", color: BRAND.blue, action: { type: "uri", label: `📞 โทรหา${s.name}`, uri: `tel:${s.tel}` } },
        { type: "button", style: "primary", height: "sm", color: BRAND.line, action: { type: "uri", label: "🟢 เพิ่มเพื่อน LINE", uri: `https://line.me/ti/p/~${s.lineId}` } },
      ],
    },
  }));
  return {
    type: "flex",
    altText: `📞 ติดต่อฝ่ายขาย DK · ${SHOP.hours} · โทรร้าน ${SHOP.phone}`,
    contents: { type: "carousel", contents: [intro, ...staff] },
  };
}

// เช็คแต้ม: บัตรย่อสีตามระดับ + หลอดความคืบหน้า + ปุ่มเปิดบัตร/ของรางวัล
export function pointsFlex(o: { name: string; tierName: string; tierEmoji: string; tierColor: string; points: number; totalEarned: number; tierMin: number; next: { name: string; emoji: string; min: number } | null; inactiveRealTier?: string }): Msg {
  const theme = tierTheme(o.tierName, o.tierColor);
  // ระดับพักอยู่ (ไม่มีบิลเกิน 1 ปี): แต้มสะสมเกินเกณฑ์ระดับถัดไปแล้ว หลอดจะหลอกตา → แสดงกล่องเตือนแทนหลอด
  const showProgress = !!o.next && !o.inactiveRealTier;
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
            { type: "text", text: `${o.tierEmoji} ${o.tierName}`, size: "xs", color: theme.text, weight: "bold", align: "end" },
          ] },
          { type: "text", text: o.name, size: "md", color: theme.text, weight: "bold", margin: "sm", wrap: true },
          { type: "text", text: fmt(o.points), size: "3xl", color: theme.text, weight: "bold", margin: "md" },
          { type: "text", text: "แต้มคงเหลือ", size: "xs", color: theme.text },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px",
        contents: [
          ...(showProgress ? progressBlock(o.totalEarned, o.next!, theme.bar) : []),
          ...(!o.next ? [
            { type: "text", text: "🏆 ระดับสูงสุดแล้ว ขอบคุณที่ไว้วางใจ DK ค่ะ", size: "sm", color: BRAND.ink, wrap: true },
            progressBar(100, theme.bar),
          ] : []),
          ...(o.inactiveRealTier ? [{
            type: "box", layout: "vertical", backgroundColor: BRAND.warnBg, cornerRadius: "md", paddingAll: "10px", spacing: "xs",
            contents: [
              { type: "text", text: `⚠️ ระดับสะสมของคุณคือ ${o.inactiveRealTier}`, size: "sm", weight: "bold", color: BRAND.warn, wrap: true },
              { type: "text", text: "ซื้อสินค้า 1 บิล เพื่อกลับสู่ระดับเดิม", size: "xs", color: BRAND.ink, wrap: true },
            ],
          }] : []),
          { type: "text", text: "ทุก 100 บาท = 1 แต้ม · แต้มมีอายุ 1 ปี", size: "xs", color: BRAND.muted, wrap: true, margin: "md" },
        ],
      },
      footer: {
        type: "box", layout: "horizontal", spacing: "sm", paddingAll: "12px",
        contents: [
          btn("🎴 เปิดบัตร", { type: "uri", uri: SHOP.liffUrl }, BRAND.blue),
          btn("🎁 ของรางวัล", { type: "uri", uri: SHOP.rewardsUrl }, BRAND.blue, "secondary"),
        ],
      },
    },
  };
}
