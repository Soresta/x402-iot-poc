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

function getTwin(c: any) {
  const id = c.env.DEVICE_TWIN.idFromName(c.env.DEVICE_ID || "sim-sensor-01");
  return c.env.DEVICE_TWIN.get(id);
}

// ---------------------------------------------------------------------------
// Week 3 — GET /api/readings (x402-gated, fail-closed, receipt log)
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
  // Check idempotency header & rate limiting inside handler
  const paymentHeader = c.req.header("X-PAYMENT") || c.req.header("x-payment");

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

    // Per-buyer rate limiting
    let payerAddress: string | null = null;
    try {
      const decoded = JSON.parse(atob(paymentHeader.replace(/-/g, "+").replace(/_/g, "/")));
      payerAddress = decoded?.payload?.authorization?.from || decoded?.from || null;
    } catch {}

    if (payerAddress && c.env.IOT_KV) {
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

    // Save idempotency key
    await c.env.IOT_KV.put(idempotencyKey, "1", { expirationTtl: 86400 });
  }

  // Fetch and return sensor reading from DeviceTwin DO
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