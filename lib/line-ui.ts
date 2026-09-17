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

const btn = (label: string, action: Msg, color = BRAND.blue, style: "primary" | "secondary" | "link" = "primary"): Msg =>
  ({ type: "button", style, height: "md", color: style === "primary" ? color : undefined, action: { label, ...action } });

type NoticeRow = { label: string; value: string; color?: string };
type NoticeTone = "celebrate" | "info" | "warn" | "neutral";
type NoticeMetric = { value: string; unit?: string; caption: string; color?: string; size?: "xl" | "xxl" | "3xl" };
type NoticeButton = { label: string; action: Msg; style?: "primary" | "secondary"; color?: string };

const TONE_STYLE: Record<NoticeTone, { background: string; eyebrow: string; title: string }> = {
  celebrate: { background: BRAND.yellow, eyebrow: BRAND.navy, title: BRAND.navy },
  info: { background: BRAND.navy, eyebrow: BRAND.yellow, title: "#FFFFFF" },
  warn: { background: BRAND.warnBg, eyebrow: BRAND.warn, title: BRAND.ink },
  neutral: { background: "#EEF1F6", eyebrow: BRAND.muted, title: BRAND.ink },
};

const noticeBtn = (button: NoticeButton): Msg => ({
  type: "button",
  style: button.style ?? "primary",
  height: "md",
  color: (button.style ?? "primary") === "primary" ? (button.color ?? BRAND.blue) : undefined,
  action: { label: button.label, ...button.action },
});

function memberNoticeFlex(o: {
  altText: string;
  eyebrow: string;
  title: string;
  message: string;
  tone?: NoticeTone;
  metric?: NoticeMetric;
  rows?: NoticeRow[];
  bodyExtra?: Msg[];
  buttons?: NoticeButton[];
  note?: string;
  hero?: { url: string; aspectRatio?: string };
}): Msg {
  const tone = TONE_STYLE[o.tone ?? "info"];
  const rows = (o.rows ?? []).slice(0, 3);
  const buttons = (o.buttons ?? []).slice(0, 2);
  const bubble: Msg = {
    type: "bubble", size: "kilo",
    ...(o.hero ? { hero: { type: "image", url: o.hero.url, size: "full", aspectRatio: o.hero.aspectRatio ?? "20:13", aspectMode: "cover" } } : {}),
    header: {
      type: "box", layout: "vertical", backgroundColor: tone.background, paddingAll: "18px", spacing: "sm",
      contents: [
        { type: "text", text: o.eyebrow, size: "xs", weight: "bold", color: tone.eyebrow },
        { type: "text", text: o.title, size: "xl", weight: "bold", color: tone.title, wrap: true },
      ],
    },
    body: {
      type: "box", layout: "vertical", paddingAll: "18px", spacing: "md",
      contents: [
        ...(o.metric ? [{
          type: "box", layout: "vertical", spacing: "xs",
          contents: [
            {
              type: "text", wrap: true,
              contents: [
                { type: "span", text: o.metric.value, size: o.metric.size ?? (o.metric.value.length > 12 ? "xl" : "3xl"), weight: "bold", color: o.metric.color ?? BRAND.blue },
                ...(o.metric.unit ? [{ type: "span", text: ` ${o.metric.unit}`, size: "md", weight: "bold", color: o.metric.color ?? BRAND.blue }] : []),
              ],
            },
            { type: "text", text: o.metric.caption, size: "xs", color: BRAND.muted, wrap: true },
          ],
        }] : []),
        { type: "text", text: o.message, size: "sm", color: BRAND.ink, wrap: true },
        ...(o.bodyExtra ?? []),
        ...(rows.length ? [{
          type: "box", layout: "vertical", spacing: "sm", backgroundColor: BRAND.panel, cornerRadius: "md", paddingAll: "12px",
          contents: rows.map((row) => ({
            type: "box", layout: "horizontal", spacing: "sm", alignItems: "center",
            contents: [
              { type: "text", text: row.label, size: "sm", color: BRAND.muted, flex: 6, wrap: true },
              { type: "text", text: row.value, size: "sm", weight: "bold", color: row.color ?? BRAND.navy, align: "end", flex: 6, wrap: true },
            ],
          })),
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
  return {
    type: "flex",
    altText: o.altText,
    contents: bubble,
  };
}

type NextTier = { name: string; emoji?: string; min: number };

const progressBlock = (totalEarned: number, tierMin: number, next: NextTier): Msg[] => {
  const remaining = Math.max(0, next.min - totalEarned);
  const range = Math.max(1, next.min - tierMin);
  const pct = Math.max(4, Math.min(100, Math.round(((totalEarned - tierMin) / range) * 100)));
  return [
    { type: "text", text: `สะสมอีก ${remaining.toLocaleString()} แต้ม เป็น ${next.emoji ? `${next.emoji} ` : ""}${next.name}`, size: "sm", weight: "bold", color: BRAND.ink, wrap: true },
    { type: "box", layout: "vertical", backgroundColor: "#E6EAF1", cornerRadius: "6px", height: "8px",
      contents: [{ type: "box", layout: "vertical", backgroundColor: BRAND.blue, cornerRadius: "6px", height: "8px", width: `${pct}%`, contents: [] }] },
    { type: "text", text: `สะสมแล้ว ${totalEarned.toLocaleString()} / ${next.min.toLocaleString()} แต้ม`, size: "xs", color: BRAND.muted },
  ];
};

export function pointsEarnedFlex(o: {
  name: string; points: number; balance: number; billNo: string;
  tierName?: string; tierEmoji?: string; totalEarned?: number; tierMin?: number; next?: NextTier | null;
}): Msg {
  const hasProgress = o.next && o.totalEarned != null;
  return memberNoticeFlex({
    altText: `⭐ +${o.points.toLocaleString()} แต้ม · ดูแต้มและของรางวัล`,
    eyebrow: `DK MEMBER${o.tierName ? ` · ${o.tierEmoji ?? ""} ${o.tierName}` : ""}`,
    title: "แต้มเข้าแล้ว",
    message: `${o.name} บันทึกแต้มจากการซื้อครั้งนี้เรียบร้อยค่ะ`,
    tone: "info",
    metric: { value: `+${o.points.toLocaleString()}`, unit: "แต้ม", caption: `จากบิล ${o.billNo}`, color: BRAND.success },
    rows: [{ label: "แต้มคงเหลือ", value: `${o.balance.toLocaleString()} แต้ม` }],
    bodyExtra: hasProgress ? progressBlock(o.totalEarned!, o.tierMin ?? 0, o.next!) : undefined,
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

function tierBenefits(tierName: string): { lines: string[]; primary: NoticeMetric } {
  const { discount, steelBonus, birthday } = MEMBER_BENEFITS[tierName] ?? MEMBER_BENEFITS.Welcome;
  const lines = [
    ...(discount > 0 ? [`✓ ส่วนลดหน้าร้านสูงสุด ${fmtRate(discount)}%`] : ["✓ รับแต้มทุก 100 บาท = 1 แต้ม"]),
    ...(steelBonus > 0 ? [`✓ โบนัสแต้มหมวดเหล็ก ${fmtRate(steelBonus)}%`] : []),
    ...(birthday > 0 ? [`✓ แต้มของขวัญวันเกิด ${birthday.toLocaleString()} แต้ม`] : []),
  ].slice(0, 3);
  return {
    lines,
    primary: discount > 0
      ? { value: fmtRate(discount), unit: "%", caption: "ส่วนลดหน้าร้านสูงสุดตามระดับ", color: BRAND.navy }
      : { value: birthday.toLocaleString(), unit: "แต้ม", caption: "ของขวัญวันเกิดทุกปี", color: BRAND.navy },
  };
}

export function tierUpFlex(o: { name: string; tierName: string; tierEmoji: string; points: number; earned: number; billNo: string }): Msg {
  const benefits = tierBenefits(o.tierName);
  return memberNoticeFlex({
    altText: `🎉 ${o.tierName} แล้ว · ดูสิทธิ์สมาชิกใหม่`,
    eyebrow: "DK MEMBER · เลื่อนระดับ",
    title: `ยินดีด้วย! คุณคือสมาชิก ${o.tierName}`,
    message: `${o.name} ปลดล็อกสิทธิ์ระดับ ${o.tierName} เรียบร้อยค่ะ`,
    tone: "celebrate",
    metric: benefits.primary,
    bodyExtra: benefits.lines.map((line) => ({ type: "text", text: line, size: "sm", color: BRAND.ink, wrap: true })),
    note: `บิล ${o.billNo} · ได้ +${o.earned.toLocaleString()} แต้ม · คงเหลือ ${o.points.toLocaleString()} แต้ม`,
    buttons: [{ label: `🎴 ดูบัตร ${o.tierName} ของฉัน`, action: { type: "uri", uri: SHOP.liffUrl } }],
  });
}

export function birthdayGiftFlex(o: { name: string; tierName: string; tierEmoji: string; points: number }): Msg {
  return memberNoticeFlex({
    altText: `🎂 +${o.points.toLocaleString()} แต้มวันเกิด · ใช้แลกของรางวัล`,
    eyebrow: `DK MEMBER · ${o.tierEmoji} ${o.tierName}`,
    title: `สุขสันต์วันเกิด${o.name}`,
    message: `ขอให้ปีนี้งานเข้าไม่ขาดสาย ขอบคุณที่เป็นสมาชิก ${o.tierName} ค่ะ`,
    tone: "celebrate",
    metric: { value: `+${o.points.toLocaleString()}`, unit: "แต้ม", caption: "ของขวัญวันเกิดเข้าบัญชีแล้ว", color: BRAND.success },
    buttons: [{ label: "🎁 ใช้แต้มแลกของรางวัล", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

export function pointsExpiringFlex(o: { name: string; points: number; daysLeft: number; expiryDate: string; balance?: number }): Msg {
  return memberNoticeFlex({
    altText: `⏳ ${o.points.toLocaleString()} แต้ม · แลกก่อนหมดอายุ`,
    eyebrow: "DK MEMBER · แจ้งเตือนแต้ม",
    title: `เหลือ ${o.daysLeft.toLocaleString()} วันก่อนแต้มหมดอายุ`,
    message: "ใช้แต้มก้อนนี้ก่อนครบกำหนดค่ะ",
    tone: "warn",
    metric: { value: o.points.toLocaleString(), unit: "แต้ม", caption: `หมดอายุ ${o.expiryDate} (อีก ${o.daysLeft.toLocaleString()} วัน)`, color: BRAND.warn },
    rows: o.balance == null ? undefined : [{ label: "แต้มคงเหลือ", value: `${o.balance.toLocaleString()} แต้ม` }],
    buttons: [{ label: "🎁 แลกของรางวัลตอนนี้", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

export function pointsExpiredFlex(o: { name: string; points: number; balance: number }): Msg {
  return memberNoticeFlex({
    altText: `🔔 ${o.points.toLocaleString()} แต้มหมดอายุ · แลกยอดที่เหลือ`,
    eyebrow: "DK MEMBER · แจ้งผลแต้ม",
    title: `แต้มหมดอายุ ${o.points.toLocaleString()} แต้ม`,
    message: "แต้มส่วนที่ครบ 1 ปีหมดอายุตามรอบค่ะ",
    tone: "neutral",
    metric: { value: o.balance.toLocaleString(), unit: "แต้ม", caption: "แต้มคงเหลือในบัญชี", color: BRAND.blue },
    buttons: [{ label: "🎁 แลกของรางวัล", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

export function redemptionRequestedFlex(o: { rewardName: string; points: number; requestId: number; availablePoints: number }): Msg {
  return memberNoticeFlex({
    altText: `🎁 #REQ-${o.requestId} จองแล้ว · แสดงที่เคาน์เตอร์`,
    eyebrow: "DK MEMBER · แลกของรางวัล",
    title: "จองของรางวัลแล้ว",
    message: "ระบบจองแต้มไว้แล้ว กรุณาแสดงหมายเลขนี้ที่เคาน์เตอร์ค่ะ",
    tone: "info",
    metric: { value: `#REQ-${o.requestId}`, caption: "แสดงหมายเลขนี้ที่เคาน์เตอร์", color: BRAND.blue },
    rows: [
      { label: "ของรางวัล", value: o.rewardName },
      { label: "แต้มที่จอง", value: `${o.points.toLocaleString()} แต้ม` },
      { label: "แต้มใช้ได้หลังจอง", value: `${o.availablePoints.toLocaleString()} แต้ม` },
    ],
    buttons: [
      { label: "🎁 ดูคำขอของฉัน", action: { type: "uri", uri: SHOP.rewardsUrl } },
      { label: "📍 เส้นทางไปร้าน", action: { type: "uri", uri: SHOP.mapsUrl }, style: "secondary" },
    ],
  });
}

export function redemptionConfirmedFlex(o: { rewardName: string; points: number; balance: number }): Msg {
  return memberNoticeFlex({
    altText: `✅ รับ ${o.rewardName} แล้ว · ดูรางวัลถัดไป`,
    eyebrow: "DK MEMBER · แลกสำเร็จ",
    title: "รับของรางวัลเรียบร้อย",
    message: "พนักงานยืนยันการรับของและหักแต้มเรียบร้อยแล้วค่ะ",
    tone: "info",
    metric: { value: o.rewardName, size: "xl", caption: `แลกด้วย ${o.points.toLocaleString()} แต้ม`, color: BRAND.navy },
    rows: [{ label: "แต้มคงเหลือ", value: `${o.balance.toLocaleString()} แต้ม` }],
    buttons: [{ label: "🎁 ดูของรางวัลถัดไป", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

export function redemptionCancelledFlex(o: { rewardName: string; points: number; requestId: number; reason?: string }): Msg {
  return memberNoticeFlex({
    altText: `↩️ #REQ-${o.requestId} ยกเลิกแล้ว · เลือกรางวัลใหม่`,
    eyebrow: "DK MEMBER · ยกเลิกคำขอ",
    title: `ยกเลิกคำขอ #REQ-${o.requestId} แล้ว`,
    message: "แต้มที่จองไว้กลับเข้าใช้ในบัญชีเรียบร้อยแล้วค่ะ",
    tone: "neutral",
    metric: { value: `+${o.points.toLocaleString()}`, unit: "แต้ม", caption: "คืนเข้าบัญชีแล้ว", color: BRAND.success },
    rows: [
      { label: "ของรางวัล", value: o.rewardName },
      ...(o.reason ? [{ label: "เหตุผล", value: o.reason }] : []),
    ],
    buttons: [{ label: "🎁 เลือกของรางวัลอื่น", action: { type: "uri", uri: SHOP.rewardsUrl } }],
  });
}

export function tierExpiryWarningFlex(o: { name: string; tierName?: string; deadline?: string; lastPurchaseDate?: string }): Msg {
  const title = o.tierName ? `รักษาระดับ ${o.tierName} ไว้` : "รักษาระดับสมาชิกไว้";
  return memberNoticeFlex({
    altText: `📌 ระดับจะลด · ซื้อ 1 บิล${o.deadline ? `ภายใน ${o.deadline}` : "เพื่อคงระดับ"}`,
    eyebrow: "DK MEMBER · รักษาระดับ",
    title,
    message: `${o.name} ซื้อสินค้า 1 บิลก่อนครบ 1 ปีนับจากการซื้อล่าสุด เพื่อคงระดับไว้ค่ะ`,
    tone: "warn",
    metric: o.deadline
      ? { value: `ภายใน ${o.deadline}`, size: "xl", caption: "ซื้อ 1 บิลเพื่อคงระดับ", color: BRAND.warn }
      : { value: "1", unit: "บิล", caption: "ซื้อก่อนครบ 1 ปีเพื่อคงระดับ", color: BRAND.warn },
    rows: o.lastPurchaseDate ? [{ label: "ซื้อล่าสุด", value: o.lastPurchaseDate }] : undefined,
    buttons: [
      { label: "📞 ติดต่อฝ่ายขาย", action: { type: "message", text: "ติดต่อฝ่ายขาย" } },
      { label: "🎴 ดูบัตรสมาชิก", action: { type: "uri", uri: SHOP.liffUrl }, style: "secondary" },
    ],
  });
}

// ข้อความต้อนรับตอนเพิ่มเพื่อน — การ์ดเดียว มีปุ่มพาไปทำสิ่งที่คนส่วนใหญ่ต้องการ
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
        type: "box", layout: "vertical", spacing: "md", paddingAll: "20px",
        contents: [
          { type: "text", text: "ยินดีต้อนรับสู่ DK 👋", weight: "bold", size: "xl", color: BRAND.ink },
          { type: "text", text: "วัสดุก่อสร้าง เหล็ก เครื่องมือช่าง เมทัลชีท ท่อ PVC ปั๊มน้ำ ครบจบที่เดียว", size: "sm", color: BRAND.muted, wrap: true },
          { type: "separator", margin: "md" },
          ...[
            ["⭐", "สะสมแต้ม", "ทุก 100 บาท = 1 แต้ม เข้าอัตโนมัติจากบิล"],
            ["🏷️", "ส่วนลดสมาชิก", `ลดสูงสุด ${maxDiscount}% ตามระดับ`],
            ["🎁", "ของรางวัล + วันเกิด", "แลกแต้มที่ร้าน รับแต้มของขวัญวันเกิดทุกปี"],
          ].map(([ic, t, d]) => ({
            type: "box", layout: "horizontal", spacing: "md", alignItems: "center",
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
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px",
        contents: [
          btn("🎴 สมัครสมาชิกฟรี", { type: "uri", uri: SHOP.liffUrl }, BRAND.blue),
          btn("📞 ติดต่อฝ่ายขาย", { type: "message", text: "ติดต่อฝ่ายขาย" }, BRAND.blue, "secondary"),
          btn("📍 แผนที่ร้าน", { type: "uri", uri: SHOP.mapsUrl }, BRAND.blue, "secondary"),
          { type: "text", text: `${SHOP.hours} · โทร ${SHOP.phone}`, size: "xs", color: BRAND.muted, align: "center", margin: "sm" },
        ],
      },
    },
  };
}

// ติดต่อฝ่ายขาย: การ์ดพนักงาน 4 ใบ ดีไซน์เดิม (แบนเนอร์ DK + รูปใหญ่ + โทร/เพิ่มเพื่อน + เวลาทำการ) — เจ้าของเทียบแล้วชอบแบบเดิมมากกว่า (14 ก.ย. 69)
// เพิ่มจากเดิมแค่เบอร์ร้านในบรรทัดเวลาทำการ · quick reply แนบตอนส่ง
export function contactFlex(): Msg {
  const bubbles: Msg[] = SALES_STAFF.map((s) => ({
    type: "bubble", size: "kilo",
    hero: { type: "image", url: `${SHOP.base}/herobanner2.png`, size: "full", aspectRatio: "20:13", aspectMode: "cover" },
    body: {
      type: "box", layout: "vertical", paddingAll: "0px",
      contents: [
        { type: "box", layout: "vertical", paddingStart: "20px", paddingEnd: "20px", paddingTop: "12px",
          contents: [{ type: "image", url: s.photo, size: "full", aspectRatio: "10:9", aspectMode: "cover" }] },
        { type: "box", layout: "vertical", paddingTop: "8px", paddingBottom: "4px", paddingStart: "12px", paddingEnd: "12px", spacing: "xs",
          contents: [
            { type: "text", text: s.name, size: "lg", weight: "bold", color: BRAND.ink, align: "center" },
            { type: "text", text: "ฝ่ายขาย", size: "xs", color: BRAND.muted, align: "center" },
            { type: "text", text: s.phone, size: "sm", color: BRAND.ink, align: "center" },
          ] },
      ],
    },
    footer: {
      type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px",
      contents: [
        { type: "button", style: "primary", height: "sm", color: BRAND.blue, action: { type: "uri", label: `📞 โทรหา${s.name}`, uri: `tel:${s.tel}` } },
        { type: "button", style: "primary", height: "sm", color: BRAND.line, action: { type: "uri", label: "🟢 เพิ่มเพื่อน LINE", uri: `https://line.me/ti/p/~${s.lineId}` } },
        { type: "box", layout: "vertical", margin: "sm",
          contents: [
            { type: "text", text: `${SHOP.hours} · ${SHOP.phone}`, size: "xxs", color: BRAND.muted, align: "center", wrap: true },
          ] },
      ],
    },
  }));
  return { type: "flex", altText: `📞 ติดต่อฝ่ายขาย DK วัสดุก่อสร้าง · โทรร้าน ${SHOP.phone}`, contents: { type: "carousel", contents: bubbles } };
}

// เช็คแต้ม: บัตรย่อสีตามระดับ + หลอดความคืบหน้า + ปุ่มเปิดบัตร/ของรางวัล
export function pointsFlex(o: { name: string; tierName: string; tierEmoji: string; tierColor: string; points: number; totalEarned: number; tierMin: number; next: { name: string; emoji: string; min: number } | null; inactiveRealTier?: string }): Msg {
  const pct = o.next ? Math.max(4, Math.min(100, Math.round(((o.totalEarned - o.tierMin) / (o.next.min - o.tierMin)) * 100))) : 100;
  const tierText = TIER_TEXT[o.tierName] ?? "#FFFFFF";
  const tierMuted = tierText === "#FFFFFF" ? "#FFFFFFB3" : BRAND.navy;
  return {
    type: "flex",
    altText: `⭐ ${o.points.toLocaleString()} แต้ม · เปิดดูบัตร ${o.tierName}`,
    contents: {
      type: "bubble", size: "kilo",
      header: {
        type: "box", layout: "vertical", backgroundColor: o.tierName === "Silver" ? TIER_HEADER_SILVER : o.tierColor, paddingAll: "18px",
        contents: [
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "MEMBER", size: "xs", color: tierMuted, weight: "bold" },
            { type: "text", text: `${o.tierEmoji} ${o.tierName}`, size: "xs", color: tierText, weight: "bold", align: "end" },
          ] },
          { type: "text", text: o.name, size: "md", color: tierText, weight: "bold", margin: "sm", wrap: true },
          { type: "text", text: o.points.toLocaleString(), size: "3xl", color: tierText, weight: "bold", margin: "md" },
          { type: "text", text: "แต้มคงเหลือ", size: "xs", color: tierMuted },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px",
        contents: [
          o.next
            ? { type: "text", text: `สะสมอีก ${Math.max(0, o.next.min - o.totalEarned).toLocaleString()} แต้ม เพื่อเลื่อนเป็น ${o.next.emoji} ${o.next.name}`, size: "sm", weight: "bold", color: BRAND.ink, wrap: true }
            : { type: "text", text: "🏆 ระดับสูงสุดแล้ว ขอบคุณที่ไว้วางใจ DK ค่ะ", size: "sm", color: BRAND.ink },
          { type: "box", layout: "vertical", backgroundColor: "#E6EAF1", cornerRadius: "6px", height: "8px",
            contents: [{ type: "box", layout: "vertical", backgroundColor: o.tierColor, cornerRadius: "6px", height: "8px", width: `${pct}%`, contents: [] }] },
          ...(o.next ? [{ type: "text", text: `สะสมแล้ว ${o.totalEarned.toLocaleString()} / ${o.next.min.toLocaleString()} แต้ม`, size: "xs", color: BRAND.muted }] : []),
          ...(o.inactiveRealTier ? [{ type: "text", text: `⚠️ ระดับสะสมคือ ${o.inactiveRealTier} · ซื้อสินค้า 1 บิลเพื่อกลับสู่ระดับเดิม`, size: "xs", color: BRAND.warn, wrap: true }] : []),
          { type: "text", text: "ทุก 100 บาท = 1 แต้ม · แต้มมีอายุ 1 ปี", size: "xs", color: BRAND.muted, wrap: true },
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

// สีหัวการ์ดตามระดับ (Flex ไม่รองรับ gradient ในทุก client → ใช้สีทึบที่เข้ากับบัตรใน LIFF)
export const TIER_COLOR: Record<string, string> = {
  Diamond: "#1565C0", Platinum: "#546E7A", Gold: "#F9A825", Silver: "#78909C", Bronze: "#8D6E63", Welcome: "#2B5FB8",
};

// หัว Silver ใช้เงินอ่อน (สีจากบัตร LIFF) เพื่อให้ตัวน้ำเงินคอนทราสต์เกิน 4.5:1 · แถบความคืบหน้ายังใช้ TIER_COLOR
const TIER_HEADER_SILVER = "#B0BEC5";

// Gold/Silver เป็นพื้นสว่าง จึงใช้ตัวอักษรน้ำเงินเพื่อให้คอนทราสต์ผ่าน
export const TIER_TEXT: Record<string, string> = {
  Diamond: "#FFFFFF", Platinum: "#FFFFFF", Gold: BRAND.navy, Silver: BRAND.navy, Bronze: "#FFFFFF", Welcome: "#FFFFFF",
};
