/**
 * index.ts — Hono Worker entry point for x402-iot-poc
 *
 * Week 2 routes (preserved as evidence artifacts):
 *   GET /reading — x402-gated simulated reading (legacy, Week 2 proof)
 *
 * Week 3 routes:
 *   GET /api/readings        — x402-gated reading from DeviceTwin DO
 *   GET /api/device/status   — DO health: seq, nextAlarmAt
 *   GET /api/device/history  — ring buffer, newest first, ?limit=n (1–50)
 *   GET /api/receipts        — public settlement log, ?limit=n
 *   GET /.well-known/agent-card.json — A2A Agent Card for discovery
 *   GET /api/events          — SSE settlement feed
 *   GET /                    — Live demo page
 */

import { Hono, type MiddlewareHandler } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Env } from "./types";
import { DeviceTwin } from "./device-twin";
import { agentCardHandler } from "./agent-card";
import { demoPageHandler, sseHandler } from "./demo";
import { verifyPresentedMandate } from "./mandate";

export { DeviceTwin };

const app = new Hono<{ Bindings: Env }>();

const DOCS_URL = "https://github.com/Soresta/x402-iot-poc#errors";

// ---------------------------------------------------------------------------
// Week 2 — GET /reading (preserved regression check)
// ---------------------------------------------------------------------------

let legacyPayment: MiddlewareHandler | undefined;

app.use("/reading", async (c, next) => {
  legacyPayment ??= paymentMiddleware(
    {
      "GET /reading": {
        accepts: {
          scheme: "exact",
          price: "$0.001",
          network: "eip155:84532",
          payTo: c.env.PAY_TO as `0x${string}`,
        },
        description: "One simulated IoT sensor reading (Week 2 legacy route)",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer(
      new HTTPFacilitatorClient({ url: c.env.FACILITATOR_URL })
    ).register("eip155:84532", new ExactEvmScheme())
  );
  return legacyPayment(c, next);
});

app.get("/reading", (c) =>
  c.json({
    device_id: "sim-sensor-01",
    temperature_c: Number((18 + Math.random() * 6).toFixed(2)),
    ts: new Date().toISOString(),
    note: "TESTNET — no real value",
  })
);

// ---------------------------------------------------------------------------
// DeviceTwin helper
// ---------------------------------------------------------------------------

/**
 * Read the signed payment proof off the request.
 *
 * GOTCHA (found in Week 3 verification): the installed x402 generation
 * (@x402/core v2) sends the proof as `payment-signature`, not `X-PAYMENT`.
 * Keying only on `X-PAYMENT` silently disabled rate limiting and the KV
 * idempotency check for every real buyer. Accept both names.
 */
function getPaymentHeader(c: any): string | undefined {
  return (
    c.req.header("payment-signature") ||
    c.req.header("PAYMENT-SIGNATURE") ||
    c.req.header("X-PAYMENT") ||
    c.req.header("x-payment")
  );
}

/** Decode a base64 / base64url payment proof. Returns null if unreadable. */
function decodePaymentHeader(header: string): any | null {
  try {
    return JSON.parse(atob(header.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/** "$0.001" → 1000 atomic units (USDC has 6 decimals). */
function priceToAtomic(price: string): number {
  return Math.round(parseFloat(price.replace(/[^0-9.]/g, "")) * 1_000_000);
}

/** "$0.001" → 0.001 as a number. */
function priceToUsdc(price: string): number {
  return parseFloat(price.replace(/[^0-9.]/g, ""));
}

/** The address funding a payment, or null if the proof cannot be read. */
function payerFromPaymentHeader(header: string): string | null {
  const decoded = decodePaymentHeader(header);
  return decoded?.payload?.authorization?.from || decoded?.from || null;
}

/**
 * Pre-verification screen: reject proofs that are structurally wrong for this
 * resource with a distinct, machine-readable code (ERRORS.md).
 *
 * This never approves a payment. Anything it does not reject still goes to the
 * facilitator for real verification, so the fail-closed path is unchanged. Its
 * only job is to turn the middleware's opaque `{}` 402 into a usable error code.
 */
function screenPayment(c: any, header: string): { error: string } | null {
  const decoded = decodePaymentHeader(header);
  if (!decoded) return null; // unreadable → let the middleware refuse it

  const auth = decoded?.payload?.authorization;
  const accepted = decoded?.accepted;
  if (!auth || !accepted) return null;

  const expectedNetwork = "eip155:84532";
  const expectedAsset = (c.env.USDC_ASSET || "").toLowerCase();
  const expectedPayTo = (c.env.PAY_TO || "").toLowerCase();
  const requiredAmount = priceToAtomic(c.env.PRICE_PER_READING);

  if (accepted.network && accepted.network !== expectedNetwork) {
    return { error: "payment_network_invalid" };
  }
  if (expectedAsset && accepted.asset && accepted.asset.toLowerCase() !== expectedAsset) {
    return { error: "payment_network_invalid" };
  }
  if (expectedPayTo && auth.to && auth.to.toLowerCase() !== expectedPayTo) {
    return { error: "payment_recipient_invalid" };
  }
  if (auth.value !== undefined && Number(auth.value) < requiredAmount) {
    return { error: "payment_amount_invalid" };
  }
  return null;
}

function getTwin(c: any) {
  const id = c.env.DEVICE_TWIN.idFromName(c.env.DEVICE_ID || "sim-sensor-01");
  return c.env.DEVICE_TWIN.get(id);
}

// ---------------------------------------------------------------------------
// Week 3 — GET /api/readings (rate limiting, x402-gated, fail-closed, receipt log)
// ---------------------------------------------------------------------------

let readingsPayment: MiddlewareHandler | undefined;

app.use("/api/readings", async (c, next) => {
  const paymentHeader = getPaymentHeader(c);

  // Rate Limiting Firewall (runs BEFORE payment verification / facilitator call)
  if (paymentHeader && c.env.IOT_KV) {
    const payerAddress = payerFromPaymentHeader(paymentHeader);

    if (payerAddress) {
      const windowMs = (Number(c.env.RATE_LIMIT_WINDOW_S) || 60) * 1000;
      const quota = Number(c.env.RATE_LIMIT_QUOTA) || 10;
      const rlKey = `rl:${payerAddress.toLowerCase()}`;
      const now = Date.now();

      const rawWindow = await c.env.IOT_KV.get(rlKey);
      const timestamps: number[] = rawWindow ? JSON.parse(rawWindow) : [];
      const windowStart = now - windowMs;
      const fresh = timestamps.filter((t) => t >= windowStart);

      if (fresh.length >= quota) {
        const oldestTs = fresh[0];
        const retryAfter = Math.ceil((oldestTs + windowMs - now) / 1000);
        return c.json(
          {
            error: "rate_limit_exceeded",
            docs_url: DOCS_URL,
            retry_after_seconds: retryAfter,
          },
          429,
          { "Retry-After": String(retryAfter) }
        );
      }

      fresh.push(now);
      await c.env.IOT_KV.put(rlKey, JSON.stringify(fresh), {
        expirationTtl: Math.ceil(windowMs / 1000) + 60,
      });
    }
  }

  // Identity + authorization (401 / 403). Runs before payment (402), because
  // an agent that is not who it claims to be, or is not authorized to buy this,
  // should be turned away before any money moves.
  const mandateHeader = c.req.header("X-Agent-Mandate") || c.req.header("x-agent-mandate");
  const mandateRequired = String(c.env.REQUIRE_MANDATE) === "true";

  if (mandateHeader) {
    const result = await verifyPresentedMandate(
      mandateHeader,
      priceToUsdc(c.env.PRICE_PER_READING),
      paymentHeader ? payerFromPaymentHeader(paymentHeader) : null
    );
    if (!result.ok) {
      return c.json({ error: result.error, docs_url: DOCS_URL }, result.status);
    }
  } else if (mandateRequired) {
    return c.json({ error: "mandate_required", docs_url: DOCS_URL }, 403);
  }

  // Structured-error screen (C5). Runs after rate limiting, before settlement.
  if (paymentHeader) {
    const screened = screenPayment(c, paymentHeader);
    if (screened) {
      return c.json({ error: screened.error, docs_url: DOCS_URL }, 402);
    }
  }

  readingsPayment ??= paymentMiddleware(
    {
      "GET /api/readings": {
        accepts: {
          scheme: "exact",
          price: c.env.PRICE_PER_READING as `$${string}`,
          network: "eip155:84532",
          payTo: c.env.PAY_TO as `0x${string}`,
        },
        description: "One real-time IoT sensor reading from DeviceTwin",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer(
      new HTTPFacilitatorClient({ url: c.env.FACILITATOR_URL })
    ).register("eip155:84532", new ExactEvmScheme())
  );

  try {
    const res = await readingsPayment(c, next);
    const finalRes = c.res || res;
    const paymentResponseHeader = finalRes.headers.get("payment-response") || finalRes.headers.get("Payment-Response");

    if (paymentResponseHeader && c.env.IOT_KV) {
      try {
        const decoded = JSON.parse(atob(paymentResponseHeader.replace(/-/g, "+").replace(/_/g, "/")));
        const txHash = decoded?.transaction || null;
        const payer = decoded?.payer || null;

        const receipt = {
          payer,
          amount: c.env.PRICE_PER_READING,
          asset: "USDC",
          network: "eip155:84532",
          txHash,
          timestamp: new Date().toISOString(),
        };

        const rawLog = await c.env.IOT_KV.get("receipt_log");
        const log: typeof receipt[] = rawLog ? JSON.parse(rawLog) : [];
        log.unshift(receipt);
        if (log.length > 100) log.length = 100;
        await c.env.IOT_KV.put("receipt_log", JSON.stringify(log));

        // SSE broadcast
        const event = {
          type: "payment_settled",
          ts: receipt.timestamp,
          payer,
          amount: c.env.PRICE_PER_READING,
          txHash,
        };
        await c.env.IOT_KV.put("latest_event", JSON.stringify(event), { expirationTtl: 3600 });
      } catch (e) {}
    }

    return res;
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "facilitator_error",
        docs_url: DOCS_URL,
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "5",
        },
      }
    );
  }
});

app.get("/api/readings", async (c) => {
  const paymentHeader = getPaymentHeader(c);

  if (paymentHeader && c.env.IOT_KV) {
    const encoder = new TextEncoder();
    const data = encoder.encode(paymentHeader);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    const idempotencyKey = `idem:${hashHex}`;

    const existing = await c.env.IOT_KV.get(idempotencyKey);
    if (existing !== null) {
      return c.json({ error: "payment_already_used", docs_url: DOCS_URL }, 402);
    }

    // Save idempotency key
    await c.env.IOT_KV.put(idempotencyKey, "1", { expirationTtl: 86400 });
  }

  try {
    const twin = getTwin(c);
    const reading = await twin.getLatestReading();
    return c.json(reading);
  } catch (err) {
    return c.json({ error: "device_twin_error", docs_url: DOCS_URL }, 503);
  }
});

// ---------------------------------------------------------------------------
// Device endpoints
// ---------------------------------------------------------------------------

app.get("/api/device/status", async (c) => {
  try {
    const twin = getTwin(c);
    const status = await twin.getStatus();
    return c.json(status);
  } catch (err) {
    return c.json({ error: "device_twin_error", docs_url: DOCS_URL }, 503);
  }
});

app.get("/api/device/history", async (c) => {
  const limitParam = Number(c.req.query("limit") ?? "10");
  const limit = Number.isFinite(limitParam) ? limitParam : 10;

  try {
    const twin = getTwin(c);
    const history = await twin.getHistory(limit);
    return c.json(history);
  } catch (err) {
    return c.json({ error: "device_twin_error", docs_url: DOCS_URL }, 503);
  }
});

// ---------------------------------------------------------------------------
// Receipts endpoint
// ---------------------------------------------------------------------------

app.get("/api/receipts", async (c) => {
  const limitParam = Number(c.req.query("limit") ?? "10");
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitParam) ? limitParam : 10));

  if (!c.env.IOT_KV) {
    return c.json({ error: "kv_unavailable", docs_url: DOCS_URL }, 503);
  }

  const rawLog = await c.env.IOT_KV.get("receipt_log");
  const log = rawLog ? JSON.parse(rawLog) : [];
  return c.json(log.slice(0, limit));
});

// ---------------------------------------------------------------------------
// Agent Card discovery
// ---------------------------------------------------------------------------

app.get("/.well-known/agent-card.json", agentCardHandler);

// ---------------------------------------------------------------------------
// Demo page + SSE
// ---------------------------------------------------------------------------

app.get("/api/events", sseHandler);
app.get("/", demoPageHandler);

export default app;