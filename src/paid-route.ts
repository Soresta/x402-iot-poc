/**
 * paid-route.ts — one gate, reused by every priced resource.
 *
 * Week 3 and 4 built the gate inline on `/api/readings`: rate limit, mandate
 * verification, payment screen, settlement, receipt, SSE event, fail-closed
 * handling. Week 5 adds a second priced resource, and copying ninety lines of
 * payment logic to do it would be the wrong answer twice over — the copy drifts,
 * and a security control that exists on one route but not the other is exactly
 * the kind of silent gap this project has already been bitten by.
 *
 * So the gate moved here. `createPaidRoute()` returns a Hono middleware; both
 * resources are the same code with a different price and description.
 *
 * Order of checks, cheapest and most conclusive first:
 *
 *   429  rate limit    per payer, KV sliding window
 *   401  identity      mandate signature, and holder-is-payer
 *   403  mandate       expiry, caps, scope
 *   402  payment       screen, then facilitator settlement
 *   503  upstream      facilitator unreachable → serve nothing
 *
 * GOTCHA: the x402 middleware must be constructed inside the request handler.
 * At module scope Workers restricts the crypto it needs. Each route memoises
 * its own instance on first request.
 */

import type { MiddlewareHandler } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { verifyPresentedMandate } from "./mandate";

export const DOCS_URL = "https://github.com/Soresta/x402-iot-poc#errors";
const NETWORK = "eip155:84532";

export interface PaidRouteConfig {
  /** Hono route key, e.g. "GET /api/readings" */
  routeKey: string;
  /** Which env var holds this resource's price, e.g. "PRICE_PER_READING" */
  priceVar: string;
  /** Human description shown in the 402 payment requirements */
  description: string;
  /** Short id recorded on receipts and SSE events, e.g. "readings" */
  resource: string;
  /**
   * Optional input check, run FIRST — before rate limiting, the mandate and the
   * 402. A request that can never succeed should be refused before the buyer is
   * asked to sign anything.
   */
  validate?: (c: any) => { status: 400; error: string } | null;
}

/** Read the signed payment proof off the request.
 *
 * GOTCHA (found in Week 3 verification): the installed x402 generation
 * (@x402/core v2) sends the proof as `payment-signature`, not `X-PAYMENT`.
 * Keying only on `X-PAYMENT` silently disabled rate limiting and the KV
 * idempotency check for every real buyer. Accept both names. */
export function getPaymentHeader(c: any): string | undefined {
  return (
    c.req.header("payment-signature") ||
    c.req.header("PAYMENT-SIGNATURE") ||
    c.req.header("X-PAYMENT") ||
    c.req.header("x-payment")
  );
}

/** Decode a base64 / base64url payload. Returns null if unreadable. */
export function decodeB64Json(value: string): any | null {
  try {
    return JSON.parse(atob(value.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/** The address funding a payment, or null if the proof cannot be read. */
export function payerFromPaymentHeader(header: string): string | null {
  const decoded = decodeB64Json(header);
  return decoded?.payload?.authorization?.from || decoded?.from || null;
}

/** "$0.001" → 1000 atomic units (USDC has 6 decimals). */
function priceToAtomic(price: string): number {
  return Math.round(parseFloat(price.replace(/[^0-9.]/g, "")) * 1_000_000);
}

/** "$0.001" → 0.001 as a number. */
function priceToUsdc(price: string): number {
  return parseFloat(price.replace(/[^0-9.]/g, ""));
}

/**
 * Pre-settlement screen: reject proofs that are structurally wrong for this
 * resource with a distinct, machine-readable code.
 *
 * This never approves a payment. Anything it does not reject still goes to the
 * facilitator for real verification, so the fail-closed path is unchanged. Its
 * only job is to turn the middleware's opaque `{}` 402 into a usable code.
 */
export function screenPayment(c: any, header: string, price: string): { error: string } | null {
  const decoded = decodeB64Json(header);
  const auth = decoded?.payload?.authorization;
  const accepted = decoded?.accepted;
  if (!auth || !accepted) return null;

  const expectedAsset = (c.env.USDC_ASSET || "").toLowerCase();
  const expectedPayTo = (c.env.PAY_TO || "").toLowerCase();

  if (accepted.network && accepted.network !== NETWORK) {
    return { error: "payment_network_invalid" };
  }
  if (expectedAsset && accepted.asset && accepted.asset.toLowerCase() !== expectedAsset) {
    return { error: "payment_network_invalid" };
  }
  if (expectedPayTo && auth.to && auth.to.toLowerCase() !== expectedPayTo) {
    return { error: "payment_recipient_invalid" };
  }
  if (auth.value !== undefined && Number(auth.value) < priceToAtomic(price)) {
    return { error: "payment_amount_invalid" };
  }
  return null;
}

/**
 * Two sliding-window buckets, each held in its own RateLimiter Durable Object so
 * the count is exact under concurrency. A request must fit in both.
 *
 * The KV limiter this replaces let 30 of 30 simultaneous requests through a
 * quota of 10 — see src/rate-limiter.ts for the measurement.
 *
 * Returns a 429 response, or null to continue.
 */
async function enforceRateLimit(c: any, payerAddress: string | null): Promise<Response | null> {
  const env = c.env;
  const windowMs = (Number(env.RATE_LIMIT_WINDOW_S) || 60) * 1000;
  const payerQuota = Number(env.RATE_LIMIT_QUOTA) || 10;
  const ipQuota = Number(env.IP_RATE_LIMIT_QUOTA) || 60;

  if (!env.RATE_LIMITER) return null; // binding absent: payment is still verified downstream

  // CF-Connecting-IP is set by Cloudflare and cannot be supplied by the client.
  // The payer address is NOT verified at this point — it is whatever the client
  // put in the proof — so it cannot be the only bucket.
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const buckets: Array<[string, number]> = [[`ip:${ip}`, ipQuota]];
  if (payerAddress) buckets.push([`payer:${payerAddress.toLowerCase()}`, payerQuota]);

  for (const [name, quota] of buckets) {
    const stub = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(name));
    const { allowed, retryAfter } = await stub.hit(windowMs, quota);
    if (!allowed) {
      return c.json(
        { error: "rate_limit_exceeded", docs_url: DOCS_URL, retry_after_seconds: retryAfter },
        429,
        { "Retry-After": String(retryAfter) }
      );
    }
  }
  return null;
}

/**
 * Record a settlement: receipt log for the API, latest_event for the SSE feed.
 *
 * ONLY if it actually settled. The middleware sets a `payment-response` header on
 * failure too — `{"success":false,"errorReason":…}` — and this function used to
 * record anything carrying that header. Every failed settlement since week 3
 * became a receipt with no transaction hash, and was counted as a settlement by
 * the demo page, /api/payers and /api/metrics/daily. Found 2026-09-11: 3 of the
 * last 100 receipts on the deployed Worker, two of them the "transient failures"
 * from the week 5 soak run that the demo page had quietly counted as sales.
 *
 * Returns whether a receipt was written, so a test can assert on it.
 */
export async function recordSettlement(
  c: any,
  header: string,
  price: string,
  resource: string
): Promise<boolean> {
  const decoded = decodeB64Json(header);
  if (!decoded || decoded.success !== true || !decoded.transaction) return false;

  const receipt = {
    payer: decoded.payer ?? null,
    amount: price,
    asset: "USDC",
    network: NETWORK,
    resource,
    txHash: decoded.transaction ?? null,
    timestamp: new Date().toISOString(),
  };

  const rawLog = await c.env.IOT_KV.get("receipt_log");
  const log: (typeof receipt)[] = rawLog ? JSON.parse(rawLog) : [];
  log.unshift(receipt);
  if (log.length > 100) log.length = 100;
  await c.env.IOT_KV.put("receipt_log", JSON.stringify(log));

  await c.env.IOT_KV.put(
    "latest_event",
    JSON.stringify({
      type: "payment_settled",
      ts: receipt.timestamp,
      payer: receipt.payer,
      amount: price,
      resource,
      txHash: receipt.txHash,
    }),
    { expirationTtl: 3600 }
  );
  return true;
}

/**
 * Is this receipt a real settlement?
 *
 * Receipts written before the fix above can describe a settlement that failed.
 * They are left in the log rather than deleted — the log is a record — and every
 * reader filters them out through this one function.
 */
export function isSettledReceipt(receipt: any): boolean {
  return typeof receipt?.txHash === "string" && receipt.txHash.length > 0;
}

export function createPaidRoute(config: PaidRouteConfig): MiddlewareHandler {
  let payment: MiddlewareHandler | undefined;

  return async (c, next) => {
    const env = c.env as any;
    const price = env[config.priceVar] as string;
    const paymentHeader = getPaymentHeader(c);

    // --- 400: input that can never succeed, before anything else -------------
    if (config.validate) {
      const invalid = config.validate(c);
      if (invalid) {
        return c.json({ error: invalid.error, docs_url: DOCS_URL }, invalid.status);
      }
    }

    // --- 429: rate limit, before any facilitator call ------------------------
    // Only requests carrying a proof can cost us a facilitator call, so only
    // those are counted.
    if (paymentHeader) {
      const limited = await enforceRateLimit(c, payerFromPaymentHeader(paymentHeader));
      if (limited) return limited;
    }

    // --- 401 / 403: identity and authorization, before any money moves -------
    const mandateHeader =
      c.req.header("X-Agent-Mandate") || c.req.header("x-agent-mandate");

    if (mandateHeader) {
      const result = await verifyPresentedMandate(
        mandateHeader,
        priceToUsdc(price),
        paymentHeader ? payerFromPaymentHeader(paymentHeader) : null,
        new URL(c.req.url).origin
      );
      if (!result.ok) {
        return c.json({ error: result.error, docs_url: DOCS_URL }, result.status);
      }
    } else if (String(env.REQUIRE_MANDATE) === "true") {
      return c.json({ error: "mandate_required", docs_url: DOCS_URL }, 403);
    }

    // --- 402: structured screen, then settlement -----------------------------
    if (paymentHeader) {
      const screened = screenPayment(c, paymentHeader, price);
      if (screened) {
        return c.json({ error: screened.error, docs_url: DOCS_URL }, 402);
      }
    }

    payment ??= paymentMiddleware(
      {
        [config.routeKey]: {
          accepts: {
            scheme: "exact",
            price: price as `$${string}`,
            network: NETWORK,
            payTo: env.PAY_TO as `0x${string}`,
          },
          description: config.description,
          mimeType: "application/json",
        },
      },
      new x402ResourceServer(
        new HTTPFacilitatorClient({ url: env.FACILITATOR_URL })
      ).register(NETWORK, new ExactEvmScheme())
    );

    // --- 503: fail closed ----------------------------------------------------
    try {
      const res = await payment(c, next);
      const finalRes = c.res || res;
      const paymentResponse =
        finalRes.headers.get("payment-response") || finalRes.headers.get("Payment-Response");

      if (paymentResponse && env.IOT_KV) {
        try {
          await recordSettlement(c, paymentResponse, price, config.resource);
        } catch {
          // A receipt we failed to write must never turn a paid, delivered
          // request into an error for the buyer.
        }
      }
      return res;
    } catch {
      return new Response(
        JSON.stringify({ error: "facilitator_error", docs_url: DOCS_URL }),
        {
          status: 503,
          headers: { "Content-Type": "application/json", "Retry-After": "5" },
        }
      );
    }
  };
}

/** SHA-256 of the payment proof — the idempotency key. */
export async function idempotencyKeyFor(paymentHeader: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(paymentHeader));
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `idem:${hex}`;
}

/**
 * Replay protection. Returns a 402 response if this exact proof was already
 * used, otherwise records it and returns null.
 *
 * ORDER, verified rather than assumed (2026-09-11). This runs inside the route
 * handler, and the x402 middleware settles only AFTER the handler returns a
 * status below 400. So the key is written BEFORE settlement: there is no window
 * in which a settled payment lacks its replay key. Earlier comments and docs in
 * this repo claimed the opposite, and were wrong.
 *
 * The real consequence runs the other way, and it is small: if the handler
 * then fails, or settlement fails, the key is already written but nothing was
 * charged. That proof now answers `payment_already_used` although the buyer
 * paid nothing. The x402 client signs a fresh authorization on the next 402, so
 * a retry still works — the error code is simply misleading in that one case.
 */
export async function rejectReplay(c: any): Promise<Response | null> {
  const paymentHeader = getPaymentHeader(c);
  if (!paymentHeader || !c.env.IOT_KV) return null;

  const key = await idempotencyKeyFor(paymentHeader);
  if ((await c.env.IOT_KV.get(key)) !== null) {
    return c.json({ error: "payment_already_used", docs_url: DOCS_URL }, 402);
  }
  await c.env.IOT_KV.put(key, "1", { expirationTtl: 86400 });
  return null;
}
