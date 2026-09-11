# Revenue Impact Memo

**To:** manager · **From:** internship, Machine-Payments Revenue Sprint
**Date:** 2026-09-08 (W8 draft) · **Revision due:** Friday

Every number in this memo is checkable, and I have assumed you will check them.
Where a figure comes from our own infrastructure I have named the endpoint that
produces it. Where it comes from your systems, I have marked it as not available
to me.

**The headline is a zero, and it is the honest one.** No revenue is attributable
to this work, because nothing has been published.

---

## 1. KPI table — baseline to now

Attribution classes: **direct** (traceable to this work), **assisted**
(plausibly contributed), **unknown** (moved, cause unclear).

| KPI | Baseline | Now | Δ | Attribution | Source |
|---|---:|---:|---:|---|---|
| Real human visits / week — pragma.vision | 1400 | not available | — | — | your analytics |
| Real human visits / week — soft.house | 1400 | not available | — | — | your analytics |
| Bot visits / week — pragma.vision | 21000 | not available | — | — | your analytics |
| Ebook sales / week | 0 | not available | — | — | your sales export |
| Backlinks + mentions | 0 | **0** | 0 | — | manual search |
| Watch subscriptions | 0 | not available | — | — | your confirmation |
| **Email list** | 0 | **0** | **0** | direct (mechanism), none (result) | `/api/subscribers/count` |
| **External agent payments** | 0 | **0** | **0** | direct (mechanism), none (result) | `/api/payers` |
| B2B briefings booked | 0 | **0** | 0 | — | CRM |
| Native-AI-agents (SEO/AEO-GEO) | 0 | not available | — | — | your analytics |

**Four rows I can measure read zero. Five I cannot measure at all.**

The two rows measured from infrastructure in this repo are the ones I would
defend line by line — and both read zero because the funnel above them was never
opened.

### Why so much is "not available"

I do not have analytics or sales access. This was flagged in Weeks 4, 6 and 7.
It is not an excuse for the zeros — those are real — but it does mean I cannot
tell you whether anything moved for reasons unrelated to me, and I will not
guess. **No row in this table is classified `assisted` or `unknown` on a hunch.**

---

## 2. What was produced, honestly separated from what it earned

| | |
|---|---|
| Settlements executed | **189** |
| Volume settled | **$0.191** testnet USDC |
| Distinct paying wallets | **1** — ours |
| External paying wallets | **0** |
| Infrastructure spend | **$0** |
| Paid acquisition spend | **$0** |

The 189 settlements are a working system exercising itself. **They are not
revenue and I am not presenting them as a proxy for it.** The temptation in a
memo like this is to reclassify activity as impact; the whole reason the payer
count is computed by excluding our own wallets in code is so that this paragraph
cannot be written any other way.

---

## 3. What worked, what didn't, why — one page

**What worked: the build compounded.**

Each week made the next cheaper. The Week 5 refactor into a shared payment gate
meant the second product inherited every security control for free. The Week 4
mandate layer made the Week 8 negotiation feature a small addition rather than a
redesign. By Week 8 the seller does identity, authorization, payment, replay
protection, rate limiting, receipts, live streaming, two products, negotiation,
metrics and email capture — on a free tier, with 57 tests behind it.

**What worked: the verification discipline paid for itself.**

Four defects reached production. All four were found by re-testing rather than
by users, because there were no users. Each is written up with the failing
output. One of them — the payment header name — had two security controls
silently switched off for a week while every test passed. Finding that ourselves
is worth more than the fix.

**What didn't work: none of it left the building.**

Ten publishable assets are written and unpublished. The funnel is instrumented
and empty. The blocker is a single input requested in Week 2 and a publish
decision requested every week since Week 4.

**Why, without softening it:** I treated the distribution lane as something that
would start once the build was ready, and kept making the build readier. The
plan's own instruction — *"the REV lane survives first; say it Monday, not
Friday"* — is the exact advice I did not take. I reported the blocker weekly
rather than escalating it once, hard, in Week 3.

---

## 4. Cost versus value

**Cost**

| | |
|---|---|
| My time | ~7 weeks of the programme to date |
| Infrastructure | $0 — free tier throughout |
| Paid acquisition | $0 — no micro-test was proposed, correctly |
| Testnet tokens | $0 — faucet |

**Value delivered — with attribution stated plainly**

| Asset | Status | Attributable revenue |
|---|---|---|
| Working PoC, deployed, MIT, v1.0.0 tagged | live | **none** |
| 57-test suite, 7 of 7 known defects caught when reintroduced | live | **none** |
| Real-value readiness memo — 12 counsel questions | delivered | **none directly.** Shortens a future legal review; the saving is real and unquantified |
| Agentic-payments research board — 11 technologies, 21 dated signals | drafted | **none yet.** This is the Watch subscription's content |
| Flagship tutorial, 3 posts, 2 X threads, Show HN, 2 subreddit posts, outreach template, 10-slide deck, 90-second video script | written, unpublished | **none** |
| Four documented defect classes in a young ecosystem | published in-repo | **none.** Credible material for the briefings |

**The honest summary of cost versus value:** the programme produced reusable
assets and zero revenue. The assets are real and the zero is real, and I would
rather you see both than have the second one dressed as the first.

---

## 5. Months 3–6 — targets I would sign up for

Conditional on the publish decision, because without it every one of these is
unreachable and I will not sign up for a number I cannot influence.

| Target | Number | Why this number |
|---|---:|---|
| External paying wallets | **5** | Measured at `/api/payers`, unfakeable. Milestone 4 is 1; 5 says it was not an accident |
| Email list | **50** | ~1% of a modest launch, consent-first |
| Quality backlinks | **10** | Directory listings plus organic references |
| B2B briefings held | **6** | 15 outreach messages at the ≥3-reply rate the DoD assumes |
| Tutorial completions | **20** | Measurable via a completion beacon we would need to add |
| Real-value pilot | **counsel opinion obtained, no value moved** | Phase 0 of the readiness memo. Deliberately not "mainnet live" |

### The plan sketch behind them

1. **Publish, then fix what the first fifty readers break.** Everything is
   written. This is days, not weeks.
2. **Sign the Agent Card** — the one correctness item still open in `docs/OPEN-ITEMS.md`.
3. **Run the human tests** — stranger test, comprehension test, clean-machine
   tutorial run. About an hour in total, open since Week 3.
4. **Counsel review** of the readiness memo. Cheap now, and the answer expires
   slowly.
5. **Then, and only then, consider a paid micro-test**, with score maths from an
   organic run behind it.

---

## 6. What I would want you to take from this

Three things.

**The build is defensible.** Every claim in the README can be reproduced from a
clean clone; four real bugs are documented with their failing output; the
external-payer count is computed in code precisely so it cannot be flattered.

**The distribution is not started, and that is the whole gap.** Not
underperformed — not started. One input from Week 2 and one decision from Week 4
would have made this a different memo.

**Do not read 189 settlements as traction.** It is a system proving it works, by
buying from itself. The interesting number is still 0, and it will stay 0 until
someone outside this project is shown the door.
