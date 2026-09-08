# Week 8 Build Log — `x402-iot-poc`

> Append only. Executed 2026-09-08 against local `wrangler dev` and the deployed
> Worker.

**Deployed version this week:** `a39edbbc-e0ae-4c77-9dd2-bc62bf5fd3ef`
**Release tagged:** `v1.0.0`

---

## Audit summary

- **Automated tests:** 26, all passing
- **Mutation checks:** 4 of 4 caught
- **Manual checks:** 12, all passing
- **Defect found and fixed this week:** 1 (test-suite flakiness — Block 4)
- **Accidental live experiment:** 1, and the suite caught it — Block 2

---

## Block 1 — The test suite that should have existed in Week 3

`test/regressions.spec.ts`, 26 tests. Not general coverage: **one test per bug
this project actually shipped**, plus the controls those bugs disabled.

The existing `test/index.spec.ts` was the scaffold's Hello World test, failing
against our worker since Week 1. Deleted.

```powershell
npx vitest run
```

```text
 ✓ test/regressions.spec.ts (26 tests) 438ms

 Test Files  1 passed (1)
      Tests  26 passed (26)
```

Coverage by bug:

| Bug (when it shipped) | Tests |
|---|---|
| Payment header name — W3 | 4 |
| Buyer-side-only mandate — W3/W4 | 9 |
| Mandate as bearer token — W4 | included above |
| Classifier label selection — W5 | 3 |
| Documented error codes not emitted — W3 | 7 |
| External payer accounting — W7 | 3 |

**PASS**

---

## Block 2 — Proving the tests are worth having

A passing suite proves nothing on its own. Each of the four shipped bugs was
reintroduced deliberately to confirm the suite goes red.

```text
=== MUTATION TEST: reintroduce each shipped bug, expect the suite to go red ===

1. header name: read only X-PAYMENT                  see below
2. mandate as bearer token: drop holder-is-payer     CAUGHT (suite red)
3. classifier: take the first class                  CAUGHT (suite red)
4. screen: drop the underpayment check               CAUGHT (suite red)
```

### Mutation 1 was not a drill

The first mutation script crashed on a Windows console encoding error
(`UnicodeDecodeError: 'charmap' codec`) **after** writing the mutation and
**before** restoring the file. The second run then backed up the already-mutated
file, reported "anchor not found", and left the header bug in the working tree.

So the repository briefly contained the exact Week 3 defect again — reading only
`X-PAYMENT`, with replay protection and rate limiting inert.

**The suite caught it, unprompted:**

```text
FAIL  test/regressions.spec.ts > regression 1: payment proof header name
      > reads the header the current client actually sends
AssertionError: expected undefined to be 'abc'

- Expected: "abc"
+ Received: undefined
```

That is the whole argument for this week's work, delivered by accident: the same
defect that survived a week of manual testing in Week 3 survived about ninety
seconds this time.

Restored, re-run:

```text
 Test Files  1 passed (1)
      Tests  26 passed (26)
```

**PASS** — 4 of 4 mutations caught.

**Recorded honestly:** the mutation script lived in a scratch directory and is
not committed, so "mutation-verified" is a claim about one run on one afternoon,
not a standing property. Logged as `C4` in `docs/OPEN-ITEMS.md`.

---

## Block 3 — Mandate hardening: seller binding

**The gap.** A mandate names the seller it authorizes spending with. The seller
never checked that name against itself. A mandate written for a cheap API was
presentable at an expensive one — the issuer's `max_per_call` would still be
enforced, but against a price they never agreed to.

**Fixed.** `verifyPresentedMandate()` now takes the seller's own origin and
returns `403 mandate_wrong_seller` on a mismatch. Compared by origin, so a
trailing slash or a path does not matter.

Mandate suite after the change:

```text
7/7 checks passed.
```

**PASS** — the new check does not disturb the existing seven cases.

---

## Block 4 — FAIL → FIXED: the mandate suite tripped its own rate limiter

**INITIAL FAIL.** Running `test_mandate.mjs` twice inside sixty seconds:

```text
RESULT FAIL — mandate cannot be used as a bearer token (status 429)
6/7 checks passed.
```

**Diagnosis.** Not a product defect and not the new seller check. Case 7 sends a
payment proof, so it passes through the rate limiter on the way in. Two runs
inside one window exceed the 10-per-minute quota and the identity check is never
reached — a `429` there is the limiter working correctly.

This matters beyond the annoyance: **a test that reports red when the system is
behaving correctly trains you to ignore red.**

**FIX.** Case 7 detects a `429`, waits out the `Retry-After`, and retries once.

```text
7/7 checks passed.
```

**FIXED.** Case 6 can still flake the same way and does not yet retry — logged as
`C1` in `docs/OPEN-ITEMS.md` rather than left as folklore.

---

## Block 5 — A2A price negotiation

`GET /api/negotiate?resource=&offer=`. Buyer counters at its per-call limit;
seller accepts at or above list price, otherwise declines and restates the price.
No discounting. Free, non-binding, re-checked at payment.

### Seller side

```powershell
curl.exe -sS ".../api/negotiate?resource=inference"
{"resource":"inference","list_price_usdc":0.002,"offer_usdc":0,"accepted":false,
 "reason":"no_offer_made","counter_usdc":0.002,
 "note":"Send ?offer= to make one. Quotes are not binding; payment is still verified at the resource."}

curl.exe -sS ".../api/negotiate?resource=inference&offer=0.001"
{"...":"...","accepted":false,"reason":"offer_below_list_price","counter_usdc":0.002,
 "note":"Declined. This seller does not discount; the counter is the list price."}

curl.exe -sS ".../api/negotiate?resource=inference&offer=0.002"
{"...":"...","accepted":true,"resource_url":".../api/inference",
 "note":"Accepted. Pay through the normal 402 flow at resource_url."}

curl.exe -sS ".../api/negotiate?resource=nonsense"        404
curl.exe -sS ".../api/negotiate?resource=readings&offer=abc"  400
```

A declined offer returns **200**, not 4xx: a decline is a successful negotiation,
and returning an error status would make a buyer's retry logic treat a normal
answer as a fault.

### Buyer side — the full exchange

`MAX_PER_CALL=0.001`, so inference at $0.002 is out of reach:

```text
[agent] Counter-offer declined for sell-inference: offered $0.001, they want $0.002
[agent] Paying $0.001 for sell-iot-reading (running total: $0.0000)
[agent] ✅ Purchased sell-iot-reading seq=2165 | tx=0xf7cc02547e… | total=$0.0010
[agent] Counter-offer declined for sell-inference: offered $0.001, they want $0.002
[agent] Paying $0.001 for sell-iot-reading (running total: $0.0010)
[agent] ✅ Purchased sell-iot-reading seq=2165 | tx=0x82b99c4c91… | total=$0.0020
```

**PASS** — the buyer asks, is refused with the real price, and proceeds with what
it can afford instead of stopping.

### Remote

```text
.../api/negotiate?resource=inference&offer=0.001  →  declined, counter 0.002
.../api/negotiate?resource=readings&offer=0.001   →  accepted, resource_url returned
```

**PASS**

---

## Block 6 — Release

```powershell
npx tsc --noEmit     # exit 0
npx vitest run       # 26 passed
npx wrangler deploy  # a39edbbc-e0ae-4c77-9dd2-bc62bf5fd3ef
```

`CHANGELOG.md` written back to 0.1.0, with the defects recorded in the versions
where they were fixed rather than quietly omitted.

Tagged `v1.0.0`.

**PASS**

---

## Cumulative

```text
total purchases:  191+   (189 before this week's negotiation test)
external payers:  0
automated tests:  26
open items:       27 tracked in docs/OPEN-ITEMS.md
```

## What is not in this log

The revenue impact memo, funnel fixes and CFP abstracts produce no test output:

| Deliverable | File |
|---|---|
| Revenue Impact Memo | `docs/memos/REVENUE-IMPACT.md` |
| Funnel fixes | `docs/memos/FUNNEL-FIXES.md` |
| CFPs + podcast pitch | `docs/content/cfp-and-podcast-pitches.md` |
| Consolidated fix list | `docs/OPEN-ITEMS.md` |

B2B follow-ups and the first paid engagement did not happen: nothing was sent in
waves #1 or #2, so there is nothing to follow up.
