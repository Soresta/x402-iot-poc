/**
 * test_replay.mjs — replay-attack harness (w3t1 DoD).
 *
 * 1. Pay once with a fresh authorization  → expect 200 + reading + settlement tx
 * 2. Resend the exact same X-PAYMENT header → expect 402 payment_already_used
 *
 * Costs one real Base Sepolia testnet settlement. Testnet only.
 *
 * Run: node buyer/test_replay.mjs
 */

import "dotenv/config";
import {
  READINGS_URL,
  buildAccount,
  makeRecordingPaidFetch,
  sendWithPaymentHeader,
  describeResponse,
  verdict,
} from "./x402-harness.mjs";

const account = buildAccount();
const { paidFetch, getLastPaymentHeader } = makeRecordingPaidFetch(account);

console.log(`buyer: ${account.address}`);
console.log(`target: ${READINGS_URL}\n`);

// --- Step 1: legitimate paid request -----------------------------------------
const res1 = await paidFetch(READINGS_URL, { method: "GET" });
await describeResponse("Request 1 — fresh payment", res1);
const step1 = verdict("fresh payment returns data", res1.status === 200, `status ${res1.status}`);

const usedHeader = getLastPaymentHeader();
if (!usedHeader) {
  console.error("FATAL: no payment header was captured; cannot test replay.");
  process.exit(1);
}
console.log(`\ncaptured payment header (${usedHeader.length} chars, first 48): ${usedHeader.slice(0, 48)}…\n`);

// --- Step 2: replay the identical proof ---------------------------------------
const res2 = await sendWithPaymentHeader(READINGS_URL, usedHeader);
const body2 = await describeResponse("Request 2 — replayed proof", res2);
const step2 = verdict(
  "replayed proof rejected without serving telemetry",
  res2.status === 402 && !body2.includes("temperature"),
  `status ${res2.status}`
);

process.exit(step1 && step2 ? 0 : 1);
