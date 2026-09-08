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
| A1 | **Write-after-settle window.** The replay key is written *after* the facilitator confirms. A crash in between allows the same proof to be reused. | It is the one gap in replay protection, and the memo names it as a real-value blocker. On-chain nonce is a second barrier, so exposure is bounded — but our layer does not close it. | Key reserved before settlement with rollback on failure, **or** a written accepted-risk note naming who accepted it |
| A2 | **Paid-but-undelivered.** If the DeviceTwin fails after settlement the buyer pays and receives `503` with no data and no refund. | Observed directly under a forced fault. Rounding error on testnet; a customer who paid for nothing with real value. | Delivery cannot fail after settlement, **or** a refund/credit path exists |
| A3 | **Daily cap is a UTC calendar-day counter, not a rolling window.** An agent running across midnight can spend up to 2× its cap in 24 h. | Found by running the agent for an hour across midnight and reading the ledger. C4 asks for a *hard* cap; this one is softer than it looks. | Cap evaluated over a rolling 24 h |
| A4 | **Agent Card is unsigned.** Discovery trusts TLS alone. | A2A v1.0 specifies signed cards (JWS + JCS). This is the clearest gap between what we built and what open discovery needs. | Card signed, and the buyer verifies the signature |
| A5 | **Inference input is not validated before payment.** Empty `?text=` falls back to a sample rather than refusing. | Refusing after settlement would charge for nothing (see A2); validating before the gate is the correct fix, and it is not done. | Input validated *before* the payment gate runs |
| A6 | **Rate limiting is not atomic.** KV read-modify-write under concurrency can let the quota be exceeded. | Verified sequentially only. Low impact at our volume, real at launch volume. | Atomic counter (Durable Object), or documented as best-effort with a measured bound |

## B · Verification gaps — things claimed but not proven

| # | Item | Status | Done when |
|---|---|---|---|
| B1 | **Stranger test — README reproducibility** | Open since W4 | One person, watched, ≤15 min, findings recorded — see `PENDING-HUMAN-TESTS.md` |
| B2 | **30-second demo comprehension test** | Open since W3 | One person, 30 s, their answer written down verbatim even if wrong |
| B3 | **Real `Ctrl+C` clean exit** | PARTIAL since W3 | A console `Ctrl+C` shows `SIGINT received` and the ledger records `agent_stopped` |
| B4 | **Explorer link followed by a human** | Open since W3 | A screenshot of the transaction on `sepolia.basescan.org` |
| B5 | **Tutorial run on a clean machine** | Open since W5 | Every block executed from an empty directory, timed |
| B6 | **24-hour unattended run** | PARTIAL — longest is 1 h | Either run it, or the DoD stays PARTIAL with the real number |
| B7 | **Demo Day deck rehearsed twice** | Not rehearsed | Two run-throughs, timed |
| B8 | **Fallback demo video recorded** | Not recorded | Follow `docs/content/demo-video-script.md`; needed so a failed live demo does not end the talk |

## C · Test suite gaps

| # | Item | Notes |
|---|---|---|
| C1 | **Mandate suite is not idempotent under its own rate limiter.** Running `test_mandate.mjs` twice inside 60 s trips the 10/min quota. | Case 7 now waits out a `429` and retries once; **case 6 can still flake the same way** and does not retry. Fix: give case 6 the same treatment, or reset the limiter between runs. |
| C2 | **No integration test hits the worker over HTTP.** The vitest suite tests pure functions; route behaviour is verified by scripts run by hand. | A `SELF.fetch` test for `402` on both resources, the negotiation endpoint and the subscribe flow would cover it. |
| C3 | **No test covers `rejectReplay` or `enforceRateLimit`.** Both are reachable only after a real settlement, so neither is exercised by the unit suite. | Test them directly with a stub KV, the way the mandate functions are tested. |
| C4 | **Mutation testing is manual.** The four-bug mutation check was a throwaway script in a scratch directory. | Either commit it as a documented script or drop the claim that the suite is mutation-verified. |

## D · Documentation and consistency

| # | Item |
|---|---|
| ~~D1~~ | ~~`README.md` "Quickstart" overlaps `QUICKSTART.md`.~~ **CLOSED 2026-09-08** — the README section is now "Run your own seller" and points at `QUICKSTART.md` for the shorter "pay the live one" path. |
| D2 | The `index.ts` header comment lists routes as "Week 3 routes" but now includes W5–W8 additions, and a stray duplicate section comment sits above the email-capture block. |
| D3 | Receipts written before W5 show `Resource` as unlabelled on the demo page. Correct — but a first-time viewer reads it as a bug. One line of explanation on the page would fix it. |
| D4 | `AGENTS.md` is a Cloudflare template file, not ours. Either adopt it deliberately or remove it. |
| D5 | The research board flags four signals as secondary coverage needing primary confirmation before it is loaded. Not yet confirmed. |
| D6 | `CHANGELOG.md` and `docs/week9/HANDOFF.md` both list the deployed version. They will drift on the next deploy unless one references the other. |
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

1. **A1–A6** are code. They are the v1.0 bar, and A1/A2 are named in the
   real-value memo's Phase 1.
2. **B1–B8** need a person: about an hour for B1–B4, plus an afternoon for the
   tutorial run and two rehearsals. `PENDING-HUMAN-TESTS.md` has the exact steps
   for B1–B5; the plan is to run them as one batch.
3. **C1–C4** are test debt created this week while paying off older test debt.
4. **D1–D7** are an afternoon. D1 and D7 are closed; D2–D6 remain.
5. **E1–E6** are decisions, not work.

**Rule for the final pass:** an item does not move to done because it was
discussed. It moves when the thing it describes has been observed working, and
the observation is pasted somewhere.
