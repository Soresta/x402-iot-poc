/**
 * test_failclosed.mjs — fail-closed behaviour when the facilitator is unreachable.
 *
 * Point the Worker's FACILITATOR_URL at a blackhole (e.g. http://127.0.0.1:19999)
 * and run this. A signed, otherwise valid payment must NOT be served: the seller
 * must answer 503 with a Retry-After header and no telemetry in the body.
 *
 * No funds move — settlement never reaches a facilitator.
 *
 * Run: node buyer/test_failclosed.mjs
 */

import "dotenv/config";
import { READINGS_URL, buildAccount, makeRecordingPaidFetch, verdict } from "./x402-harness.mjs";

const account = buildAccount();
const { paidFetch } = makeRecordingPaidFetch(account);

console.log(`buyer: ${account.address}`);
console.log(`target: ${READINGS_URL}\n`);

let res;
try {
  res = await paidFetch(READINGS_URL, { method: "GET" });
} catch (err) {
  console.error(`client threw: ${err.message}`);
  process.exit(1);
}

const body = await res.text();
console.log("--- Response with facilitator blackholed ---");
console.log(`status: ${res.status}`);
console.log("all response headers:");
for (const [k, v] of res.headers) console.log(`  ${k}: ${v.slice(0, 120)}`);
console.log(`body: ${body}`);

const pass =
  res.status === 503 &&
  res.headers.get("retry-after") !== null &&
  !body.includes("temperature");

verdict(
  "unreachable facilitator → 503 + Retry-After, no telemetry leaked",
  pass,
  `status ${res.status}, Retry-After: ${res.headers.get("retry-after")}`
);

process.exit(pass ? 0 : 1);
