/**
 * test_ratelimit_burst.mjs — does the rate limit hold when requests arrive at
 * the same time? (open item A6)
 *
 * The sequential test (test_ratelimit.mjs) passed from week 3 onward. It was
 * never the problem. Fired concurrently, the original KV limiter let every
 * request through:
 *
 *   deployed Worker, 30 simultaneous requests, one payer, quota 10 —
 *   30 passed, 0 refused. Three runs, same result.
 *
 * After the move to a Durable Object limiter, the same burst:
 *
 *   10 passed, 20 refused. Three runs, same result.
 *
 * Uses syntactically valid but UNSIGNED payment proofs. Anything that gets past
 * the limiter is refused by payment verification, so no funds move.
 *
 * Run: node buyer/test_ratelimit_burst.mjs [baseUrl]
 * Wait ~60 s between runs; the IP bucket (60 per minute) is shared.
 */

import { dummyPaymentHeader, verdict } from "./x402-harness.mjs";

const base = process.argv[2] || process.env.SELLER_URL || "http://127.0.0.1:8787";
const BURST = 30;
const PAYER_QUOTA = Number(process.env.RATE_LIMIT_QUOTA) || 10;

async function burst(headerFor) {
  const statuses = await Promise.all(
    Array.from({ length: BURST }, (_, i) =>
      fetch(`${base}/api/readings`, { headers: { "payment-signature": headerFor(i) } })
        .then((r) => r.status)
        .catch(() => 0)
    )
  );
  return {
    passed: statuses.filter((s) => s !== 429 && s !== 0).length,
    limited: statuses.filter((s) => s === 429).length,
    errors: statuses.filter((s) => s === 0).length,
  };
}

console.log(`target: ${base}`);
const tag = Date.now().toString(16);
const payer = "0x" + (tag + "a").padStart(40, "0").slice(-40);

const r = await burst(() => dummyPaymentHeader(payer));
console.log(`${BURST} concurrent from one payer: passed ${r.passed}, 429 ${r.limited}, errors ${r.errors}`);

const ok = verdict(
  "per-payer quota holds under a concurrent burst",
  r.passed === PAYER_QUOTA && r.limited === BURST - PAYER_QUOTA,
  `expected ${PAYER_QUOTA} passed / ${BURST - PAYER_QUOTA} refused`
);
process.exit(ok ? 0 : 1);
