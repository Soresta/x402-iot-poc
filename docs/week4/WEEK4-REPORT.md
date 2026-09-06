# Week 4 Report — Ship it (midpoint gate)

**Date:** 2026-09-06 · **Deployed version:** `b15e7b09-d1be-4058-b364-fab697af3a60`
**Evidence:** `docs/week4/BUILD-LOG.md` — every result below traces to a block there.

Week 4's theme was *hardening, documenting and publishing*. Two of those three
happened. The third could not, and this report says so rather than working
around it.

---

## Definition of done

| Task | DoD | Status |
|---|---|---|
| Hardening pass | The abuse-case checklist passes | **PASS** — all 7 cases, local and deployed |
| Docs that survive a stranger | Someone who isn't me reproduces it from the README in ≤15 min | **NOT VERIFIED** — README rewritten, but no stranger has attempted it |
| Midpoint gate demo | 30-min demo, manager accepts or redirects | **NOT HELD** — manager unavailable; assumed for scheduling, to be presented on return |
| Publish wave #1 | Live links collected; referral traffic visible | **DRAFTED, NOT PUBLISHED** — nothing posted, so no links and no traffic |
| Research board package | Package accepted for loading | **DRAFTED** — awaiting manager review; loading is the manager's action |
| Channel #1 maintenance | Keep replying; log scores | **BLOCKED** — no channel is live (see below) |
| Rhythm + Friday demo #4 | Publish numbers reviewed | **NOT HELD** — no numbers exist to review |

Four of seven tasks depend on a person other than me. They are marked as blocked
rather than quietly reframed as done.

---

## 1. Hardening pass — the one task with a real result

The abuse-case checklist now passes in full, on the deployed Worker:

| Abuse case | Response |
|---|---|
| Replayed payment proof | `402 payment_already_used` |
| Wrong amount | `402 payment_amount_invalid` |
| Wrong asset or network | `402 payment_network_invalid` |
| Expired mandate | `403 mandate_expired` |
| Request flood | `429` + `Retry-After: 60` from request 11 |
| Facilitator unreachable | `503` + `Retry-After: 5`, no telemetry served |
| Structured errors with 401 / 402 / 403 / 429 | all four implemented and tested |

**It did not pass before this week.** Two of those rows had no implementation at
all: the `401` and `403` codes were documented in `ERRORS.md` and produced by
nothing.

### What changed, and why it matters more than the checklist

Week 3 verified the buyer's spending mandate **on the buyer**. That is an honour
system — a compromised or buggy agent skips its own check and the seller, the
party with something to lose, never finds out. The Week 3 report recorded this as
limitation #11 rather than hiding it, which is why it was easy to pick up.

The seller now verifies the mandate itself, before any payment:

- **`401 identity_unverified`** — the signature does not recover to the address
  the mandate claims.
- **`401 identity_mismatch`** — the mandate is valid, but its holder is not the
  account funding the payment.
- **`403 mandate_expired` / `mandate_scope_exceeded` / `mandate_malformed` /
  `mandate_invalid_caps`** — identity is fine; the purchase is not authorized.

The second one is the interesting one. A signed mandate sitting in a request is a
bearer credential: valid signature, valid expiry, and usable by anyone who copies
it out of a log. Binding the mandate holder to the paying address is four lines
of code, and no specification we read asks for it.

Seven cases, 7/7, identical locally and on the public Worker. Six of the seven
are refused before any payment is attempted, so they move no funds — which is the
point of checking identity and authorization ahead of settlement.

### Regression

Replay, underpayment, wrong asset, rate limit, the Week 2 `/reading` route and
unpaid `/api/readings` all behave exactly as they did in Week 3. `tsc --noEmit`
clean.

---

## 2. Documentation — improved, but the test that matters was not run

`README.md` and `ERRORS.md` were reworked: the sequence diagram now shows mandate
verification, the three-layer separation table states which failures produce
which status code, both new config variables are documented, and the error
catalogue gained a section explaining the ordering of `429 → 401 → 403 → 402 →
503`.

The DoD is not "the README is better". It is **"someone who isn't you reproduces
the whole thing from the README alone, in ≤15 minutes"**, watched, without help.
That has not happened, so this is `NOT VERIFIED`.

This is the same gap as the Week 3 stranger test, still open. It needs one person
and fifteen minutes.

---

## 3. Research board package — drafted

`docs/research-board/AGENTIC-PAYMENTS-BOARD.md`: 11 technologies scored across
adoption, spec stability, tooling, security posture and regulatory clarity, with
21 dated signals and a source URL for each.

House style applied literally: a score that cannot cite a source or one of our own
experiments goes down. Consequences worth flagging before review:

- **x402 security scores 2.** Three 2026 papers document replay, wallet-drain,
  prompt-injection and linkability attacks; the protocol has no application-layer
  nonce, so a payment proof behaves as a bearer credential. A separate assessment
  reports that all evaluated facilitators failed agent-economy security tests.
- **Stablecoin regulatory clarity scores 4**, higher than the "regulatory
  uncertainty" framing of a year ago. The GENIUS Act is US law; MiCA is enforcing.
  This does not change our testnet-only position — it means the Week 7 counsel
  review is cheaper than it would have been in 2025.
- **The lowest row on the board is our own subject:** autonomous agent spending
  controls, 2 across every facet. All three justifications come from this repo —
  buyer-side enforcement being an honour system, mandates behaving as bearer
  tokens, and the daily cap resetting at UTC midnight.

Four signals are flagged in the document as secondary coverage that should be
confirmed against primary sources before loading, because facilitator counts and
payment volumes are exactly the figures a reader will quote back.

---

## 4. Publish wave #1 — written, not published

Three assets are drafted and ready:

| Asset | Length | Owed from |
|---|---|---|
| Post #1 — build in public | ~780 words | W2 GTM |
| Post #2 — architecture deep-dive | ~1100 words | W3 GTM |
| X threads, directory submission, UTM scheme, checklist | — | W4 GTM |

Post #2 carries what the brief asked for: the sequence diagram, the three-layer
story, and what broke. The "what broke" section is the longest part on purpose —
it describes the header-name bug that left two security controls silently
inactive for a week, and the honour-system mandate.

**Nothing has been posted.** No live links, no interest scores, no referral
traffic. The DoD for this task cannot be met without publishing, and publishing
is a decision for the manager and for you, not for this session.

---

## 5. Channel #1 maintenance — blocked upstream

This task is "keep replying; log scores" on a channel that went live in W2. That
W2 task required the manager to hand over drafted launch posts for five
promotable books with verified checkout links. Those were requested twice and not
received, so channel #1 never went live.

The blockage is therefore two weeks old and compounding: no channel means no
interest scores, which means the W7 "channel #2 decision" has no score maths to
decide from. Flagging it here so the chain is visible in one place, not so it
looks like an excuse.

---

## 6. Baseline captured

The manager's KPI sheets arrived this week and are transcribed in
`docs/metrics/BASELINE.md`. Seven of nine KPIs start at **zero**.

The one non-zero row is the argument for the whole programme:

| | pragma.vision | soft.house |
|---|---:|---:|
| Real human visits / week | 1400 | see note |
| Bot visits / week | 21000 | 1000 |

Fifteen machine visits for every human one, and today none of that machine
traffic can pay for anything. Two KPIs — email list and external agent payments —
are measured directly from infrastructure in this repo rather than reported by
hand.

**One number disagrees with itself.** The pragma sheet's `soft.hours` column says
0 weekly human visits; the soft.house sheet says 1400 — the same figure as
pragma, which is what a copied row looks like. That is the difference between "we
have an audience to convert" and "we are starting from nothing". Not resolved
here; needs the manager.

---

## Known limitations — carried and updated

Closed this week:

- ~~Mandate enforcement is buyer-side only~~ — now verified seller-side (401/403).

Still open, unchanged:

1. **Write-after-settle window.** The replay key is written after settlement
   confirms; a crash in between leaves a gap. The on-chain nonce is a second
   barrier, so practical risk is low, but our layer alone does not close it.
2. **Paid-but-undelivered on device failure.** No refund path.
3. **The daily cap is a UTC calendar-day counter**, not a rolling window. An
   agent crossing midnight can spend up to 2× its cap in 24 hours.
4. **The Agent Card is unsigned.** A2A v1.0 specifies signed cards using JWS;
   ours relies on TLS alone. This is now the clearest gap between what we built
   and what open discovery needs.
5. **No automated test suite.** Every check is a script run by hand. Scheduled
   for W8.
6. **Rate limiting is not atomic** under concurrent requests (KV
   read-modify-write).
7. **Single device, single price, single buyer.**
8. **Graceful `Ctrl+C` exit unproven on Windows.**

---

## What I need to unblock next week

1. **One person for fifteen minutes** — the stranger test. It closes a DoD that
   has now been open for two weeks.
2. **A decision on publishing.** The posts are ready. Until they go out, every
   GTM and REV metric in this programme stays at zero by construction.
3. **The soft.house visits figure** — 0 or 1400.
4. **Cloudflare Workers AI** confirmed available on the account: Week 5's
   pay-per-inference resource depends on it.
