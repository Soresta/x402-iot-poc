# Open items — the single fix-it list

Everything known to be wrong, missing, or unverified, in one place, so the final
pass has one list to work from instead of eight weekly reports.

**Nothing here is hidden elsewhere.** Each item says where it came from and what
"done" looks like. Items are ordered by what would embarrass us most if a
reviewer found it first.

Last updated: 2026-09-08 (Week 9 — final; D1 and D7 closed in the README pass)

---

## A · Correctness and safety — fix before anything is called v1.0

| # | Item | Why it matters | Done when |
|---|---|---|---|
| ~~A1~~ | ~~Write-after-settle window.~~ **WITHDRAWN 2026-09-11 — the claim was wrong.** The replay key is written in the handler, and the middleware settles only after the handler succeeds, so the key is written *before* settlement. Proven: a paid request against a broken handler returned `503`, and resending that proof returned `payment_already_used` — the key existed although nothing settled. The real, smaller effect is tracked as A7. | | |
| ~~A2~~ | ~~Paid-but-undelivered.~~ **WITHDRAWN 2026-09-11 — the claim was wrong.** The middleware does not settle a response with status ≥ 400. Proven on-chain: two paid requests against a forced DeviceTwin failure, buyer USDC balance `40757000` before and after. The W3 evidence already showed no `payment-response` header on the failed request; it was misread. | | |
| ~~A3~~ | ~~Daily cap is a UTC calendar-day counter.~~ **CLOSED 2026-09-11** — `buyer/budget.mjs` sums spend over a rolling 24 h. Regression 5 in the test suite pins the exact failure: 0.01 at 23:50 plus 0.01 at 00:10, read at 00:30, must be 0.02 (the old logic said 0.01). | | |
| A4 | **Agent Card is unsigned.** Discovery trusts TLS alone. | A2A v1.0 specifies signed cards (JWS + JCS). This is the clearest gap between what we built and what open discovery needs. | Card signed, and the buyer verifies the signature |
| ~~A5~~ | ~~Inference input is not validated before payment.~~ **CLOSED 2026-09-11** — a `validate` hook on the payment gate runs before rate limiting, the mandate and the `402`. Empty or over-length text gets `400 inference_input_required` / `inference_input_too_long` and the buyer is never asked to sign. The old silent sample substitution and truncation are gone. Verified on the deployed Worker. | | |
| ~~A7~~ | ~~A proof can be used up without a charge.~~ **ACCEPTED AND DOCUMENTED 2026-09-11.** Resending a proof whose request failed returns `payment_already_used` although nothing was spent; observed live today when a settlement failed at the facilitator. **Deliberately not "fixed" by deleting the key on failure:** two concurrent requests with one proof would share that key, and the failing one would delete the key the succeeding one wrote, weakening replay protection to save a round trip. The x402 client re-signs automatically. Documented in `ERRORS.md`. | | |
| ~~A8~~ | ~~Failed settlements were recorded as receipts.~~ **FOUND AND CLOSED 2026-09-11.** The middleware sets a `payment-response` header on failure too (`success:false`), and `recordSettlement` recorded anything carrying one. Failed settlements became receipts with no transaction hash and were counted as sales by the demo page, `/api/payers` and `/api/metrics/daily` — including the two "transient failures" in the week 5 soak run. Measured on the deployed Worker: **100 settlements / $0.101 before, 97 / $0.098 after.** Now only `success:true` with a transaction is recorded, and every reader filters old entries through `isSettledReceipt()` rather than deleting them. Buyer-side ledger counts (189 purchases, 111 in the soak run) were never affected — the ledger only records `200` responses. | | |
| ~~A6~~ | ~~Rate limiting is not atomic.~~ **CLOSED 2026-09-11 — and it was worse than this row said.** The row predicted the quota "can be exceeded" under load. Measured against the deployed Worker: **30 simultaneous requests, 30 passed a quota of 10, three runs out of three.** The limiter now counts in a `RateLimiter` Durable Object; the same burst lets **exactly 10** through, three runs out of three. It also gained a per-IP bucket, because the payer address it keyed on is unverified at that point and could be rotated. `buyer/test_ratelimit_burst.mjs` reproduces it. | | |

## B · Verification gaps — things claimed but not proven

| # | Item | Status | Done when |
|---|---|---|---|
| B1 | **Stranger test — README reproducibility** | Open since W4 | One person, watched, ≤15 min, findings recorded — see `PENDING-HUMAN-TESTS.md` |
| B2 | **30-second demo comprehension test** | Open since W3 | One person, 30 s, their answer written down verbatim even if wrong |
| B3 | **Real `Ctrl+C` clean exit** | **Ledger half observed 2026-09-11** — `{"ts":"2026-09-11T09:51:07.218Z","result":"agent_stopped","signal":"SIGINT"}`, written by the handler after a real console `Ctrl+C`. Screenshot of the console half pending | The screenshot showing `SIGINT received` |
| B4 | **Explorer link followed by a human** | Open since W3 | A screenshot of the transaction on `sepolia.basescan.org` |
| B5 | **Tutorial run on a clean machine** | Open since W5 | Every block executed from an empty directory, timed |
| B6 | **24-hour unattended run** | PARTIAL — longest is 1 h | Either run it, or the DoD stays PARTIAL with the real number |
| B7 | **Demo Day deck rehearsed twice** | Not rehearsed | Two run-throughs, timed |
| B8 | **Fallback demo video recorded** | Not recorded | Follow `docs/content/demo-video-script.md`; needed so a failed live demo does not end the talk |

## C · Test suite gaps

| # | Item | Notes |
|---|---|---|
| ~~C1~~ | ~~Mandate suite trips its own rate limiter.~~ **CLOSED 2026-09-11** — case 6 now waits out a `429` and retries once, like case 7. |
| ~~C2~~ | ~~No integration test hits the worker over HTTP.~~ **CLOSED 2026-09-11** — `test/http.spec.ts`, 19 tests through `SELF.fetch`: `402` on all three paid routes, `400` before the `402` for bad inference input, screen codes, `403` before payment for an expired mandate, negotiation, subscribe consent, the export guard — and the A6 burst through the real Durable Object (30 concurrent, exactly 10 pass). No facilitator or chain call, so deterministic. |
| ~~C3~~ | ~~No test covers `rejectReplay` or `enforceRateLimit`.~~ **CLOSED 2026-09-11** — `rejectReplay` is tested against a stub KV (records once for 24 h, refuses a repeat, keeps proofs separate, records nothing without a proof). `enforceRateLimit` is tested through HTTP with the real Durable Object, which is the only way to test the concurrency it exists for. |
| ~~C4~~ | ~~Mutation testing is manual.~~ **CLOSED 2026-09-11** — `scripts/mutation-check.mjs`. Seven mutations (the four shipped defects plus A3, A5, A6), each restored in `finally`, and the run refuses to report success if any touched file differs afterwards. Result: **7 of 7 caught.** |

## D · Documentation and consistency

| # | Item |
|---|---|
| ~~D1~~ | ~~`README.md` "Quickstart" overlaps `QUICKSTART.md`.~~ **CLOSED 2026-09-08** — the README section is now "Run your own seller" and points at `QUICKSTART.md` for the shorter "pay the live one" path. |
| ~~D2~~ | ~~`index.ts` header comment stale.~~ **CLOSED 2026-09-11** — header lists every route grouped paid / free / write with the gate order; the empty "Demo page + SSE" section header now sits above the routes it names. |
| ~~D3~~ | ~~Pre-W5 receipts show an unlabelled resource.~~ **CLOSED 2026-09-11** — shown as "Sensor reading\*" with a tooltip saying it is inferred (readings were the only product then), not recorded. |
| ~~D4~~ | ~~`AGENTS.md` is a template file.~~ **CLOSED 2026-09-11 — adopted deliberately.** Its instruction (don't trust remembered Workers APIs) is exactly the mistake behind several defects here; a header now says why it is kept and points at the gotchas and the mutation check. |
| D5 | The research board flags four signals as secondary coverage needing primary confirmation before it is loaded. Not yet confirmed. |
| ~~D6~~ | ~~`CHANGELOG.md` and `HANDOFF.md` both list the deployed version.~~ **CLOSED 2026-09-11** — and the drift had already happened: the handoff runbook said "must be 26 passed" and named a version two deploys old, and its smoke test expected `402` from `/api/inference`, which now correctly returns `400` without input. The runbook no longer records a version or a test count. |
| ~~D7~~ | ~~`ERRORS.md` is behind the code by ten codes.~~ **CLOSED 2026-09-08** — all ten added and verified by a script that greps every code emitted from `src/` and checks it appears in the catalogue: 25 emitted, 0 undocumented. Worth re-running before any release. |

## E · Blocked on someone else

Not ours to fix, listed so the final report can say what was blocked and for how long.

| # | Item | Blocked since |
|---|---|---|
| E1 | **Publish decision.** Ten assets written, none posted. Every GTM and REV metric is zero by construction. | W4 |
| E2 | **Channel #1 inputs** — five book posts with verified checkout links. | W2 |
| E3 | **Milestone 4** — ≥1 external agent settles. Unreachable without E1. | W7 |
| E4 | **Research board loading** — manager action. | W4 |
| E5 | **Counsel review** of the real-value memo. | W7 |
| E6 | **Analytics access** for the KPIs we cannot measure ourselves. | W4 |

---

## How this list gets closed

1. **A** is down to one item. A1 and A2 were wrong and are withdrawn; A3, A5
   and A6 are fixed and measured; A7 is accepted with its reasoning. **A4 —
   the unsigned Agent Card — is the only correctness item left open.**
2. **B1–B8** need a person: about an hour for B1–B4, plus an afternoon for the
   tutorial run and two rehearsals. `PENDING-HUMAN-TESTS.md` has the exact steps
   for B1–B5; the plan is to run them as one batch.
3. **C1–C4** are closed.
4. **D** is down to D5 (confirming four research-board signals against primary sources).
5. **E1–E6** are decisions, not work.

**Rule for the final pass:** an item does not move to done because it was
discussed. It moves when the thing it describes has been observed working, and
the observation is pasted somewhere.
