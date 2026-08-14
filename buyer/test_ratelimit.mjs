/**
 * test_ratelimit.mjs — rate-limit breach and recovery.
 *
 * Sends RATE_LIMIT_QUOTA + 2 requests carrying a syntactically valid but
 * unsigned payment header. The rate limiter runs before payment verification,
 * so the first N requests reach the x402 middleware (which refuses them with a
 * 402 — no funds move) and the requests past the quota must return
 * 429 + Retry-After.
 *
 * With --recover it then waits out the window and proves the limiter releases.
 *
 * Run: node buyer/test_ratelimit.mjs [--recover]
 */

import "dotenv/config";
import {
  READINGS_URL,
  buildAccount,
  dummyPaymentHeader,
  sendWithPaymentHeader,
  verdict,
} from "./x402-harness.mjs";

const QUOTA = Number(process.env.RATE_LIMIT_QUOTA) || 10;
const WINDOW_S = Number(process.env.RATE_LIMIT_WINDOW_S) || 60;
const account = buildAccount();
// Distinct payer per run so a previous run's window does not pollute this one.
const payer = `0x${Date.now().toString(16).padStart(40, "0").slice(-40)}`;
const header = dummyPaymentHeader(payer);

console.log(`buyer key: ${account.address}`);
console.log(`rate-limit payer identity: ${payer}`);
console.log(`quota: ${QUOTA} per ${WINDOW_S}s | target: ${READINGS_URL}\n`);

const statuses = [];
let firstRetryAfter = null;

for (let i = 1; i <= QUOTA + 2; i++) {
  const res = await sendWithPaymentHeader(READINGS_URL, header);
  const body = await res.text();
  const retryAfter = res.headers.get("retry-after");
  if (res.status === 429 && firstRetryAfter === null) firstRetryAfter = retryAfter;
  statuses.push(res.status);
  console.log(
    `#${String(i).padStart(2)} status=${res.status}${retryAfter ? ` retry-after=${retryAfter}` : ""} body=${body.slice(0, 120)}`
  );
}

const overQuota = statuses.slice(QUOTA);
const passBreach = overQuota.every((s) => s === 429) && firstRetryAfter !== null;
verdict(
  "requests past quota return 429 + Retry-After",
  passBreach,
  `over-quota statuses: ${overQuota.join(", ")}, Retry-After: ${firstRetryAfter}`
);

let passRecovery = null;
if (process.argv.includes("--recover")) {
  const waitS = WINDOW_S + 5;
  console.log(`\nwaiting ${waitS}s for the window to slide…`);
  await new Promise((r) => setTimeout(r, waitS * 1000));
  const res = await sendWithPaymentHeader(READINGS_URL, header);
  const body = await res.text();
  console.log(`after window: status=${res.status} body=${body.slice(0, 120)}`);
  passRecovery = res.status !== 429;
  verdict("limiter releases after the window", passRecovery, `status ${res.status}`);
} else {
  console.log("\n(recovery check skipped — rerun with --recover)");
}

process.exit(passBreach && passRecovery !== false ? 0 : 1);
