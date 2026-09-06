/**
 * test_inference.mjs — the second priced resource (W5).
 *
 * Proves that one buyer can purchase two different kinds of thing from the same
 * seller on the same rail: stored data (a sensor reading, $0.001) and compute
 * (a model run, $0.002).
 *
 * Also proves the price difference is enforced against the mandate: an agent
 * authorized for cheap readings is not automatically authorized to buy compute.
 *
 * Costs two testnet settlements ($0.003 total). The mandate-scope case costs
 * nothing — it is refused before payment.
 *
 * Run: node buyer/test_inference.mjs
 */

import "dotenv/config";
import { createMandate } from "./mandate.mjs";
import {
  SELLER_URL,
  READINGS_URL,
  buildAccount,
  makeRecordingPaidFetch,
  encodeMandate,
  verdict,
} from "./x402-harness.mjs";

const INFERENCE_URL = `${SELLER_URL}/api/inference`;
const account = buildAccount();

console.log(`buyer: ${account.address}`);
console.log(`seller: ${SELLER_URL}\n`);

function mandateBody(maxPerCall) {
  return {
    buyer: account.address,
    seller: SELLER_URL,
    max_per_call: maxPerCall,
    daily_cap: 0.05,
    currency: "USDC",
    expiry: new Date(Date.now() + 3600_000).toISOString(),
    nonce: crypto.randomUUID(),
  };
}

const results = [];

// --- 1. Discovery: both skills on one card ----------------------------------
{
  const card = await (await fetch(`${SELLER_URL}/.well-known/agent-card.json`)).json();
  const skills = (card.skills ?? []).map((s) => `${s.id} @ ${s.payment?.price}`);
  console.log("--- Agent Card skills ---");
  skills.forEach((s) => console.log(`  ${s}`));
  results.push(
    verdict(
      "one card advertises both resources with distinct prices",
      card.skills?.length === 2 &&
        card.skills[0].payment.price !== card.skills[1].payment.price,
      skills.join(" | ")
    )
  );
}

// --- 2. Buy a reading -------------------------------------------------------
{
  const m = await createMandate(account, mandateBody(0.005));
  const { paidFetch } = makeRecordingPaidFetch(account);
  const res = await paidFetch(READINGS_URL, {
    method: "GET",
    headers: { "X-Agent-Mandate": encodeMandate(m) },
  });
  const body = await res.text();
  console.log(`\n--- Buy a reading ($0.001) ---\nstatus: ${res.status}\nbody: ${body.slice(0, 180)}`);
  results.push(
    verdict("reading purchased", res.status === 200 && body.includes("temperature_c"), `status ${res.status}`)
  );
}

// --- 3. Buy an inference ----------------------------------------------------
{
  const m = await createMandate(account, mandateBody(0.005));
  const { paidFetch } = makeRecordingPaidFetch(account);
  const url = `${INFERENCE_URL}?text=${encodeURIComponent("this settlement rail is surprisingly pleasant")}`;
  const res = await paidFetch(url, {
    method: "GET",
    headers: { "X-Agent-Mandate": encodeMandate(m) },
  });
  const body = await res.text();
  console.log(`\n--- Buy an inference ($0.002) ---\nstatus: ${res.status}\nbody: ${body.slice(0, 300)}`);
  results.push(
    verdict(
      "inference purchased and classified",
      res.status === 200 && body.includes("label"),
      `status ${res.status}`
    )
  );
}

// --- 4. A reading-sized mandate must not buy compute ------------------------
// max_per_call 0.001 covers a reading but not the $0.002 inference. Refused at
// the mandate layer, before any payment is attempted.
{
  const m = await createMandate(account, mandateBody(0.001));
  const res = await fetch(`${INFERENCE_URL}?text=hello`, {
    method: "GET",
    headers: { "X-Agent-Mandate": encodeMandate(m) },
  });
  const body = await res.text();
  console.log(`\n--- Reading-sized mandate against inference ---\nstatus: ${res.status}\nbody: ${body.slice(0, 180)}`);
  results.push(
    verdict(
      "cheap mandate cannot buy expensive compute",
      res.status === 403 && body.includes("mandate_scope_exceeded"),
      `status ${res.status}`
    )
  );
}

// --- 5. Receipts distinguish the two resources ------------------------------
{
  const receipts = await (await fetch(`${SELLER_URL}/api/receipts?limit=5`)).json();
  const kinds = [...new Set(receipts.map((r) => r.resource).filter(Boolean))];
  console.log(`\n--- Recent receipts ---`);
  receipts.slice(0, 4).forEach((r) => console.log(`  ${r.timestamp}  ${r.amount}  ${r.resource ?? "(unlabelled)"}`));
  results.push(
    verdict("receipts record which resource was sold", kinds.includes("inference") && kinds.includes("readings"), kinds.join(", "))
  );
}

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed.`);
process.exit(results.every(Boolean) ? 0 : 1);
