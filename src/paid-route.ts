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

/** Per-payer sliding window in KV. Returns a 429 response, or null to continue. */
async function enforceRateLimit(c: any, payerAddress: string): Promise<Response | null> {
  const windowMs = (Number(c.env.RATE_LIMIT_WINDOW_S) || 60) * 1000;
  const quota = Number(c.env.RATE_LIMIT_QUOTA) || 10;
  const rlKey = `rl:${payerAddress.toLowerCase()}`;
  const now = Date.now();

  const rawWindow = await c.env.IOT_KV.get(rlKey);
  const timestamps: number[] = rawWindow ? JSON.parse(rawWindow) : [];
  const fresh = timestamps.filter((t) => t >= now - windowMs);

  if (fresh.length >= quota) {
    const retryAfter = Math.ceil((fresh[0] + windowMs - now) / 1000);
    return c.json(
      { error: "rate_limit_exceeded", docs_url: DOCS_URL, retry_after_seconds: retryAfter },
      429,
      { "Retry-After": String(retryAfter) }
    );
  }

  fresh.push(now);
  await c.env.IOT_KV.put(rlKey, JSON.stringify(fresh), {
    expirationTtl: Math.ceil(windowMs / 1000) + 60,
  });
  return null;
}

/** Record a settlement: receipt log for the API, latest_event for the SSE feed. */
async function recordSettlement(c: any, header: string, price: string, resource: string) {
  const decoded = decodeB64Json(header);
  if (!decoded) return;

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
}

export function createPaidRoute(config: PaidRouteConfig): MiddlewareHandler {
  let payment: MiddlewareHandler | undefined;

  return async (c, next) => {
    const env = c.env as any;
    const price = env[config.priceVar] as string;
    const paymentHeader = getPaymentHeader(c);

    // --- 429: rate limit, before any facilitator call ------------------------
    if (paymentHeader && env.IOT_KV) {
      const payer = payerFromPaymentHeader(paymentHeader);
      if (payer) {
        const limited = await enforceRateLimit(c, payer);
        if (limited) return limited;
      }
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
 * KNOWN LIMITATION, stated rather than implied away: the key is written after
 * settlement has already completed. If the Worker dies in between, the same
 * proof could be accepted again. The on-chain EIP-3009 nonce is an independent
 * second barrier, so practical risk is low — but this layer alone does not
 * close the window.
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
