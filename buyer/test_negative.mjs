/**
 * test_negative.mjs — underpayment and wrong-asset payment attempts.
 *
 * Both tests tamper with the seller's own 402 requirements before the client
 * signs, then send the resulting authorization to the untouched seller:
 *
 *   A. Underpayment  — amount reduced to 1 atomic unit (required: the real price)
 *   B. Wrong asset   — asset swapped for a different ERC-20 address
 *
 * Expected in both cases: 402, no telemetry served, no settlement. These
 * authorizations are rejected at verification, so no funds move.
 *
 * Run: node buyer/test_negative.mjs
 */

import "dotenv/config";
import {
  READINGS_URL,
  buildAccount,
  makeRecordingPaidFetch,
  describeResponse,
  verdict,
} from "./x402-harness.mjs";

const account = buildAccount();
console.log(`buyer: ${account.address}`);
console.log(`target: ${READINGS_URL}\n`);

// --- A. Underpayment ----------------------------------------------------------
const underpay = makeRecordingPaidFetch(account, (req) => {
  for (const accept of req.accepts ?? []) {
    console.log(`[tamper] amount ${accept.amount} → 1`);
    accept.amount = "1";
  }
});

let resA;
try {
  resA = await underpay.paidFetch(READINGS_URL, { method: "GET" });
} catch (err) {
  console.log(`--- Test A — underpayment ---\nclient threw: ${err.message}`);
}
let passA = false;
if (resA) {
  const bodyA = await describeResponse("Test A — underpayment", resA);
  passA = resA.status === 402 && !bodyA.includes("temperature");
}
verdict("underpayment refused, no telemetry served", passA, resA ? `status ${resA.status}` : "no response");

// --- B. Wrong asset -----------------------------------------------------------
const WRONG_ASSET = "0x000000000000000000000000000000000000dEaD";
const wrongAsset = makeRecordingPaidFetch(account, (req) => {
  for (const accept of req.accepts ?? []) {
    console.log(`[tamper] asset ${accept.asset} → ${WRONG_ASSET}`);
    accept.asset = WRONG_ASSET;
  }
});

let resB;
try {
  resB = await wrongAsset.paidFetch(READINGS_URL, { method: "GET" });
} catch (err) {
  console.log(`--- Test B — wrong asset ---\nclient threw: ${err.message}`);
}
let passB = false;
if (resB) {
  const bodyB = await describeResponse("Test B — wrong asset", resB);
  passB = resB.status === 402 && !bodyB.includes("temperature");
}
verdict("wrong-asset payment refused, no telemetry served", passB, resB ? `status ${resB.status}` : "no response");

process.exit(passA && passB ? 0 : 1);
