/**
 * test_mandate.mjs — seller-side mandate enforcement (W4 abuse-case checklist).
 *
 * Week 3 checked the mandate on the buyer only, so a compromised agent could
 * exceed its own authorization unnoticed. The seller now verifies it too, and
 * each failure maps to its own layer:
 *
 *   401 identity      — bad signature, or the mandate holder is not the payer
 *   403 mandate       — expired, malformed, or price outside the mandate
 *
 * Six of the seven cases below are refused before any payment is attempted, so
 * they move no funds. Only the happy path settles (one testnet payment).
 *
 * Run: node buyer/test_mandate.mjs
 */

import "dotenv/config";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { createMandate } from "./mandate.mjs";
import {
  READINGS_URL,
  SELLER_URL,
  buildAccount,
  makeRecordingPaidFetch,
  encodeMandate,
  verdict,
} from "./x402-harness.mjs";

const account = buildAccount();
console.log(`buyer: ${account.address}`);
console.log(`target: ${READINGS_URL}\n`);


function baseBody(overrides = {}) {
  return {
    buyer: account.address,
    seller: SELLER_URL,
    max_per_call: 0.002,
    daily_cap: 0.05,
    currency: "USDC",
    expiry: new Date(Date.now() + 3600_000).toISOString(),
    nonce: crypto.randomUUID(),
    ...overrides,
  };
}

/** Send an unpaid request carrying a mandate. Identity/authorization failures
 *  surface here without spending anything — that is the point of checking them
 *  before the payment layer. */
async function probe(label, mandateHeader) {
  const res = await fetch(READINGS_URL, {
    method: "GET",
    headers: { "X-Agent-Mandate": mandateHeader },
  });
  const body = await res.text();
  console.log(`--- ${label} ---`);
  console.log(`status: ${res.status}`);
  console.log(`body: ${body.slice(0, 200)}`);
  return { status: res.status, body };
}

const results = [];
let spentProof = null;

// --- 1. Expired mandate → 403 mandate_expired --------------------------------
{
  const m = await createMandate(account, baseBody({ expiry: new Date(Date.now() - 60_000).toISOString() }));
  const { status, body } = await probe("Expired mandate", encodeMandate(m));
  results.push(
    verdict("expired mandate refused with 403", status === 403 && body.includes("mandate_expired"), `status ${status}`)
  );
}

// --- 2. Price above the mandate → 403 mandate_scope_exceeded ------------------
{
  const m = await createMandate(account, baseBody({ max_per_call: 0.0005 }));
  const { status, body } = await probe("Price above max_per_call", encodeMandate(m));
  results.push(
    verdict(
      "price outside mandate refused with 403",
      status === 403 && body.includes("mandate_scope_exceeded"),
      `status ${status}`
    )
  );
}

// --- 3. Tampered mandate → 401 identity_unverified ---------------------------
// Sign a real mandate, then edit the body afterwards. The signature no longer
// recovers to the claimed buyer.
{
  const m = await createMandate(account, baseBody());
  m.body.max_per_call = 999;
  const { status, body } = await probe("Tampered after signing", encodeMandate(m));
  results.push(
    verdict(
      "tampered mandate refused with 401",
      status === 401 && body.includes("identity_unverified"),
      `status ${status}`
    )
  );
}

// --- 4. Someone else's mandate → 401 identity_unverified ---------------------
// A valid mandate signed by a different key, but claiming to be ours.
{
  const stranger = privateKeyToAccount(generatePrivateKey());
  const m = await createMandate(stranger, baseBody()); // body says buyer = us
  const { status, body } = await probe("Signed by a different key", encodeMandate(m));
  results.push(
    verdict(
      "mandate signed by another key refused with 401",
      status === 401 && body.includes("identity_unverified"),
      `status ${status}`
    )
  );
}

// --- 5. Malformed mandate → 403 mandate_malformed ----------------------------
{
  const junk = Buffer.from("not a mandate", "utf8").toString("base64");
  const { status, body } = await probe("Malformed mandate header", junk);
  results.push(
    verdict("malformed mandate refused with 403", status === 403 && body.includes("mandate_malformed"), `status ${status}`)
  );
}

// --- 6. Valid mandate + payment → 200 ----------------------------------------
// Costs one testnet settlement. Proves the checks do not block a legitimate buy.
{
  const m = await createMandate(account, baseBody());
  const { paidFetch, getLastPaymentHeader } = makeRecordingPaidFetch(account);
  const res = await paidFetch(READINGS_URL, {
    method: "GET",
    headers: { "X-Agent-Mandate": encodeMandate(m) },
  });
  const body = await res.text();
  console.log(`--- Valid mandate + payment ---`);
  console.log(`status: ${res.status}`);
  console.log(`body: ${body.slice(0, 200)}`);
  results.push(
    verdict(
      "valid mandate still buys normally",
      res.status === 200 && body.includes("temperature_c"),
      `status ${res.status}`
    )
  );
  spentProof = getLastPaymentHeader();
}

// --- 7. Valid mandate, but held by someone else → 401 identity_mismatch ------
// A mandate must not work as a bearer token. Here the mandate is genuinely
// signed by a stranger (so the signature checks out and body.buyer really is
// them), but the payment proof is funded by us. The seller must notice the
// mismatch. We reuse the already-spent proof from case 6, so no funds move —
// the identity check fires before replay protection even looks at it.
{
  const stranger = privateKeyToAccount(generatePrivateKey());
  const m = await createMandate(stranger, baseBody({ buyer: stranger.address }));
  const res = await fetch(READINGS_URL, {
    method: "GET",
    headers: {
      "X-Agent-Mandate": encodeMandate(m),
      "payment-signature": spentProof,
    },
  });
  const body = await res.text();
  console.log("--- Stranger's mandate + our payment proof ---");
  console.log(`status: ${res.status}`);
  console.log(`body: ${body.slice(0, 200)}`);
  results.push(
    verdict(
      "mandate cannot be used as a bearer token",
      res.status === 401 && body.includes("identity_mismatch"),
      `status ${res.status}`
    )
  );
}

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed.`);
process.exit(results.every(Boolean) ? 0 : 1);
