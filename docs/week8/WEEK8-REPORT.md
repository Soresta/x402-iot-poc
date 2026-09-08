# Week 8 Report — Consolidate: impact memo & PoC v1.0

**Date:** 2026-09-08 · **Deployed:** `a39edbbc-e0ae-4c77-9dd2-bc62bf5fd3ef` · **Tagged:** `v1.0.0`
**Evidence:** `docs/week8/BUILD-LOG.md`

The week the technical debt got paid and the revenue memo got written. One of
those went well.

---

## Definition of done

| Task | DoD | Status |
|---|---|---|
| PoC v1.0 — negotiation + release | All paths green from a clean clone; tag v1.0.0 + changelog | **PASS** — negotiation live, 26 tests, tagged |
| Mandate verification hardening | Expiry, scope, signature checked every call | **PASS** — plus seller binding, which was missing |
| Minimal test suite | Unit tests for mandate + settlement logic, one scripted end-to-end | **PASS** — 26 tests, mutation-verified |
| Revenue Impact Memo | Draft Wed, revised Fri; every number checkable | **DELIVERED (draft)** — the headline number is zero |
| Funnel fixes from data | Top-3 drop-offs → before/after proposals | **PARTIAL** — there is no funnel data; proposals are structural and labelled as such |
| CFPs + podcast pitch | 2–3 proposals + 1 pitch submitted, in the CRM | **DRAFTED, NOT SUBMITTED** — targets need live deadlines and manager sign-off |
| B2B follow-ups → first paid engagement | One proposal in a buyer's hands | **NOT DONE** — nothing was sent in waves #1 or #2, so there is nothing to follow up |
| Rhythm + Friday demo #8 | Impact memo walked through | **NOT HELD** |

---

## 1. The test suite, five weeks late

26 tests, and they are not general coverage — **one test per bug that actually
shipped**, plus the controls those bugs switched off.

A passing suite proves nothing by itself, so each of the four defects was
deliberately reintroduced to confirm the tests go red. Three were caught by the
scripted run.

**The fourth caught itself, and this is the best evidence in the report.** The
mutation script crashed on a Windows encoding error after writing a mutation and
before restoring the file, leaving the exact Week 3 header bug back in the
working tree — the one where replay protection and rate limiting were silently
inert. The suite failed immediately:

```text
FAIL  regression 1: payment proof header name
      > reads the header the current client actually sends
AssertionError: expected undefined to be 'abc'
```

That defect survived a week of manual testing in Week 3. This time it survived
about ninety seconds, and nobody was looking for it.

**What I would say about the timing:** this suite should have existed in Week 3.
Four bugs reached production in the interval, all of them invisible to the tests
that existed, one of them passing for the wrong reason. The self-review last week
called this the main thing I would change; this week is the correction, not the
achievement.

---

## 2. Mandate hardening — a gap I had not noticed

The task was "expiry, scope and signature checked on every call, not just the
first". That was already true since Week 4.

Reading the code for it turned up something that was not: **a mandate names the
seller it authorizes spending with, and the seller never checked that name
against itself.** A mandate written for one API was presentable at another. The
issuer's per-call limit would still hold, but against a price they never agreed
to.

Fixed — `403 mandate_wrong_seller`, compared by origin. Seven-case mandate suite
still green.

This is the third time in this project that reading code for one reason has
turned up a different hole, and all three were in the authorization layer. That
is consistent with the research board's lowest score being *autonomous agent
spending controls*, at 2 across every facet.

---

## 3. A2A price negotiation

A buyer that cannot afford the asking price now counters at its per-call limit
instead of giving up. The seller accepts at or above list price and otherwise
declines with the real price attached.

**Our seller always declines**, because it does not discount — and it is worth
being honest that this is a correct implementation of negotiation rather than a
haggling engine. What the exchange actually buys is a **machine-readable "no"
with the price attached**, so the buyer stops guessing:

```text
[agent] Counter-offer declined for sell-inference: offered $0.001, they want $0.002
[agent] Paying $0.001 for sell-iot-reading …
```

The agent asks, is refused, and proceeds with what it can afford. A declined
offer returns `200`, not an error status — a decline is a successful negotiation,
and a 4xx would make a buyer's retry logic treat a normal answer as a fault.

---

## 4. A test that lied, and got fixed

Running the mandate suite twice inside a minute produced:

```text
RESULT FAIL — mandate cannot be used as a bearer token (status 429)
```

The system was behaving perfectly: the case sends a payment proof, so it passes
the rate limiter, and two runs inside one window exceed the quota. **A test that
reports red when the system is correct trains you to ignore red**, which is
exactly how the Week 3 bugs survived. Fixed: it now waits out the `Retry-After`
and retries once. One sibling case can still flake the same way and is logged
rather than left as folklore.

---

## 5. Revenue Impact Memo — the number is zero

Four KPIs I can measure read **zero**. Five I cannot measure at all, because I
have no analytics or sales access.

| | |
|---|---|
| Settlements executed | 189 |
| Volume | $0.191 testnet |
| **External paying wallets** | **0** |
| Email list | 0 |
| Backlinks | 0 |
| Briefings booked | 0 |
| Infrastructure spend | $0 |

**The 189 settlements are not revenue and the memo does not present them as a
proxy for it.** They are a system exercising itself. The external-payer count is
computed by excluding our own wallets in code precisely so that paragraph cannot
be written any other way.

No row is classified `assisted` or `unknown` on a hunch. Where I cannot measure,
the memo says "not available to me" rather than guessing in a favourable
direction.

**Why, stated without softening:** I treated distribution as something that would
begin once the build was ready, and kept making the build readier. Ten
publishable assets are written and unpublished. The plan's own instruction —
*"the REV lane survives first; say it Monday, not Friday"* — is the advice I did
not take.

Months 3–6 targets are in the memo, conditional on the publish decision, because
I will not sign up for numbers I cannot influence.

---

## 6. Funnel fixes — honest about the data

The DoD says "from data". There is no funnel data: visits 0, signups 0, external
payers 0. The three drop-offs are **structural**, found by walking the funnel as
a stranger would, and each says what would prove it wrong.

1. **The demo page explains the machinery, not the point.** The strongest
   sentence this project owns — fifteen of sixteen visits are machines and none
   can pay — is not on it.
2. **Nothing asks the visitor to do anything.** The only CTA is an email signup;
   the five-minute quickstart is not linked from the page. The "no external
   payers yet" panel is honest and also reads as *nothing is expected of you* —
   proposed fix: "**Be the first.**"
3. **The quickstart's first step is its hardest.** Everything after step 1 is
   `git clone` and `npm install`; step 1 is a wallet, a private key and a faucet
   wait.

Two of the three are sequenced *after* a real human observation, because I have
guessed at them and a stranger should settle it.

---

## 7. Everything to fix, now in one place

`docs/OPEN-ITEMS.md` — 27 items in five groups: correctness and safety (6),
verification gaps (6), test-suite gaps (4), documentation drift (6), and blocked
on someone else (6). Each says where it came from and what "done" looks like.

Four of them were created this week while paying off older debt, which is honest
and worth noticing: the test suite has its own gaps, and `ERRORS.md` has drifted
behind the code again — the same drift that produced a Week 4 defect.

---

## What Week 9 needs

The final week is Demo Day, the handoff pack, and the role proposal. Two things
would change what can be said in all three:

1. **The publish decision.** Eighth week of asking.
2. **One hour of a person's time** for the six human-dependent tests in
   `PENDING-HUMAN-TESTS.md`. They close six DoD rows currently sitting at
   NOT VERIFIED, and they are the difference between a Demo Day deck that says
   "verified" and one that says "untested by anyone but me".
