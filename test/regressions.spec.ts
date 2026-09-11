/**
 * regressions.spec.ts — one test per bug this project actually shipped.
 *
 * Four defects reached production in five weeks. Every one of them returned a
 * well-formed response, threw nothing, and looked like working software:
 *
 *   1. the seller read the payment proof from the wrong header name, so replay
 *      protection and rate limiting silently never ran;
 *   2. the mandate was verified on the buyer only — an honour system;
 *   3. a valid mandate worked for whoever held it, like a bearer token;
 *   4. the classifier reported the least likely label.
 *
 * The tests that existed at the time passed throughout. One of them passed for
 * the *wrong reason*, which is worse than failing.
 *
 * So this file is not general coverage. It is a specific claim: if any of those
 * four regressions came back, one of these tests goes red. Each test names the
 * bug it guards.
 */

import { describe, it, expect } from "vitest";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

import { verifyPresentedMandate } from "../src/mandate";
import { getPaymentHeader, screenPayment, payerFromPaymentHeader } from "../src/paid-route";
import { pickTopClass, validateInferenceInput, MAX_INPUT_CHARS } from "../src/inference";
import { ownWallets, shortenAddress } from "../src/payers";
import { evaluateWindow } from "../src/rate-limiter";
import { canonicalize, signCard, verifyCard } from "../src/card-signing";
// @ts-expect-error — plain ESM module from the buyer side, no type declarations
import { verifyCard as buyerVerifyCard } from "../buyer/card-verify.mjs";
// @ts-expect-error — plain ESM module from the buyer side, no type declarations
import { spentInWindow, DAY_MS } from "../buyer/budget.mjs";

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------

const SELLER = "https://seller.example";
const PAY_TO = "0x219ba53AC52D99668a5c20737D1dEd60f435d99E";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const buyer = privateKeyToAccount(generatePrivateKey());

function b64(value: unknown): string {
  return btoa(JSON.stringify(value));
}

async function signMandate(account: any, overrides: Record<string, unknown> = {}) {
  const body = {
    buyer: account.address,
    seller: SELLER,
    max_per_call: 0.002,
    daily_cap: 0.05,
    currency: "USDC",
    expiry: new Date(Date.now() + 3600_000).toISOString(),
    nonce: crypto.randomUUID(),
    ...overrides,
  };
  const signature = await account.signMessage({ message: JSON.stringify(body) });
  return { body, signature };
}

/** A payment proof of the shape the real client produces. */
function proof(opts: { from?: string; to?: string; value?: string; asset?: string; network?: string } = {}) {
  return b64({
    x402Version: 2,
    payload: {
      authorization: {
        from: opts.from ?? buyer.address,
        to: opts.to ?? PAY_TO,
        value: opts.value ?? "1000",
      },
      signature: "0x" + "11".repeat(65),
    },
    accepted: {
      scheme: "exact",
      network: opts.network ?? "eip155:84532",
      amount: "1000",
      asset: opts.asset ?? USDC,
      payTo: PAY_TO,
    },
  });
}

/** Minimal stand-in for a Hono context: just what these functions read. */
function ctx(headers: Record<string, string> = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    env: { USDC_ASSET: USDC, PAY_TO, PRICE_PER_READING: "$0.001" },
    req: { header: (name: string) => lower[name.toLowerCase()] },
  };
}

// --------------------------------------------------------------------------
// Regression 1 — the payment header name
// --------------------------------------------------------------------------

describe("regression 1: payment proof header name", () => {
  /**
   * THE BUG: the seller read `X-PAYMENT`. The installed x402 generation sends
   * `payment-signature`. Payments settled perfectly while every control keyed on
   * that header — replay protection, rate limiting — never executed. For a week.
   */
  it("reads the header the current client actually sends", () => {
    expect(getPaymentHeader(ctx({ "payment-signature": "abc" }))).toBe("abc");
  });

  it("still reads the legacy header, so an older client is not broken", () => {
    expect(getPaymentHeader(ctx({ "X-PAYMENT": "abc" }))).toBe("abc");
  });

  it("returns undefined when no proof is present, rather than a falsy string", () => {
    expect(getPaymentHeader(ctx())).toBeUndefined();
  });

  it("extracts the paying address, which is what rate limiting keys on", () => {
    const address = payerFromPaymentHeader(proof());
    expect(address?.toLowerCase()).toBe(buyer.address.toLowerCase());
  });
});

// --------------------------------------------------------------------------
// Regression 2 + 3 — mandate verification, and mandates as bearer tokens
// --------------------------------------------------------------------------

describe("regression 2 and 3: seller-side mandate verification", () => {
  it("accepts a valid mandate from the account that is paying", async () => {
    const m = await signMandate(buyer);
    const result = await verifyPresentedMandate(b64(m), 0.001, buyer.address);
    expect(result.ok).toBe(true);
  });

  /**
   * THE BUG (3): a signed mandate sitting in a request is a bearer credential.
   * Anyone who copies one out of a log can spend under it — unless the seller
   * checks that the mandate holder is the account funding the payment.
   */
  it("refuses a valid mandate presented by a different payer", async () => {
    const stranger = privateKeyToAccount(generatePrivateKey());
    const m = await signMandate(stranger); // genuinely signed, genuinely theirs
    const result = await verifyPresentedMandate(b64(m), 0.001, buyer.address);
    expect(result).toMatchObject({ ok: false, status: 401, error: "identity_mismatch" });
  });

  it("refuses a mandate edited after signing", async () => {
    const m = await signMandate(buyer);
    m.body.max_per_call = 999;
    const result = await verifyPresentedMandate(b64(m), 0.001, buyer.address);
    expect(result).toMatchObject({ ok: false, status: 401, error: "identity_unverified" });
  });

  it("refuses a mandate signed by a key other than the one it names", async () => {
    const stranger = privateKeyToAccount(generatePrivateKey());
    const body = { ...(await signMandate(buyer)).body };
    const signature = await stranger.signMessage({ message: JSON.stringify(body) });
    const result = await verifyPresentedMandate(b64({ body, signature }), 0.001, buyer.address);
    expect(result).toMatchObject({ ok: false, status: 401, error: "identity_unverified" });
  });

  it("refuses an expired mandate", async () => {
    const m = await signMandate(buyer, { expiry: new Date(Date.now() - 60_000).toISOString() });
    const result = await verifyPresentedMandate(b64(m), 0.001, buyer.address);
    expect(result).toMatchObject({ ok: false, status: 403, error: "mandate_expired" });
  });

  it("refuses a price above the mandate's per-call limit", async () => {
    const m = await signMandate(buyer, { max_per_call: 0.0005 });
    const result = await verifyPresentedMandate(b64(m), 0.001, buyer.address);
    expect(result).toMatchObject({ ok: false, status: 403, error: "mandate_scope_exceeded" });
  });

  it("refuses zero or negative caps", async () => {
    const m = await signMandate(buyer, { daily_cap: 0 });
    const result = await verifyPresentedMandate(b64(m), 0.001, buyer.address);
    expect(result).toMatchObject({ ok: false, status: 403, error: "mandate_invalid_caps" });
  });

  it("refuses an undecodable mandate header", async () => {
    const result = await verifyPresentedMandate(btoa("not a mandate"), 0.001, buyer.address);
    expect(result).toMatchObject({ ok: false, status: 403, error: "mandate_malformed" });
  });

  it("checks identity before authorization, so an impostor is 401 not 403", async () => {
    // Expired AND presented by the wrong payer. Identity is the more fundamental
    // failure and must win, or the response tells an attacker the wrong thing.
    const stranger = privateKeyToAccount(generatePrivateKey());
    const m = await signMandate(stranger, { expiry: new Date(Date.now() - 60_000).toISOString() });
    const result = await verifyPresentedMandate(b64(m), 0.001, buyer.address);
    expect(result).toMatchObject({ ok: false, status: 401 });
  });
});

// --------------------------------------------------------------------------
// Payment screen — the documented error codes must actually be emitted
// --------------------------------------------------------------------------

describe("payment screen emits the codes ERRORS.md documents", () => {
  it("passes a well-formed proof for the right price", () => {
    expect(screenPayment(ctx(), proof(), "$0.001")).toBeNull();
  });

  it("rejects underpayment with a distinct code", () => {
    expect(screenPayment(ctx(), proof({ value: "1" }), "$0.001")).toEqual({
      error: "payment_amount_invalid",
    });
  });

  it("rejects the wrong asset", () => {
    expect(screenPayment(ctx(), proof({ asset: "0x00000000000000000000000000000000000000dEaD" }), "$0.001"))
      .toEqual({ error: "payment_network_invalid" });
  });

  it("rejects the wrong network", () => {
    expect(screenPayment(ctx(), proof({ network: "eip155:1" }), "$0.001")).toEqual({
      error: "payment_network_invalid",
    });
  });

  it("rejects payment to an address that is not ours", () => {
    expect(screenPayment(ctx(), proof({ to: "0x00000000000000000000000000000000000000dEaD" }), "$0.001"))
      .toEqual({ error: "payment_recipient_invalid" });
  });

  it("defers to the facilitator when the proof cannot be read, rather than approving it", () => {
    // Returning null here means "no opinion", and the middleware still refuses.
    // The dangerous version of this function would return null meaning "fine".
    expect(screenPayment(ctx(), btoa("garbage"), "$0.001")).toBeNull();
  });

  it("charges the resource's own price, not a hardcoded one", () => {
    // A $0.001 proof against the $0.002 inference must be underpayment.
    expect(screenPayment(ctx(), proof({ value: "1000" }), "$0.002")).toEqual({
      error: "payment_amount_invalid",
    });
  });
});

// --------------------------------------------------------------------------
// Regression 4 — the classifier reported the least likely label
// --------------------------------------------------------------------------

describe("regression 4: classifier label selection", () => {
  /**
   * THE BUG: the model returns one entry per class in a FIXED order, not sorted
   * by confidence. Reading output[0] reported the least likely class every time,
   * with a well-formed 200 response.
   */
  it("picks the most confident class, not the first one", () => {
    const modelOutput = [
      { label: "NEGATIVE", score: 0.0002 },
      { label: "POSITIVE", score: 0.9998 },
    ];
    expect(pickTopClass(modelOutput)).toEqual({ label: "POSITIVE", score: 0.9998 });
  });

  it("still picks correctly when the confident class happens to be first", () => {
    const modelOutput = [
      { label: "NEGATIVE", score: 0.9997 },
      { label: "POSITIVE", score: 0.0003 },
    ];
    expect(pickTopClass(modelOutput).label).toBe("NEGATIVE");
  });

  it("degrades to UNKNOWN rather than inventing a label", () => {
    expect(pickTopClass([]).label).toBe("UNKNOWN");
    expect(pickTopClass(null).label).toBe("UNKNOWN");
  });
});

// --------------------------------------------------------------------------
// External adoption accounting — the number must not be flatterable
// --------------------------------------------------------------------------

describe("external payer accounting", () => {
  it("treats configured wallets as ours, case-insensitively", () => {
    const own = ownWallets({ OWN_WALLETS: `${buyer.address.toUpperCase()}, ${PAY_TO}` });
    expect(own.has(buyer.address.toLowerCase())).toBe(true);
    expect(own.has(PAY_TO.toLowerCase())).toBe(true);
  });

  it("returns an empty set when unconfigured, rather than silently owning nothing", () => {
    expect(ownWallets({}).size).toBe(0);
  });

  it("truncates addresses for display", () => {
    expect(shortenAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });
});

// --------------------------------------------------------------------------
// Regression 5 — the "daily" cap reset at UTC midnight
// --------------------------------------------------------------------------

describe("regression 5: spending cap is a rolling 24 h window", () => {
  /**
   * THE BUG: the buyer summed ledger entries whose timestamp started with
   * today's UTC date. At 00:00 the counter reset to zero however recently the
   * agent had spent, so an agent running across midnight could spend twice its
   * cap inside 24 hours. Found by running the agent for an hour across midnight.
   */
  const now = Date.parse("2026-09-12T00:30:00Z");

  it("counts spending from before midnight that is still inside 24 hours", () => {
    const ledger = [
      { ts: "2026-09-11T23:50:00Z", price: 0.01 }, // 40 min ago, previous UTC day
      { ts: "2026-09-12T00:10:00Z", price: 0.01 }, // 20 min ago
    ];
    // The calendar-day version returned 0.01 here.
    expect(spentInWindow(ledger, now)).toBe(0.02);
  });

  it("drops spending older than 24 hours", () => {
    const ledger = [{ ts: new Date(now - DAY_MS - 1).toISOString(), price: 0.5 }];
    expect(spentInWindow(ledger, now)).toBe(0);
  });

  it("ignores refusals and unparseable lines, which carry no price", () => {
    const ledger = [
      { ts: "2026-09-12T00:20:00Z", result: "cap_reached" },
      { ts: "not a date", price: 1 },
      { price: 1 },
    ];
    expect(spentInWindow(ledger, now)).toBe(0);
  });
});

// --------------------------------------------------------------------------
// Open item A5 — inference input is refused before the 402
// --------------------------------------------------------------------------

describe("A5: inference input is validated before payment is requested", () => {
  const withText = (text?: string) => ({
    req: { query: (k: string) => (k === "text" ? text : undefined) },
  });

  it("refuses a missing text parameter", () => {
    expect(validateInferenceInput(withText(undefined))).toEqual({
      status: 400,
      error: "inference_input_required",
    });
  });

  it("refuses whitespace-only text instead of substituting a sample", () => {
    // The old handler silently answered a different question than the one asked.
    expect(validateInferenceInput(withText("   "))).toMatchObject({ error: "inference_input_required" });
  });

  it("refuses over-length text instead of silently truncating it", () => {
    expect(validateInferenceInput(withText("x".repeat(MAX_INPUT_CHARS + 1)))).toMatchObject({
      error: "inference_input_too_long",
    });
  });

  it("accepts ordinary input", () => {
    expect(validateInferenceInput(withText("this settlement rail is pleasant"))).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Open item A6 — the rate limit did not hold under concurrency
// --------------------------------------------------------------------------

describe("A6: sliding-window arithmetic for the Durable Object limiter", () => {
  /**
   * THE BUG: the KV limiter read a timestamp list, counted, and wrote it back.
   * 30 simultaneous requests against the deployed Worker all read the same
   * empty list: 30 of 30 passed a quota of 10, in each of three runs.
   *
   * Concurrency itself is fixed by moving the count into a Durable Object; that
   * part is verified against the deployed Worker, not here. These tests pin the
   * window arithmetic the Durable Object relies on.
   */
  const now = 1_000_000;
  const windowMs = 60_000;

  it("allows up to the quota and records the hit", () => {
    const d = evaluateWindow([now - 1000, now - 2000], now, windowMs, 3);
    expect(d.allowed).toBe(true);
    expect(d.kept).toHaveLength(3);
  });

  it("refuses at the quota without recording the refused hit", () => {
    const hits = [now - 3000, now - 2000, now - 1000];
    const d = evaluateWindow(hits, now, windowMs, 3);
    expect(d.allowed).toBe(false);
    expect(d.kept).toHaveLength(3); // a refused request must not eat a future slot
  });

  it("frees a slot once the oldest hit leaves the window", () => {
    const hits = [now - windowMs - 1, now - 2000, now - 1000];
    expect(evaluateWindow(hits, now, windowMs, 3).allowed).toBe(true);
  });

  it("reports Retry-After as the time until the oldest hit expires", () => {
    const hits = [now - 50_000, now - 2000, now - 1000];
    const d = evaluateWindow(hits, now, windowMs, 3);
    expect(d.retryAfter).toBe(10);
  });

  it("never reports a Retry-After of zero while refusing", () => {
    const hits = [now - windowMs + 1, now - 2000, now - 1000];
    expect(evaluateWindow(hits, now, windowMs, 3).retryAfter).toBeGreaterThanOrEqual(1);
  });
});

// --------------------------------------------------------------------------
// Open item A4 — signed Agent Card (A2A v1.0 §8.4 signature format)
// --------------------------------------------------------------------------

describe("A4: the Agent Card is signed, and a buyer can tell", () => {
  async function keyPair() {
    const pair: any = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ]);
    return {
      privateJwk: (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey,
      publicJwk: (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey,
    };
  }

  const card = {
    name: "x402-iot-sensor-seller",
    skills: [{ id: "sell-iot-reading", payment: { price: "$0.001", payTo: "0xSELLER" } }],
    capabilities: { streaming: true, pushNotifications: false },
  };

  it("canonicalizes per RFC 8785: sorted keys, no whitespace", () => {
    expect(canonicalize({ b: 1, a: { d: [true, null], c: "x" } })).toBe('{"a":{"c":"x","d":[true,null]},"b":1}');
  });

  it("a card signed by the seller verifies against the seller's key", async () => {
    const { privateJwk, publicJwk } = await keyPair();
    const signed = await signCard(card, privateJwk, "https://seller.test/.well-known/jwks.json");
    expect(signed.signatures).toHaveLength(1);
    expect(await verifyCard(signed, publicJwk)).toMatchObject({ ok: true });
  });

  it("the buyer's separate verifier agrees with the seller's signer", async () => {
    // Two copies of a signature algorithm drift silently. This is the tripwire.
    const { privateJwk, publicJwk } = await keyPair();
    const signed = await signCard(card, privateJwk);
    expect(await buyerVerifyCard(signed, publicJwk)).toMatchObject({ ok: true });
  });

  it("rejects a card whose price was changed after signing", async () => {
    const { privateJwk, publicJwk } = await keyPair();
    const signed: any = await signCard(card, privateJwk);
    signed.skills[0].payment.price = "$0.0001";
    expect(await verifyCard(signed, publicJwk)).toEqual({ ok: false, reason: "card_signature_invalid" });
    expect(await buyerVerifyCard(signed, publicJwk)).toEqual({ ok: false, reason: "card_signature_invalid" });
  });

  it("rejects a card whose payTo was swapped — the attack signing exists to stop", async () => {
    const { privateJwk, publicJwk } = await keyPair();
    const signed: any = await signCard(card, privateJwk);
    signed.skills[0].payment.payTo = "0xATTACKER";
    expect(await buyerVerifyCard(signed, publicJwk)).toMatchObject({ ok: false });
  });

  it("rejects a validly signed card from a different key", async () => {
    const seller = await keyPair();
    const impostor = await keyPair();
    const signed = await signCard(card, impostor.privateJwk);
    expect(await verifyCard(signed, seller.publicJwk)).toMatchObject({ ok: false });
  });

  it("reports an unsigned card as unsigned, not as invalid", async () => {
    const { publicJwk } = await keyPair();
    expect(await verifyCard(card, publicJwk)).toEqual({ ok: false, reason: "card_unsigned" });
  });

  it("property order does not matter, because the payload is canonical", async () => {
    const { privateJwk, publicJwk } = await keyPair();
    const signed: any = await signCard(card, privateJwk);
    const reordered = { signatures: signed.signatures, skills: signed.skills, capabilities: signed.capabilities, name: signed.name };
    expect(await verifyCard(reordered, publicJwk)).toMatchObject({ ok: true });
  });

  it("puts ES256, JOSE, a kid and the jku in the protected header", async () => {
    const { privateJwk } = await keyPair();
    const signed = await signCard(card, privateJwk, "https://seller.test/.well-known/jwks.json");
    const header = JSON.parse(atob(signed.signatures[0].protected.replace(/-/g, "+").replace(/_/g, "/")));
    expect(header).toMatchObject({ alg: "ES256", typ: "JOSE", jku: "https://seller.test/.well-known/jwks.json" });
    expect(typeof header.kid).toBe("string");
  });
});
