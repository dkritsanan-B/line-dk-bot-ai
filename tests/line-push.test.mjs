// ตัวส่ง LINE กลาง: กันโควตาไว้ให้ข้อความสำคัญ — ไม่ยิง LINE จริง (fetch ปลอม)
import { test, eq, ok } from "./_harness.mjs";
import { shouldSend, pushLine, getQuota, _resetQuotaCache, RESERVE_NOTICE, RESERVE_COURTESY } from "../lib/line-push.ts";

const q = (remaining, limit = 300) => ({ limit, used: limit - remaining, remaining, checkedAt: Date.now() });

function fakeLine({ limit = 300, used = 0, pushStatus = 200, quotaDown = false } = {}) {
  const calls = [];
  const f = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method ?? "GET", body: opts.body });
    const u = String(url);
    if (u.endsWith("/message/quota")) return quotaDown ? new Response("x", { status: 500 }) : Response.json({ type: "limited", value: limit });
    if (u.endsWith("/message/quota/consumption")) return quotaDown ? new Response("x", { status: 500 }) : Response.json({ totalUsage: used });
    if (u.endsWith("/message/push")) return new Response(pushStatus === 200 ? "{}" : "err", { status: pushStatus });
    throw new Error("ไม่ควรเรียก " + u);
  };
  return { f, calls, pushes: () => calls.filter(c => c.url.endsWith("/message/push")) };
}

test("ตัดสิน: โควตาเหลือเยอะ ส่งได้ทุกระดับ", () => {
  for (const p of ["critical", "notice", "courtesy"]) eq(shouldSend(p, q(250)).ok, true, p);
});

test("ตัดสิน: ใกล้หมด หยุดทักทายก่อน แล้วค่อยหยุดแจ้งเตือน · ข้อความสำคัญส่งจนหมดจริง", () => {
  eq(shouldSend("courtesy", q(RESERVE_COURTESY)).ok, false);
  eq(shouldSend("notice", q(RESERVE_COURTESY)).ok, true);
  eq(shouldSend("notice", q(RESERVE_NOTICE)).ok, false);
  eq(shouldSend("critical", q(RESERVE_NOTICE)).ok, true);
  eq(shouldSend("critical", q(1)).ok, true);
  eq(shouldSend("critical", q(0)).ok, false);
});

test("ตัดสิน: ไม่รู้โควตา หรือแพ็กเกจไม่จำกัด → ส่งได้ (ตัวนับล่มต้องไม่ทำให้ระบบเงียบ)", () => {
  eq(shouldSend("courtesy", null).ok, true);
  eq(shouldSend("courtesy", { limit: null, used: 999, remaining: null, checkedAt: Date.now() }).ok, true);
});

test("ส่งจริง (fetch ปลอม): เหลือเยอะ → ยิง push 1 ครั้ง พร้อมข้อความครบ", async () => {
  _resetQuotaCache();
  const L = fakeLine({ used: 10 });
  const r = await pushLine("Uabc", [{ type: "text", text: "a" }, { type: "text", text: "b" }], "notice", L.f);
  eq(r.sent, true);
  eq(L.pushes().length, 1);
  eq(JSON.parse(L.pushes()[0].body).messages.length, 2);
});

test("ส่งจริง: โควตาเหลือน้อย → ข้ามข้อความวันเกิด ไม่ยิง push เลย", async () => {
  _resetQuotaCache();
  const L = fakeLine({ used: 300 - 50 });
  const r = await pushLine("Uabc", { type: "text", text: "สุขสันต์วันเกิด" }, "courtesy", L.f);
  eq(r.sent, false);
  ok(r.skipped && r.skipped.includes("กันโควตา"));
  eq(L.pushes().length, 0);
});

test("นับข้อความที่ส่งไปในเครื่องนี้ด้วย (ตัวเลข LINE อัปเดตช้า) → ไม่หลุดเกินเพดาน", async () => {
  _resetQuotaCache();
  const L = fakeLine({ used: 300 - RESERVE_NOTICE - 1 });   // เหลือ RESERVE+1 → notice ส่งได้อีก 1 ข้อความพอดี
  eq((await pushLine("U1", { type: "text", text: "1" }, "notice", L.f)).sent, true);
  eq((await pushLine("U2", { type: "text", text: "2" }, "notice", L.f)).sent, false, "ข้อความที่สองต้องถูกกันไว้");
  eq((await pushLine("U3", { type: "text", text: "3" }, "critical", L.f)).sent, true, "ข้อความสำคัญยังส่งได้");
});

test("LINE ตอบ 429 (หมดจริง) → ไม่ throw และข้อความถัดไปถูกข้ามทันที", async () => {
  _resetQuotaCache();
  const L = fakeLine({ used: 0, pushStatus: 429 });
  const r = await pushLine("U1", { type: "text", text: "x" }, "critical", L.f);
  eq(r.sent, false);
  eq(r.status, 429);
  const after = await getQuota(L.f);
  eq(after.remaining, 0);
});

test("ถามโควตาไม่ได้ → ยังส่งได้ และไม่ throw", async () => {
  _resetQuotaCache();
  const L = fakeLine({ quotaDown: true });
  eq((await pushLine("U1", { type: "text", text: "x" }, "courtesy", L.f)).sent, true);
});

test("ไม่มีผู้รับ → ไม่ยิงอะไร", async () => {
  _resetQuotaCache();
  const L = fakeLine();
  eq((await pushLine("", { type: "text", text: "x" }, "critical", L.f)).sent, false);
  eq(L.calls.length, 0);
});
