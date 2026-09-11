# Changelog

All notable changes to this project. Dates are the day the work was done and
verified, not the day it was planned.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning is [semantic](https://semver.org/spec/v2.0.0.html).

**Testnet only.** Every version in this file settles on Base Sepolia with faucet
USDC. No release has ever been wired for real value.

---

## [Unreleased] — 2026-09-11

### Fixed

- **The spending cap reset at UTC midnight.** The buyer summed ledger entries
  dated "today" in UTC, so an agent running across midnight could spend up to
  twice its cap inside 24 hours. It is now a rolling 24-hour window
  (`buyer/budget.mjs`), pinned by regression test 5.

### Corrected — two limitations this project stated were wrong

Both were published in this changelog, the README, `ERRORS.md`, the real-value
memo, the tutorial and three post drafts. Both have been corrected everywhere they
appeared, and are recorded here rather than silently removed.

- **"Paid but undelivered" does not happen.** The claim was that a device failure
  after settlement left the buyer charged with no data. The x402 middleware in
  fact settles only when the handler returns a status below 400, and cancels
  otherwise. Verified on-chain: two paid requests against a deliberately broken
  device returned `503`, and the buyer's USDC balance was `40757000` before and
  after. The Week 3 evidence had shown no `payment-response` header on the failed
  request all along; it was misread.
- **There is no "write-after-settle window."** The claim — inherited from the
  original project brief — was that the replay key is written after settlement,
  leaving a crash window. The key is written inside the handler, which runs
  before settlement. Proven by resending a proof whose request had failed: it
  returned `payment_already_used` although nothing had settled.

The real side effect runs the other way and is small: a proof whose request fails
is already recorded, so resending that exact proof returns
`payment_already_used` although nothing was charged. Documented in `ERRORS.md`
and tracked as open item A7.

---

## [1.0.0] — 2026-09-08

First tagged release. The payment path is complete, the controls that protect it
are verified, and the regressions that reached production are covered by tests.

This is not "finished". It is the point at which the claims in the README can be
reproduced by someone else, and the known gaps are written down rather than
discovered.

### Added

- **A2A price negotiation** (`GET /api/negotiate`). A buyer whose mandate cannot
  cover the asking price can counter-offer; the seller accepts at or above list
  price and otherwise declines with the real price attached. This seller does not
  discount, and says so. Negotiation is free, non-binding, and re-checked at
  payment.
- **Regression test suite** (`test/regressions.spec.ts`) — 26 tests, one per bug
  that actually shipped. Verified by mutation: reintroducing each defect turns
  the suite red.
- **Seller binding on mandates.** A mandate names the seller it authorizes; the
  seller now checks that name against its own origin and returns
  `403 mandate_wrong_seller` if they differ. Without it, a mandate written for a
  cheap API was spendable at an expensive one.

### Changed

- `pickTopClass()` extracted from the inference handler so the classifier's
  label selection can be tested without paying for an inference.
- `screenPayment()` exported for direct testing.

### Fixed

- **Mandate suite flakiness.** `test_mandate.mjs` tripped its own rate limiter
  when run twice inside a minute and reported a red that was the limiter working.
  The bearer-token case now waits out a `429` and retries once.

### Known limitations

Listed in full in [`docs/OPEN-ITEMS.md`](./docs/OPEN-ITEMS.md). At the time of
tagging, this entry also listed a "write-after-settle window" and a
"paid-but-undelivered" case. **Both were wrong** — see the Unreleased section.

---

## [0.7.0] — 2026-09-08 (Week 7)

### Added

- `GET /api/payers` — settlements grouped by wallet, split into ours and
  external using an `OWN_WALLETS` allow-list, and emitting
  `milestone_w7_met` so the external-adoption milestone cannot be claimed in a
  report while the API says otherwise. **It reads `false`.**
- "Who is paying" panel on the demo page, labelling every wallet `ours` or
  `external`.
- `distinct_external_payers` in the daily metrics.
- `QUICKSTART.md` — pay this API in five minutes.

---

## [0.6.0] — 2026-09-06 (Week 6)

### Added

- Funnel instrumentation: `POST /api/visit` and `GET /api/metrics/daily`.
  Stores one counter per (day, source, campaign) and nothing else — no IP, no
  user agent, no cookie, no session.
- Demo page fires the beacon on load; footer links the tutorial and readiness
  board.

### Notes

- Metrics are a **floor, not a measurement**: KV has no atomic increment and its
  reads are eventually consistent. Both undercount. The endpoint says so in its
  own response.

---

## [0.5.0] — 2026-09-06 (Week 5)

### Added

- **Second priced resource**: `GET /api/inference`, a sentiment classification
  on Workers AI at $0.002 against $0.001 for a reading. The price gap is what
  makes `max_per_call` mean something.
- Consent-first email capture: `POST /api/subscribe`,
  `GET /api/subscribers/count`, `GET /api/subscribers.csv`. Stores email,
  timestamp and source — nothing else. **Export fails closed** without
  `EXPORT_TOKEN`.
- Buyer rotates across every resource its mandate can afford.

### Changed

- Payment gate extracted into `createPaidRoute()`. Both resources share rate
  limiting, identity, mandate verification, the payment screen, settlement,
  receipts and the fail-closed path, so a control cannot exist on one route and
  silently not the other.
- Demo page: receipts gain a Resource column; volume sums real amounts instead
  of assuming every settlement was $0.001.

### Fixed

- **Classifier reported the least likely label.** The model returns one entry
  per class in a fixed order, not sorted by confidence; the code read
  `output[0]`. Status 200, well-formed JSON, wrong answer every time.

---

## [0.4.0] — 2026-09-06 (Week 4)

### Added

- **Seller-side mandate verification.** The buyer presents its signed mandate in
  `X-Agent-Mandate`; the seller verifies it before any payment:
  `401 identity_unverified`, `401 identity_mismatch`,
  `403 mandate_expired` / `mandate_scope_exceeded` / `mandate_malformed` /
  `mandate_invalid_caps`, and `403 mandate_required` when `REQUIRE_MANDATE` is on.

### Why

Week 3 checked the mandate on the buyer only, which is an honour system: a
compromised agent skips its own check and the seller never finds out. The
identity check also binds the mandate holder to the paying address — without it a
mandate is a bearer token usable by anyone who copies it out of a request log.

---

## [0.3.1] — 2026-08-14 (Week 3 verification)

### Fixed

- **The seller read the payment proof from the wrong header.** `@x402/core` v2
  sends `payment-signature`; the code read `X-PAYMENT`. Payments settled
  perfectly while KV replay protection and rate limiting **never executed** — for
  a week. The replay test passed the whole time, because the rejection was coming
  from the chain refusing a reused authorization, not from our protection.
- **Documented error codes were never emitted.** `payment_amount_invalid` and
  `payment_network_invalid` were in `ERRORS.md` and produced by nothing;
  underpayments returned an empty `{}`. A pre-settlement screen now emits them.

### Added

- Verification scripts the Week 3 report had cited but which never existed:
  `test_replay.mjs`, `test_fresh_after_replay.mjs`, `test_negative.mjs`,
  `test_ratelimit.mjs`, `test_failclosed.mjs`, `soak.mjs`, and the shared
  `x402-harness.mjs`.

---

## [0.3.0] — 2026-08-08 (Week 3)

### Added

- `DeviceTwin` Durable Object with alarm-driven telemetry and a ring buffer.
- `GET /api/readings` behind the x402 gate, with KV idempotency (SHA-256 of the
  payment proof, 24 h TTL), a receipt log, and per-payer rate limiting.
- A2A Agent Card at `/.well-known/agent-card.json`.
- Live demo page with an SSE settlement feed.
- Autonomous buyer agent with a signed mandate, daily cap and kill switch.

---

## [0.2.0] — 2026-07-27 (Week 2)

### Added

- `GET /reading` — the first x402-gated route, and the first settlement on Base
  Sepolia. Preserved unchanged since, as the Week 2 evidence artefact.

---

## [0.1.0] — 2026-07-14 (Week 1)

### Added

- Repository scaffold, hello-world Worker.
