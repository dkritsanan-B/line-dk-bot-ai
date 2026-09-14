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
export const BRAND = { navy: "#0B2A5B", blue: "#1B5FC1", yellow: "#F5C518", orange: "#F26A1B", line: "#06C755", ink: "#16213A", muted: "#6B7A90", sky: "#E8F0FC" };
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
  ({ type: "button", style, height: "sm", color: style === "primary" ? color : undefined, action: { label, ...action } });

// ข้อความต้อนรับตอนเพิ่มเพื่อน — การ์ดเดียว มีปุ่มพาไปทำสิ่งที่คนส่วนใหญ่ต้องการ
export function welcomeFlex(): Msg {
  return {
    type: "flex",
    altText: `ยินดีต้อนรับสู่ ${SHOP.name} 🏗️ สมัครสมาชิกรับแต้ม ส่วนลด และของรางวัล`,
    contents: {
      type: "bubble",
      size: "mega",
      hero: { type: "image", url: `${SHOP.base}/herobanner2.png`, size: "full", aspectRatio: "20:13", aspectMode: "cover" },
      body: {
        type: "box", layout: "vertical", spacing: "md", paddingAll: "20px",
        contents: [
          { type: "text", text: "ยินดีต้อนรับค่ะ 👋", weight: "bold", size: "xl", color: BRAND.ink },
          { type: "text", text: "วัสดุก่อสร้าง เหล็ก เครื่องมือช่าง เมทัลชีท ท่อ PVC ปั๊มน้ำ ครบจบที่เดียว", size: "sm", color: BRAND.muted, wrap: true },
          { type: "separator", margin: "md" },
          ...[
            ["⭐", "สะสมแต้ม", "ทุก 100 บาท = 1 แต้ม เข้าอัตโนมัติจากบิล"],
            ["🏷️", "ส่วนลดสมาชิก", "ยิ่งซื้อ ยิ่งลด ตามระดับสมาชิก"],
            ["🎁", "ของรางวัล + วันเกิด", "แลกแต้มที่ร้าน รับคูปองวันเกิดทุกปี"],
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
          btn("🎴 สมัครสมาชิกฟรี", { type: "uri", uri: SHOP.liffUrl }, BRAND.orange),
          btn("📞 ติดต่อฝ่ายขาย", { type: "message", text: "ติดต่อฝ่ายขาย" }, BRAND.blue),
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
            { type: "text", text: s.name, size: "lg", weight: "bold", color: "#1A1A1A", align: "center" },
            { type: "text", text: "ฝ่ายขาย", size: "xs", color: "#888888", align: "center" },
            { type: "text", text: s.phone, size: "sm", color: "#555555", align: "center" },
          ] },
      ],
    },
    footer: {
      type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px",
      contents: [
        { type: "button", style: "primary", height: "sm", color: "#2E3192", action: { type: "uri", label: `📞 โทรหา${s.name}`, uri: `tel:${s.tel}` } },
        { type: "button", style: "primary", height: "sm", color: BRAND.line, action: { type: "uri", label: "🟢 เพิ่มเพื่อน LINE", uri: `https://line.me/ti/p/~${s.lineId}` } },
        { type: "box", layout: "vertical", margin: "sm",
          contents: [
            { type: "text", text: `🕐 เวลาทำการ 8:00 - 17:00 · โทรร้าน ${SHOP.phone}`, size: "xs", color: "#888888", align: "center", wrap: true },
            { type: "text", text: "เปิดทุกวัน จันทร์ - เสาร์", size: "xs", color: "#888888", align: "center" },
          ] },
      ],
    },
  }));
  return { type: "flex", altText: `📞 ติดต่อฝ่ายขาย DK วัสดุก่อสร้าง · โทรร้าน ${SHOP.phone}`, contents: { type: "carousel", contents: bubbles } };
}

// เช็คแต้ม: บัตรย่อสีตามระดับ + หลอดความคืบหน้า + ปุ่มเปิดบัตร/ของรางวัล
export function pointsFlex(o: { name: string; tierName: string; tierEmoji: string; tierColor: string; points: number; totalEarned: number; tierMin: number; next: { name: string; emoji: string; min: number } | null; inactiveRealTier?: string }): Msg {
  const pct = o.next ? Math.max(4, Math.min(100, Math.round(((o.totalEarned - o.tierMin) / (o.next.min - o.tierMin)) * 100))) : 100;
  return {
    type: "flex",
    altText: `${o.tierEmoji} ${o.tierName} · แต้มคงเหลือ ${o.points.toLocaleString()} แต้ม`,
    contents: {
      type: "bubble", size: "kilo",
      header: {
        type: "box", layout: "vertical", backgroundColor: o.tierColor, paddingAll: "18px",
        contents: [
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "MEMBER", size: "xxs", color: "#FFFFFFB3", weight: "bold" },
            { type: "text", text: `${o.tierEmoji} ${o.tierName}`, size: "xs", color: "#FFFFFF", weight: "bold", align: "end" },
          ] },
          { type: "text", text: o.name, size: "md", color: "#FFFFFF", weight: "bold", margin: "sm", wrap: true },
          { type: "text", text: o.points.toLocaleString(), size: "3xl", color: "#FFFFFF", weight: "bold", margin: "md" },
          { type: "text", text: "แต้มคงเหลือ", size: "xxs", color: "#FFFFFFB3" },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px",
        contents: [
          o.next
            ? { type: "text", text: `อีก ${(o.next.min - o.totalEarned).toLocaleString()} แต้ม ถึง ${o.next.emoji} ${o.next.name}`, size: "sm", color: BRAND.ink }
            : { type: "text", text: "🏆 ระดับสูงสุดแล้ว ขอบคุณที่ไว้วางใจ DK ค่ะ", size: "sm", color: BRAND.ink },
          { type: "box", layout: "vertical", backgroundColor: "#E6EAF1", cornerRadius: "6px", height: "8px",
            contents: [{ type: "box", layout: "vertical", backgroundColor: o.tierColor, cornerRadius: "6px", height: "8px", width: `${pct}%`, contents: [] }] },
          ...(o.inactiveRealTier ? [{ type: "text", text: `⚠️ ระดับจริงคือ ${o.inactiveRealTier} — ซื้อครั้งเดียวกลับมาทันที`, size: "xs", color: BRAND.orange, wrap: true }] : []),
          { type: "text", text: "ทุก 100 บาท = 1 แต้ม · แต้มมีอายุ 1 ปี", size: "xxs", color: BRAND.muted },
        ],
      },
      footer: {
        type: "box", layout: "horizontal", spacing: "sm", paddingAll: "12px",
        contents: [
          btn("🎴 เปิดบัตร", { type: "uri", uri: SHOP.liffUrl }, BRAND.blue),
          btn("🎁 ของรางวัล", { type: "uri", uri: SHOP.rewardsUrl }, BRAND.orange),
        ],
      },
    },
  };
}

// สีหัวการ์ดตามระดับ (Flex ไม่รองรับ gradient ในทุก client → ใช้สีทึบที่เข้ากับบัตรใน LIFF)
export const TIER_COLOR: Record<string, string> = {
  Diamond: "#1565C0", Platinum: "#546E7A", Gold: "#F9A825", Silver: "#78909C", Bronze: "#8D6E63", Welcome: "#2B5FB8",
};
