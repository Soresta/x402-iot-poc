/**
 * agent-card.ts — A2A Agent Card discovery endpoint
 *
 * Serves a JSON document at GET /.well-known/agent-card.json describing
 * this seller agent's capabilities and payment terms.
 *
 * Spec reference: https://google.github.io/A2A/specification/ (v0.2.5)
 * Field uncertainty: `skills[].payment` is not explicitly defined in v0.2.5;
 * used the closest available shape under the `skills` array. Noted in BUILD-LOG.md.
 *
 * Values come from env, not hardcoded, to prevent price drift.
 */

import type { Context } from "hono";
import type { Env } from "./types";

export async function agentCardHandler(c: Context<{ Bindings: Env }>) {
  const baseUrl = new URL(c.req.url).origin;

  const card = {
    // A2A Agent Card v0.2.5 shape
    schema_version: "0.2.5",
    name: "x402-iot-sensor-seller",
    description:
      "Sells simulated IoT sensor readings over the x402 HTTP payment protocol. " +
      "TESTNET only — Base Sepolia. No real value.",
    url: baseUrl,
    version: "3.0.0",
    documentationUrl: "https://github.com/Soresta/x402-iot-poc",
    provider: {
      organization: "x402-iot-poc internship project",
      contact: "https://github.com/Soresta/x402-iot-poc",
    },
    capabilities: {
      streaming: true, // SSE feed at /api/events
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: [
      {
        id: "sell-iot-reading",
        name: "IoT Sensor Reading",
        description:
          "Returns one simulated sensor reading (temperature_c, humidity_pct, seq, ts). " +
          "Payment required per request via x402 protocol.",
        inputModes: ["none"],
        outputModes: ["application/json"],
        // Payment metadata (not canonical in spec v0.2.5; closest available shape)
        payment: {
          protocol: "x402",
          scheme: "exact",
          network: "eip155:84532",
          asset: "USDC",
          price: c.env.PRICE_PER_READING,
          payTo: c.env.PAY_TO,
          facilitator: c.env.FACILITATOR_URL,
          resource: `${baseUrl}/api/readings`,
        },
      },
    ],
    // Endpoints the buyer agent needs to know
    endpoints: {
      payment_resource: `${baseUrl}/api/readings`,
      receipts: `${baseUrl}/api/receipts`,
      events_sse: `${baseUrl}/api/events`,
      demo: baseUrl,
    },
  };

  return new Response(JSON.stringify(card, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
