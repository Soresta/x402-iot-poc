/**
 * metrics.ts — funnel instrumentation (W6 REV).
 *
 * Counts where visitors came from, and joins that to the numbers this project
 * already produces (settlements, distinct payers, subscribers) so a daily
 * metrics log can be pulled from one endpoint instead of assembled by hand.
 *
 * WHAT IS STORED: a counter per (date, utm_source, utm_campaign). That is all.
 * No IP, no user agent, no cookie, no session, no path history. You cannot
 * identify a person from this data because there is nothing in it that belongs
 * to a person — it answers "how many arrived from dev.to today", not "who".
 *
 * KNOWN LIMITATION, stated rather than implied away: KV has no atomic
 * increment. Two visits landing in the same millisecond can read the same value
 * and write the same value, losing one. At the traffic this project expects
 * that is a rounding error; at real launch volume these counts are a floor, not
 * a precise total, and the daily log says so.
 */

const DOCS_URL = "https://github.com/Soresta/x402-iot-poc#errors";

/** Only values from the UTM naming sheet are recorded. Anything else becomes
 *  "other" — an open counter namespace is a way to get junk written into KV. */
const KNOWN_SOURCES = new Set([
  "devto",
  "x",
  "hn",
  "reddit",
  "directory",
  "email",
  "outreach",
  "github",
  "direct",
]);

const KNOWN_CAMPAIGNS = new Set([
  "w4-publish-wave-1",
  "w6-launch",
  "w7-adoption",
  "evergreen",
  "none",
]);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function clean(value: unknown, allowed: Set<string>, fallback: string): string {
  const v = String(value ?? "").toLowerCase().trim();
  return allowed.has(v) ? v : fallback;
}

/**
 * POST /api/visit  { source, campaign }
 *
 * Called once per page load by the demo page. Returns 204 — the visitor gets
 * nothing back, because there is nothing they need.
 */
export async function visitHandler(c: any) {
  if (!c.env.IOT_KV) return new Response(null, { status: 204 });

  let body: Record<string, unknown> = {};
  try {
    body = await c.req.json();
  } catch {
    // A malformed beacon is not worth an error page.
    return new Response(null, { status: 204 });
  }

  const source = clean(body.source, KNOWN_SOURCES, "direct");
  const campaign = clean(body.campaign, KNOWN_CAMPAIGNS, "none");
  const key = `visits:${today()}:${source}:${campaign}`;

  const current = Number((await c.env.IOT_KV.get(key)) ?? "0");
  // 45-day TTL: long enough for a nine-week programme to look back over a
  // launch, short enough that nothing accumulates forever.
  await c.env.IOT_KV.put(key, String(current + 1), { expirationTtl: 45 * 86400 });

  return new Response(null, { status: 204 });
}

/**
 * GET /api/metrics/daily?date=YYYY-MM-DD
 *
 * Everything this project can measure about itself, for one day. Public and
 * aggregate — the same numbers anyone can already derive from /api/receipts.
 */
export async function dailyMetricsHandler(c: any) {
  if (!c.env.IOT_KV) {
    return c.json({ error: "kv_unavailable", docs_url: DOCS_URL }, 503);
  }

  const dateParam = String(c.req.query("date") ?? today());
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today();

  // --- visits by source ---
  const visits: Record<string, number> = {};
  let visitsTotal = 0;
  let cursor: string | undefined;
  do {
    const page: any = await c.env.IOT_KV.list({ prefix: `visits:${date}:`, cursor });
    for (const entry of page.keys) {
      const [, , source, campaign] = entry.name.split(":");
      const n = Number((await c.env.IOT_KV.get(entry.name)) ?? "0");
      visits[`${source}/${campaign}`] = n;
      visitsTotal += n;
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  // --- settlements for that day, from the receipt log ---
  const rawLog = await c.env.IOT_KV.get("receipt_log");
  const log: any[] = rawLog ? JSON.parse(rawLog) : [];
  const dayReceipts = log.filter((r) => String(r.timestamp ?? "").startsWith(date));

  const byResource: Record<string, number> = {};
  let volume = 0;
  const payers = new Set<string>();
  for (const r of dayReceipts) {
    const resource = r.resource ?? "unlabelled";
    byResource[resource] = (byResource[resource] ?? 0) + 1;
    volume += parseFloat(String(r.amount ?? "").replace(/[^0-9.]/g, "")) || 0;
    if (r.payer) payers.add(String(r.payer).toLowerCase());
  }

  // --- subscribers (cumulative, not per-day) ---
  let subscribers = 0;
  cursor = undefined;
  do {
    const page: any = await c.env.IOT_KV.list({ prefix: "sub:", cursor });
    subscribers += page.keys.length;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return c.json({
    date,
    visits: { total: visitsTotal, by_source: visits },
    settlements: {
      total: dayReceipts.length,
      by_resource: byResource,
      volume_usdc: Number(volume.toFixed(6)),
      distinct_payers: payers.size,
    },
    subscribers_cumulative: subscribers,
    caveats: [
      "Visit counts are a floor: KV has no atomic increment, so concurrent visits can be undercounted.",
      "Settlement figures cover the last 100 receipts only; older days will read low.",
      "Nothing here identifies a visitor. No IP, user agent, cookie or session is stored.",
    ],
  });
}
