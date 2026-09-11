/**
 * index.ts — Hono Worker entry point for x402-iot-poc
 *
 * Routing only. Payment, identity and rate-limit logic live in paid-route.ts;
 * this file decides which routes go through it.
 *
 * Paid (x402 gate: 400 input → 429 rate → 401 identity → 403 mandate → 402 → 503)
 *   GET  /api/readings              one DeviceTwin reading            $0.001
 *   GET  /api/inference?text=       one Workers AI classification     $0.002
 *   GET  /reading                   week 2 legacy route, kept as evidence
 *
 * Free
 *   GET  /.well-known/agent-card.json   A2A discovery: skills, prices, terms (signed if keyed)
 *   GET  /.well-known/jwks.json         the card's public signing key
 *   GET  /api/negotiate                 counter-offer, accept or decline
 *   GET  /api/receipts                  settlement log
 *   GET  /api/payers                    who paid, ours vs external
 *   GET  /api/metrics/daily             aggregate funnel counters
 *   GET  /api/device/status             DeviceTwin health
 *   GET  /api/device/history            DeviceTwin ring buffer
 *   GET  /api/events                    SSE settlement feed
 *   GET  /                              live demo page
 *
 * Write
 *   POST /api/visit                     aggregate visit counter, no identifiers
 *   POST /api/subscribe                 consent-first email capture
 *   GET  /api/subscribers/count         aggregate only
 *   GET  /api/subscribers.csv           export — fails closed without EXPORT_TOKEN
 *
 * Durable Objects exported here: DeviceTwin (telemetry, knows nothing about
 * money) and RateLimiter (one instance per bucket, exact under concurrency).
 */

import { Hono, type MiddlewareHandler } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Env } from "./types";
import { DeviceTwin } from "./device-twin";
import { RateLimiter } from "./rate-limiter";
import { agentCardHandler, jwksHandler } from "./agent-card";
import { demoPageHandler, sseHandler } from "./demo";
import { createPaidRoute, rejectReplay, isSettledReceipt, DOCS_URL } from "./paid-route";
import { inferenceHandler, validateInferenceInput } from "./inference";
import { visitHandler, dailyMetricsHandler } from "./metrics";
import { payersHandler } from "./payers";
import { negotiateHandler } from "./negotiate";
import {
  subscribeHandler,
  exportSubscribersHandler,
  subscriberCountHandler,
} from "./subscribe";

export { DeviceTwin, RateLimiter };

const app = new Hono<{ Bindings: Env }>();

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
// Priced resources — one gate, two products
//
// Both routes get identical protection (rate limit, identity, mandate, payment
// screen, settlement, receipt, fail-closed) because they share one middleware.
// Adding a third resource is a config object, not a copy of the payment logic.
// ---------------------------------------------------------------------------

app.use(
  "/api/readings",
  createPaidRoute({
    routeKey: "GET /api/readings",
    priceVar: "PRICE_PER_READING",
    description: "One real-time IoT sensor reading from DeviceTwin",
    resource: "readings",
  })
);

app.use(
  "/api/inference",
  createPaidRoute({
    routeKey: "GET /api/inference",
    priceVar: "PRICE_PER_INFERENCE",
    description: "One sentiment classification run on Workers AI",
    resource: "inference",
    validate: validateInferenceInput,
  })
);

app.get("/api/inference", async (c) => {
  const replay = await rejectReplay(c);
  if (replay) return replay;
  return inferenceHandler(c);
});

app.get("/api/readings", async (c) => {
  const replay = await rejectReplay(c);
  if (replay) return replay;

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
  // Entries without a transaction hash record settlements that failed; they were
  // written before recordSettlement checked `success`. Kept in storage, never
  // served as receipts.
  return c.json(log.filter(isSettledReceipt).slice(0, limit));
});

// ---------------------------------------------------------------------------
// Agent Card discovery
// ---------------------------------------------------------------------------

app.get("/.well-known/agent-card.json", agentCardHandler);
app.get("/.well-known/jwks.json", jwksHandler);

// ---------------------------------------------------------------------------
// Observability and negotiation — free, public, aggregate
// ---------------------------------------------------------------------------

app.post("/api/visit", visitHandler);
app.get("/api/metrics/daily", dailyMetricsHandler);
app.get("/api/payers", payersHandler);
app.get("/api/negotiate", negotiateHandler);

// ---------------------------------------------------------------------------
// Email capture (consent-first). The list lives in our KV; export fails closed.
// ---------------------------------------------------------------------------

app.post("/api/subscribe", subscribeHandler);
app.get("/api/subscribers/count", subscriberCountHandler);
app.get("/api/subscribers.csv", exportSubscribersHandler);

// ---------------------------------------------------------------------------
// Demo page + SSE feed
// ---------------------------------------------------------------------------

app.get("/api/events", sseHandler);
app.get("/", demoPageHandler);

export default app;