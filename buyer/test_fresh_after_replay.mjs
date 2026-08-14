/**
 * test_fresh_after_replay.mjs — proves idempotency does not block legitimate buys.
 *
 * 1. Pay        → 200
 * 2. Replay     → 402 payment_already_used
 * 3. Pay again with a NEW authorization → 200
 *
 * Step 3 is the point: a replay-protected seller must still serve the next
 * honest customer. Costs two real Base Sepolia testnet settlements.
 *
 * Run: node buyer/test_fresh_after_replay.mjs
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

const res1 = await paidFetch(READINGS_URL, { method: "GET" });
await describeResponse("Request 1 — fresh payment", res1);
const step1 = verdict("first purchase settles", res1.status === 200, `status ${res1.status}`);

const usedHeader = getLastPaymentHeader();
const res2 = await sendWithPaymentHeader(READINGS_URL, usedHeader);
await describeResponse("Request 2 — replay of request 1", res2);
const step2 = verdict("replay rejected", res2.status === 402, `status ${res2.status}`);

const res3 = await paidFetch(READINGS_URL, { method: "GET" });
await describeResponse("Request 3 — fresh payment after the replay attempt", res3);
const newHeader = getLastPaymentHeader();
const step3 = verdict(
  "idempotency does not block a legitimate later purchase",
  res3.status === 200 && newHeader !== usedHeader,
  `status ${res3.status}, distinct authorization: ${newHeader !== usedHeader}`
);

process.exit(step1 && step2 && step3 ? 0 : 1);
