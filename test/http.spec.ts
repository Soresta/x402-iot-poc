/**
 * http.spec.ts — the worker, over HTTP, the way a buyer sees it.
 *
 * regressions.spec.ts tests pure functions. That left a gap (open item C2):
 * route behaviour — which layer answers, in which order, with which code — was
 * only ever verified by scripts run by hand. These tests go through SELF.fetch,
 * so the real middleware stack, the real Durable Objects and the real routing
 * are all in the path.
 *
 * Nothing here reaches the facilitator or the chain. Every request is either
 * unpaid, refused before payment, or carries a proof that the pre-settlement
 * screen rejects locally. So these tests are deterministic and move no funds.
 */

import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

import { rejectReplay, recordSettlement } from "../src/paid-route";

const BASE = "https://seller.test";
const PAY_TO = "0x219ba53AC52D99668a5c20737D1dEd60f435d99E";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const get = (path: string, headers: Record<string, string> = {}) =>
  SELF.fetch(`${BASE}${path}`, { headers });

/** A proof the screen will refuse locally as underpayment — no network needed. */
function underpayingProof(from: string): string {
  return btoa(
    JSON.stringify({
      x402Version: 2,
      payload: { authorization: { from, to: PAY_TO, value: "1" }, signature: "0x" + "11".repeat(65) },
      accepted: { scheme: "exact", network: "eip155:84532", amount: "1000", asset: USDC, payTo: PAY_TO },
    })
  );
}

// --------------------------------------------------------------------------
// The gate answers before the resource does
// --------------------------------------------------------------------------

describe("paid routes refuse unpaid requests", () => {
  it("GET /api/readings → 402 with machine-readable terms", async () => {
    const res = await get("/api/readings");
    expect(res.status).toBe(402);
    expect(res.headers.get("payment-required")).toBeTruthy();
    await res.arrayBuffer();
  });

  it("GET /api/inference?text= → 402", async () => {
    const res = await get("/api/inference?text=hello");
    expect(res.status).toBe(402);
    await res.arrayBuffer();
  });

  it("GET /reading (week 2 legacy route) → still 402", async () => {
    const res = await get("/reading");
    expect(res.status).toBe(402);
    await res.arrayBuffer();
  });
});

describe("A5: bad inference input is refused before the 402", () => {
  it("no text → 400, and no payment terms are issued", async () => {
    const res = await get("/api/inference");
    expect(res.status).toBe(400);
    expect(res.headers.get("payment-required")).toBeNull();
    expect(await res.json()).toMatchObject({ error: "inference_input_required" });
  });
});

describe("the screen emits a distinct code before any facilitator call", () => {
  it("underpayment → 402 payment_amount_invalid", async () => {
    const res = await get("/api/readings", {
      "payment-signature": underpayingProof("0x" + "ab".repeat(20)),
    });
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: "payment_amount_invalid" });
  });
});

describe("identity and authorization answer before payment", () => {
  it("an expired mandate → 403 mandate_expired, with no payment terms", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const body = {
      buyer: account.address,
      seller: BASE,
      max_per_call: 0.002,
      daily_cap: 0.05,
      currency: "USDC",
      expiry: new Date(Date.now() - 60_000).toISOString(),
      nonce: crypto.randomUUID(),
    };
    const signature = await account.signMessage({ message: JSON.stringify(body) });
    const res = await get("/api/readings", { "X-Agent-Mandate": btoa(JSON.stringify({ body, signature })) });
    expect(res.status).toBe(403);
    expect(res.headers.get("payment-required")).toBeNull();
    expect(await res.json()).toMatchObject({ error: "mandate_expired" });
  });
});

// --------------------------------------------------------------------------
// A6 — the rate limit holds under a concurrent burst
// --------------------------------------------------------------------------

describe("A6: the rate limit holds when requests arrive together", () => {
  /**
   * The KV limiter let 30 of 30 simultaneous requests through a quota of 10 on
   * the deployed Worker. This is the same burst, through the real Durable
   * Object, using proofs the screen refuses locally so no facilitator call is
   * made and nothing is spent.
   */
  it("30 concurrent requests from one payer: exactly 10 pass, 20 get 429", async () => {
    const payer = "0x" + crypto.randomUUID().replace(/-/g, "").padEnd(40, "0").slice(0, 40);
    const proof = underpayingProof(payer);

    const responses = await Promise.all(
      Array.from({ length: 30 }, () => get("/api/readings", { "payment-signature": proof }))
    );
    const statuses = await Promise.all(
      responses.map(async (r) => {
        await r.arrayBuffer();
        return r.status;
      })
    );

    expect(statuses.filter((s) => s === 429)).toHaveLength(20);
    expect(statuses.filter((s) => s === 402)).toHaveLength(10);
  });
});

// --------------------------------------------------------------------------
// Free endpoints
// --------------------------------------------------------------------------

describe("discovery and negotiation", () => {
  it("the Agent Card advertises both resources at different prices", async () => {
    const res = await get("/.well-known/agent-card.json");
    expect(res.status).toBe(200);
    const card: any = await res.json();
    expect(card.skills).toHaveLength(2);
    expect(card.skills[0].payment.price).not.toBe(card.skills[1].payment.price);
  });

  it("a counter-offer below list price is declined with the real price, as a 200", async () => {
    const res = await get("/api/negotiate?resource=inference&offer=0.001");
    expect(res.status).toBe(200); // a decline is a successful negotiation
    expect(await res.json()).toMatchObject({ accepted: false, counter_usdc: 0.002 });
  });

  it("an offer at list price is accepted", async () => {
    const res = await get("/api/negotiate?resource=readings&offer=0.001");
    expect(await res.json()).toMatchObject({ accepted: true });
  });

  it("an unknown resource is a 404", async () => {
    const res = await get("/api/negotiate?resource=nonsense");
    expect(res.status).toBe(404);
    await res.arrayBuffer();
  });

  it("/api/payers reports the external-adoption verdict", async () => {
    const res = await get("/api/payers");
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(typeof body.external_payers).toBe("number");
    expect(typeof body.milestone_w7_met).toBe("boolean");
  });
});

describe("email capture", () => {
  const post = (payload: unknown) =>
    SELF.fetch(`${BASE}/api/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  it("refuses a signup without consent", async () => {
    const res = await post({ email: "reader@example.com" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "subscribe_consent_required" });
  });

  it("accepts a consented signup", async () => {
    const res = await post({ email: `reader-${crypto.randomUUID()}@example.com`, consent: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("never exports the list without the right token", async () => {
    const res = await get("/api/subscribers.csv?token=wrong");
    expect(res.status).not.toBe(200);
    const body: any = await res.json();
    expect(body.error).toMatch(/^export_/);
  });
});

// --------------------------------------------------------------------------
// C3 — replay protection, against a stub KV
// --------------------------------------------------------------------------

describe("C3: rejectReplay records a proof once and refuses it after", () => {
  function stubContext(proof?: string) {
    const store = new Map<string, { value: string; ttl?: number }>();
    return {
      store,
      ctx: {
        env: {
          IOT_KV: {
            get: async (k: string) => store.get(k)?.value ?? null,
            put: async (k: string, value: string, opts?: { expirationTtl?: number }) =>
              void store.set(k, { value, ttl: opts?.expirationTtl }),
          },
        },
        req: { header: (name: string) => (name.toLowerCase() === "payment-signature" ? proof : undefined) },
        json: (body: unknown, status: number) => new Response(JSON.stringify(body), { status }),
      },
    };
  }

  it("lets a new proof through and records it for 24 hours", async () => {
    const { ctx, store } = stubContext("proof-A");
    expect(await rejectReplay(ctx)).toBeNull();
    const [entry] = [...store.values()];
    expect(entry.ttl).toBe(86400);
  });

  it("refuses the same proof the second time", async () => {
    const { ctx } = stubContext("proof-B");
    expect(await rejectReplay(ctx)).toBeNull();
    const second = await rejectReplay(ctx);
    expect(second?.status).toBe(402);
    expect(await second?.json()).toMatchObject({ error: "payment_already_used" });
  });

  it("does not confuse two different proofs", async () => {
    const a = stubContext("proof-C");
    await rejectReplay(a.ctx);
    const b = stubContext("proof-D");
    b.store.clear();
    for (const [k, v] of a.store) b.store.set(k, v);
    expect(await rejectReplay(b.ctx)).toBeNull();
  });

  it("records nothing for a request without a proof", async () => {
    const { ctx, store } = stubContext(undefined);
    expect(await rejectReplay(ctx)).toBeNull();
    expect(store.size).toBe(0);
  });
});

// --------------------------------------------------------------------------
// Failed settlements must not become receipts
// --------------------------------------------------------------------------

describe("a failed settlement is not a receipt", () => {
  /**
   * THE BUG (found 2026-09-11): the middleware sets a payment-response header on
   * failure too, and recordSettlement recorded anything carrying one. Failed
   * settlements became receipts with no transaction hash and were counted as
   * sales by the demo page, /api/payers and /api/metrics/daily — including two
   * failures from the week 5 soak run.
   */
  function kvStub() {
    const store = new Map<string, string>();
    return {
      store,
      ctx: {
        env: {
          IOT_KV: {
            get: async (k: string) => store.get(k) ?? null,
            put: async (k: string, v: string) => void store.set(k, v),
          },
        },
      },
    };
  }
  const header = (body: unknown) => btoa(JSON.stringify(body));

  it("records nothing when settlement failed", async () => {
    const { ctx, store } = kvStub();
    const wrote = await recordSettlement(
      ctx,
      header({ success: false, errorReason: "invalid_exact_evm_transaction_failed", payer: "0xabc" }),
      "$0.001",
      "readings"
    );
    expect(wrote).toBe(false);
    expect(store.has("receipt_log")).toBe(false);
    expect(store.has("latest_event")).toBe(false);
  });

  it("records a receipt and a live event when it settled", async () => {
    const { ctx, store } = kvStub();
    const wrote = await recordSettlement(
      ctx,
      header({ success: true, transaction: "0x" + "ab".repeat(32), payer: "0xabc" }),
      "$0.001",
      "readings"
    );
    expect(wrote).toBe(true);
    const [receipt] = JSON.parse(store.get("receipt_log")!);
    expect(receipt).toMatchObject({ amount: "$0.001", resource: "readings" });
    expect(store.has("latest_event")).toBe(true);
  });

  it("GET /api/receipts hides old entries that recorded a failure", async () => {
    await env.IOT_KV.put(
      "receipt_log",
      JSON.stringify([
        { payer: "0xabc", amount: "$0.001", resource: "readings", txHash: "0x" + "cd".repeat(32), timestamp: "2026-09-11T10:00:01Z" },
        { payer: "0xabc", amount: "$0.001", resource: "readings", txHash: null, timestamp: "2026-09-11T10:00:00Z" },
      ])
    );
    const res = await get("/api/receipts?limit=10");
    const receipts: any[] = await res.json();
    expect(receipts).toHaveLength(1);
    expect(receipts[0].txHash).toBeTruthy();
  });

  it("/api/payers does not count them as settlements", async () => {
    await env.IOT_KV.put(
      "receipt_log",
      JSON.stringify([
        { payer: "0x1111111111111111111111111111111111111111", amount: "$0.001", txHash: "0x" + "ef".repeat(32), timestamp: "2026-09-11T10:00:01Z" },
        { payer: "0x1111111111111111111111111111111111111111", amount: "$0.001", txHash: null, timestamp: "2026-09-11T10:00:00Z" },
      ])
    );
    const body: any = await (await get("/api/payers")).json();
    const row = body.payers.find((p: any) => p.address.startsWith("0x1111"));
    expect(row.settlements).toBe(1);
  });
});

// --------------------------------------------------------------------------
// A4 — card signing, when no key is configured
// --------------------------------------------------------------------------

describe("A4: without a signing key the card is served unsigned, and says so", () => {
  it("the card carries no signatures field", async () => {
    const card: any = await (await get("/.well-known/agent-card.json")).json();
    expect(card.signatures).toBeUndefined();
  });

  it("/.well-known/jwks.json is a 404 with a code, not an empty key set", async () => {
    // An empty JWKS would read as "signed with no keys" — a verifier could
    // misinterpret it. A 404 with a code cannot be.
    const res = await get("/.well-known/jwks.json");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "card_signing_not_configured" });
  });
});
