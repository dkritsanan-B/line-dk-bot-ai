let cachedFaq = "";
let cacheExpiresAt = 0;

const CACHE_TTL_MS = 60 * 1000;

export async function getFaqContent(): Promise<string> {
  if (Date.now() < cacheExpiresAt && cachedFaq) {
    return cachedFaq;
  }

  try {
    const url = process.env.SHEET_CSV_URL;
    if (!url) throw new Error("SHEET_CSV_URL is not set");

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const csv = await res.text();
    cachedFaq = csv;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return cachedFaq;
  } catch (err) {
    console.error("[sheet] fetch error:", err);
    // return stale cache (or empty string on first failure)
    return cachedFaq;
  }
}
