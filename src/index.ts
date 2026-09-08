/**
 * index.ts — Hono Worker entry point for x402-iot-poc
 *
 * Week 2 routes (preserved as evidence artifacts):
 *   GET /reading — x402-gated simulated reading (legacy, Week 2 proof)
 *
 * Week 3 routes:
 *   GET /api/readings        — x402-gated reading from DeviceTwin DO
 *   GET /api/inference       — x402-gated Workers AI classification (Week 5)
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
import { createPaidRoute, rejectReplay, DOCS_URL } from "./paid-route";
import { inferenceHandler } from "./inference";
import { visitHandler, dailyMetricsHandler } from "./metrics";
import { payersHandler } from "./payers";
import { negotiateHandler } from "./negotiate";
import {
  subscribeHandler,
  exportSubscribersHandler,
  subscriberCountHandler,
} from "./subscribe";

export { DeviceTwin };

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
  return c.json(log.slice(0, limit));
});

// ---------------------------------------------------------------------------
// Agent Card discovery
// ---------------------------------------------------------------------------

app.get("/.well-known/agent-card.json", agentCardHandler);

// ---------------------------------------------------------------------------
// Demo page + SSE
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Email capture (consent-first). The list lives in our KV; export fails closed.
// ---------------------------------------------------------------------------

app.post("/api/visit", visitHandler);
app.get("/api/metrics/daily", dailyMetricsHandler);
app.get("/api/payers", payersHandler);
app.get("/api/negotiate", negotiateHandler);

app.post("/api/subscribe", subscribeHandler);
app.get("/api/subscribers/count", subscriberCountHandler);
app.get("/api/subscribers.csv", exportSubscribersHandler);

app.get("/api/events", sseHandler);
app.get("/", demoPageHandler);

export default app;