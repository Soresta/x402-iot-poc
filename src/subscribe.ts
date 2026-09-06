/**
 * subscribe.ts — consent-first email capture for the demo page (W5 REV).
 *
 * The list belongs to the company; the plumbing is ours. Nothing here talks to
 * a company system: the form posts to this Worker and the address is stored in
 * our own KV. Export is a manual CSV pull, handed over weekly.
 *
 * Data minimisation, deliberately:
 *   email · timestamp · source
 * and nothing else. No IP is stored, no user agent, no fingerprint. A rate-limit
 * counter is keyed on a hash of the IP and expires within the hour — that is a
 * throttle, not a record.
 *
 * Consent is explicit and recorded with the subscription: the checkbox must be
 * ticked or the request is refused. An address obtained without a clear yes is
 * worth less than no address at all.
 *
 * EXPORT SECURITY: the CSV endpoint fails closed. If `EXPORT_TOKEN` is not
 * configured the endpoint returns 503 and exports nothing, because an
 * unprotected export on a public Worker is an email list published to the
 * internet.
 */

const DOCS_URL = "https://github.com/Soresta/x402-iot-poc#errors";

const KEY_PREFIX = "sub:";
const MAX_EMAIL_LENGTH = 254; // RFC 5321
const SUBMIT_QUOTA = 5;
const SUBMIT_WINDOW_S = 3600;

export interface Subscriber {
  email: string;
  ts: string;
  source: string;
  consent: true;
}

/** Deliberately permissive: the goal is to catch typos, not to police addresses. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(value) && value.length <= MAX_EMAIL_LENGTH;
}

/** Short, non-reversible key for throttling. Not stored as a record. */
async function throttleKey(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const hex = Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `subrl:${hex}`;
}

/**
 * POST /api/subscribe
 * Body: JSON or form-encoded — { email, consent, source? }
 */
export async function subscribeHandler(c: any) {
  if (!c.env.IOT_KV) {
    return c.json({ error: "kv_unavailable", docs_url: DOCS_URL }, 503);
  }

  let payload: Record<string, unknown> = {};
  try {
    const contentType = c.req.header("content-type") ?? "";
    payload = contentType.includes("application/json")
      ? await c.req.json()
      : Object.fromEntries((await c.req.formData()) as any);
  } catch {
    return c.json({ error: "subscribe_malformed", docs_url: DOCS_URL }, 400);
  }

  const email = String(payload.email ?? "").trim().toLowerCase();
  const consent = payload.consent === true || payload.consent === "true" || payload.consent === "on";
  const source = String(payload.source ?? "demo-page").slice(0, 64);

  if (!looksLikeEmail(email)) {
    return c.json({ error: "subscribe_invalid_email", docs_url: DOCS_URL }, 400);
  }

  // No consent, no subscription. This is the whole point of the checkbox.
  if (!consent) {
    return c.json({ error: "subscribe_consent_required", docs_url: DOCS_URL }, 400);
  }

  // Throttle by IP so the form cannot be used to stuff the list.
  const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
  const rlKey = await throttleKey(ip);
  const count = Number((await c.env.IOT_KV.get(rlKey)) ?? "0");
  if (count >= SUBMIT_QUOTA) {
    return c.json({ error: "rate_limit_exceeded", docs_url: DOCS_URL }, 429, {
      "Retry-After": String(SUBMIT_WINDOW_S),
    });
  }
  await c.env.IOT_KV.put(rlKey, String(count + 1), { expirationTtl: SUBMIT_WINDOW_S });

  const key = `${KEY_PREFIX}${email}`;
  const existing = await c.env.IOT_KV.get(key);
  if (existing) {
    // Already subscribed is a success from the visitor's point of view, and
    // saying so does not leak anything they did not already know.
    return c.json({ ok: true, already_subscribed: true });
  }

  const record: Subscriber = {
    email,
    ts: new Date().toISOString(),
    source,
    consent: true,
  };
  await c.env.IOT_KV.put(key, JSON.stringify(record));

  return c.json({ ok: true, already_subscribed: false });
}

/**
 * GET /api/subscribers.csv?token=...
 *
 * Fails closed: without a configured token the list is not exported at all.
 */
export async function exportSubscribersHandler(c: any) {
  const configured = c.env.EXPORT_TOKEN;

  if (!configured) {
    return c.json(
      { error: "export_not_configured", docs_url: DOCS_URL },
      503
    );
  }

  const supplied =
    c.req.query("token") ?? (c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");

  if (!supplied || supplied !== configured) {
    return c.json({ error: "export_unauthorized", docs_url: DOCS_URL }, 401);
  }

  if (!c.env.IOT_KV) {
    return c.json({ error: "kv_unavailable", docs_url: DOCS_URL }, 503);
  }

  const rows: string[] = ["email,timestamp,source,consent"];
  let cursor: string | undefined;

  do {
    const page = await c.env.IOT_KV.list({ prefix: KEY_PREFIX, cursor });
    for (const entry of page.keys) {
      const raw = await c.env.IOT_KV.get(entry.name);
      if (!raw) continue;
      try {
        const s = JSON.parse(raw) as Subscriber;
        // Quote every field: an address containing a comma must not shift columns.
        rows.push(
          [s.email, s.ts, s.source, "true"].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
        );
      } catch {}
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return new Response(rows.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/** GET /api/subscribers/count — public, aggregate only, no addresses. */
export async function subscriberCountHandler(c: any) {
  if (!c.env.IOT_KV) {
    return c.json({ error: "kv_unavailable", docs_url: DOCS_URL }, 503);
  }
  let count = 0;
  let cursor: string | undefined;
  do {
    const page = await c.env.IOT_KV.list({ prefix: KEY_PREFIX, cursor });
    count += page.keys.length;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return c.json({ subscribers: count });
}
