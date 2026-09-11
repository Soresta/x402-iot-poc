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
import { signCard, publicJwk, thumbprint } from "./card-signing";

/** The configured signing key, or null. A malformed secret is treated as absent. */
function signingKey(env: Env): JsonWebKey | null {
  if (!env.AGENT_CARD_SIGNING_KEY) return null;
  try {
    const jwk = JSON.parse(env.AGENT_CARD_SIGNING_KEY);
    return jwk?.kty === "EC" && jwk?.crv === "P-256" && jwk?.d ? jwk : null;
  } catch {
    return null;
  }
}

export async function agentCardHandler(c: Context<{ Bindings: Env }>) {
  const baseUrl = new URL(c.req.url).origin;

  const card = {
    // A2A Agent Card v0.2.5 shape
    schema_version: "0.2.5",
    name: "x402-iot-sensor-seller",
    description:
      "Sells simulated IoT sensor readings and sentiment-classification runs over " +
      "the x402 HTTP payment protocol. " +
      "TESTNET only — Base Sepolia. No real value.",
    url: baseUrl,
    version: "5.0.0",
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
      {
        id: "sell-inference",
        name: "Sentiment Classification",
        description:
          "Runs one sentiment classification over the supplied ?text= query parameter " +
          "and returns {label, score}. Payment required per request via x402 protocol.",
        inputModes: ["text/plain"],
        outputModes: ["application/json"],
        payment: {
          protocol: "x402",
          scheme: "exact",
          network: "eip155:84532",
          asset: "USDC",
          price: c.env.PRICE_PER_INFERENCE,
          payTo: c.env.PAY_TO,
          facilitator: c.env.FACILITATOR_URL,
          resource: `${baseUrl}/api/inference`,
        },
      },
    ],
    // Endpoints the buyer agent needs to know
    endpoints: {
      payment_resource: `${baseUrl}/api/readings`,
      inference_resource: `${baseUrl}/api/inference`,
      receipts: `${baseUrl}/api/receipts`,
      events_sse: `${baseUrl}/api/events`,
      demo: baseUrl,
    },
  };

  // Sign when a key is configured (A2A v1.0 §8.4 format — see card-signing.ts).
  // Without one, serve the card unsigned rather than fail discovery: an unsigned
  // card is what every client already handles, and the absence of `signatures`
  // tells a verifying client exactly what it needs to know.
  const key = signingKey(c.env);
  const body = key ? await signCard(card, key, `${baseUrl}/.well-known/jwks.json`) : card;

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

/**
 * GET /.well-known/jwks.json — the card's public signing key.
 *
 * Offered because the A2A spec's `jku` points here. A buyer that fetches the
 * key from the same domain as the card is trusting TLS and nothing more; the
 * stronger arrangement, and the one this repo's buyer uses, is a key pinned out
 * of band.
 */
export async function jwksHandler(c: Context<{ Bindings: Env }>) {
  const key = signingKey(c.env);
  if (!key) {
    return c.json(
      { error: "card_signing_not_configured", docs_url: "https://github.com/Soresta/x402-iot-poc#errors" },
      404
    );
  }
  const pub = publicJwk(key);
  return c.json(
    { keys: [{ ...pub, alg: "ES256", use: "sig", kid: await thumbprint(key) }] },
    200,
    { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" }
  );
}
