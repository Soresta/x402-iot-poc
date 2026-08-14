/**
 * x402-harness.mjs — shared test helpers for the buyer-side verification scripts.
 *
 * Why this exists: the negative tests need to see and reuse the raw `X-PAYMENT`
 * header that the x402 client produces. `wrapFetchWithPayment` hides it, so we
 * wrap `fetch` one level lower and record it on the way out.
 *
 * Nothing here weakens the seller. Every request still goes to the real Worker
 * and is judged by the real facilitator.
 */

import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Request header carrying the signed payment proof in the installed x402
 * generation (@x402/core v2). The older generation used `X-PAYMENT`.
 */
export const PAYMENT_HEADER = "payment-signature";

export const SELLER_URL = process.env.SELLER_URL || "http://127.0.0.1:8787";
export const READINGS_URL = `${SELLER_URL}/api/readings`;

export function buildAccount() {
  const key = process.env.BUYER_PRIVATE_KEY;
  if (!key) {
    console.error("FATAL: BUYER_PRIVATE_KEY not set.");
    process.exit(1);
  }
  return privateKeyToAccount(key);
}

/**
 * Returns { paidFetch, getLastPaymentHeader }.
 *
 * `mutateRequirements` (optional) receives the decoded PAYMENT-REQUIRED payload
 * from the seller's 402 and may modify it in place before the client signs.
 * That is how underpayment / wrong-asset payloads are produced without touching
 * seller code.
 */
export function makeRecordingPaidFetch(account, mutateRequirements) {
  const client = new x402Client();
  registerExactEvmScheme(client, { signer: account });

  let lastPaymentHeader = null;

  const instrumentedFetch = async (input, init) => {
    // The installed x402 generation sends the proof as `payment-signature` on a
    // Request object, not as `X-PAYMENT` in `init`. Look in both places and
    // accept both names so this harness survives a package-generation change.
    const headers = new Headers(init?.headers ?? {});
    if (typeof input === "object" && input?.headers) {
      for (const [k, v] of new Headers(input.headers)) headers.set(k, v);
    }
    const paymentHeader = headers.get(PAYMENT_HEADER) || headers.get("X-PAYMENT");

    if (paymentHeader) {
      lastPaymentHeader = paymentHeader;
      return fetch(input, init);
    }

    const res = await fetch(input, init);
    if (res.status !== 402 || !mutateRequirements) return res;

    const raw = res.headers.get("payment-required");
    if (!raw) return res;

    const decoded = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    mutateRequirements(decoded);
    const reencoded = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64");

    const forwarded = new Headers(res.headers);
    forwarded.set("payment-required", reencoded);
    return new Response(await res.text(), { status: 402, headers: forwarded });
  };

  return {
    paidFetch: wrapFetchWithPayment(instrumentedFetch, client),
    getLastPaymentHeader: () => lastPaymentHeader,
  };
}

/** Build a syntactically valid but unsigned payment header for a given payer. */
export function dummyPaymentHeader(payer) {
  const payload = {
    x402Version: 2,
    scheme: "exact",
    network: "eip155:84532",
    payload: { authorization: { from: payer }, signature: "0x" + "00".repeat(65) },
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/** Send a raw payment proof with plain fetch — used to replay a captured header. */
export function sendWithPaymentHeader(url, header) {
  return fetch(url, { method: "GET", headers: { [PAYMENT_HEADER]: header } });
}

export async function describeResponse(label, res) {
  const body = await res.text();
  console.log(`--- ${label} ---`);
  console.log(`status: ${res.status}`);
  for (const name of ["retry-after", "payment-response", "content-type"]) {
    const value = res.headers.get(name);
    if (value) console.log(`${name}: ${value.slice(0, 120)}`);
  }
  console.log(`body: ${body.slice(0, 400)}`);
  return body;
}

export function verdict(name, passed, detail) {
  console.log(`RESULT ${passed ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  return passed;
}
