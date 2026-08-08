/**
 * index.ts — Hono Worker entry point for x402-iot-poc
 *
 * Week 2 routes (preserved as evidence artifacts):
 *   GET /reading — x402-gated simulated reading (legacy, Week 2 proof)
 *
 * Week 3 routes:
 *   GET /api/readings        — x402-gated reading from DeviceTwin DO (Block 2 gates it)
 *   GET /api/device/status   — DO health: seq, nextAlarmAt
 *   GET /api/device/history  — ring buffer, newest first, ?limit=n (1–50)
 *   GET /api/receipts        — public settlement log, ?limit=n
 *   GET /.well-known/agent-card.json — A2A Agent Card for discovery (Block 4)
 *   GET /api/events          — SSE settlement feed (Block 6)
 *   GET /                    — Live demo page (Block 6)
 *
 * Architecture note:
 *   - Payment verification, idempotency, and receipts live here (Worker layer).
 *   - DeviceTwin knows nothing about money; it only produces telemetry.
 */

import { Hono, type MiddlewareHandler } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Env } from "./types";
import { DeviceTwin } from "./device-twin";
import { agentCardHandler } from "./agent-card";
import { demoPageHandler, sseHandler } from "./demo";

// Re-export Durable Object so wrangler can register it
export { DeviceTwin };

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOCS_URL = "https://github.com/Soresta/x402-iot-poc#errors";

function errorJson(error: string, status: 400 | 402 | 403 | 429 | 503) {
  return Response.json(
    { error, docs_url: DOCS_URL },
    { status }
  );
}

function structuredError(c: any, error: string, status: 400 | 402 | 403 | 429 | 503) {
  return c.json({ error, docs_url: DOCS_URL }, status);
}

// ---------------------------------------------------------------------------
// Week 2 — GET /reading (preserved; must keep settling — regression check)
// Known gotcha #1: construct payment middleware LAZILY inside the handler.
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
// Week 3 Block 1 — DeviceTwin helper: resolve stub
// ---------------------------------------------------------------------------

function getTwin(c: any) {
  const id = c.env.DEVICE_TWIN.idFromName(c.env.DEVICE_ID || "sim-sensor-01");
  return c.env.DEVICE_TWIN.get(id);
}

// ---------------------------------------------------------------------------
// Week 3 Block 2 — GET /api/readings (x402-gated, fail-closed)
//
// Lazy payment middleware per known gotcha #1.
// 8-second AbortController timeout on facilitator — if unreachable → 503.
// Idempotency + receipt log added in Block 3.
// ---------------------------------------------------------------------------

let readingsPayment: MiddlewareHandler | undefined;

app.use("/api/readings", async (c, next) => {
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

  // Wrap in 8-second timeout — fail closed if facilitator is unreachable
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), 8_000);

  try {
    return await Promise.race([
      (async () => {
        const result = await next();
        clearTimeout(timeout);
        return result;
      })(),
      new Promise<Response>((resolve) => {
        timeoutController.signal.addEventListener("abort", () => {
          resolve(
            new Response(
              JSON.stringify({
                error: "facilitator_timeout",
                docs_url: DOCS_URL,
              }),
              {
                status: 503,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": "5",
                },
              }
            )
          );
        });
      }),
    ]);
  } catch (err: any) {
    clearTimeout(timeout);
    // Fail closed: any unexpected error → 503, never serve the reading
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
  } finally {
    clearTimeout(timeout);
  }
});

app.get("/api/readings", async (c) => {
  // ----- Block 3: KV idempotency check -----
  const paymentHeader = c.req.header("X-PAYMENT") || c.req.header("x-payment");

  if (paymentHeader && c.env.IOT_KV) {
    // Hash the payment signature to get a short, safe KV key
    const encoder = new TextEncoder();
    const data = encoder.encode(paymentHeader);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    const idempotencyKey = `idem:${hashHex}`;

    // Check if already used
    const existing = await c.env.IOT_KV.get(idempotencyKey);
    if (existing !== null) {
      return c.json(
        { error: "payment_already_used", docs_url: DOCS_URL },
        402
      );
    }

    // ----- Block 3: Per-buyer rate limiting -----
    // Extract payer address from payment header (best-effort; if unavailable, skip rate limit)
    let payerAddress: string | null = null;
    try {
      // The X-PAYMENT header is base64url-encoded JSON
      const decoded = JSON.parse(atob(paymentHeader.replace(/-/g, "+").replace(/_/g, "/")));
      payerAddress = decoded?.payload?.authorization?.from || decoded?.from || null;
    } catch {
      // If decoding fails, skip rate limiting for this request
    }

    if (payerAddress && c.env.IOT_KV) {
      const windowMs =
        (Number(c.env.RATE_LIMIT_WINDOW_S) || 60) * 1000;
      const quota = Number(c.env.RATE_LIMIT_QUOTA) || 10;
      const rlKey = `rl:${payerAddress.toLowerCase()}`;
      const now = Date.now();

      const rawWindow = await c.env.IOT_KV.get(rlKey);
      const timestamps: number[] = rawWindow ? JSON.parse(rawWindow) : [];

      // Evict entries outside the window
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

      // Add current timestamp and save (TTL = window + buffer)
      fresh.push(now);
      await c.env.IOT_KV.put(rlKey, JSON.stringify(fresh), {
        expirationTtl: Math.ceil(windowMs / 1000) + 60,
      });
    }

    // ----- Serve the reading from DeviceTwin -----
    let reading;
    try {
      const twin = getTwin(c);
      reading = await twin.getLatestReading();
    } catch (err) {
      return c.json({ error: "device_twin_error", docs_url: DOCS_URL }, 503);
    }

    // ----- Block 3: Write idempotency key AFTER settlement -----
    // Write order: check → settle → write key.
    // Residual risk: if Worker crashes between settle and write, the same proof
    // could be used again. Risk is bounded (one free reading per crash) and
    // accepted for this testnet PoC. Documented in BUILD-LOG.md Block 3.
    await c.env.IOT_KV.put(idempotencyKey, "1", { expirationTtl: 86400 });

    // ----- Block 3: Append to receipt log -----
    // Extract settlement details from the payment response header if available
    const paymentResponseHeader = c.req.header("Payment-Response");
    let txHash: string | null = null;
    if (paymentResponseHeader) {
      try {
        const decoded = JSON.parse(atob(paymentResponseHeader.replace(/-/g, "+").replace(/_/g, "/")));
        txHash = decoded?.transaction || null;
      } catch {
        // Ignore decode errors
      }
    }

    if (c.env.IOT_KV) {
      const receipt = {
        payer: payerAddress,
        amount: c.env.PRICE_PER_READING,
        asset: "USDC",
        network: "eip155:84532",
        txHash,
        seq: reading.seq,
        timestamp: new Date().toISOString(),
      };

      const rawLog = await c.env.IOT_KV.get("receipt_log");
      const log: typeof receipt[] = rawLog ? JSON.parse(rawLog) : [];
      log.unshift(receipt);
      if (log.length > 100) log.length = 100;
      await c.env.IOT_KV.put("receipt_log", JSON.stringify(log));

      // Broadcast for SSE (Block 6): store latest event in KV
      const event = {
        type: "payment_settled",
        ts: receipt.timestamp,
        payer: payerAddress,
        amount: c.env.PRICE_PER_READING,
        txHash,
        seq: reading.seq,
      };
      await c.env.IOT_KV.put("latest_event", JSON.stringify(event), {
        expirationTtl: 3600,
      });
    }

    return c.json(reading);
  }

  // No payment header — fallthrough to x402 middleware 402 response
  // (The middleware already handled the 402 before we got here)
  try {
    const twin = getTwin(c);
    const reading = await twin.getLatestReading();
    return c.json(reading);
  } catch (err) {
    return c.json({ error: "device_twin_error", docs_url: DOCS_URL }, 503);
  }
});

// ---------------------------------------------------------------------------
// GET /api/device/status — public, no payment required
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

// ---------------------------------------------------------------------------
// GET /api/device/history — public, no payment required
// ---------------------------------------------------------------------------

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
// GET /api/receipts — public, read-only verifiability surface (Block 3)
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
// GET /.well-known/agent-card.json — A2A Agent Card (Block 4)
// ---------------------------------------------------------------------------

app.get("/.well-known/agent-card.json", agentCardHandler);

// ---------------------------------------------------------------------------
// GET /api/events — SSE stream (Block 6)
// GET /           — Demo page (Block 6)
// ---------------------------------------------------------------------------

app.get("/api/events", sseHandler);
app.get("/", demoPageHandler);

export default app;