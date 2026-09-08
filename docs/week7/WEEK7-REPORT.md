# Week 7 Report — External adoption & real-value readiness

**Date:** 2026-09-08 · **Deployed version:** `fa271a80-8f79-434f-811a-314ac593ccce`
**Evidence:** `docs/week7/BUILD-LOG.md`

Week 7 has two halves. The half that depends on strangers did not happen. The
half that depends on judgement did, and it is the strongest written work in the
programme so far.

---

## Definition of done

| Task | DoD | Status |
|---|---|---|
| External-adoption push | ≥1 external agent settles a testnet payment (**Milestone 4**) | **NOT ACHIEVED** — 0 external payers |
| Real-value readiness memo | 2–3 page memo delivered + 30-min walkthrough | **DELIVERED** — memo written; walkthrough not held |
| B2B wave #2 + follow-ups | 3 briefings booked cumulative; 10-slide deck ready | **PARTIAL** — deck content complete; 0 sent, 0 booked |
| Post #3 — the numbers post | Draft to manager | **DRAFTED** |
| Channel #2 decision | Written proposal with the score maths | **DELIVERED** — with the maths, which comes to zero |
| Rhythm + Friday demo #7 + self-review | Written mid-programme self-review | **SELF-REVIEW DELIVERED** — demo not held |

---

## 1. Milestone 4: not achieved, and now impossible to fudge

**0 external payers.** Every settlement this project has ever taken — 189 of them,
$0.191 in testnet USDC across five active days — came from a wallet we control.

The useful work this week was making that fact structural rather than editorial.
`OWN_WALLETS` lists the addresses we own; `/api/payers` counts a payer as
external only if it is not on that list; and the endpoint emits the milestone
verdict itself:

```json
"external_payers": 0,
"milestone_w7_met": false
```

The demo page now carries a **Who is paying** panel showing every recent wallet
labelled `ours` or `external`, currently reading *"no external payers yet"*. A
visitor cannot mistake the demo buying from itself for traction, and neither can
a report.

**Why this mattered enough to build.** You offered a second MetaMask wallet for
this. Funding one and pointing it at the API would produce a settlement from a
different address, and it would have been easy to let that number stand as
"external adoption". It is not — the KPI is defined as settlements from wallets
we do not own, and a wallet we fund is one we own. The quickstart smoke test is
worth running with it; the milestone is not claimable by it. Putting the
exclusion in config rather than in a footnote is what stops that line blurring
later, when someone is assembling a final report at speed.

**What was built to make adoption possible:** `QUICKSTART.md` — faucet, clone,
one command, settlement, with the four errors a newcomer actually hits and what
each means. It asks anyone taking longer than five minutes to open an issue
saying where they stalled, because the stall point is worth more than the
payment.

**What is missing is the same thing that has been missing since Week 4:** nobody
has been shown it. The quickstart is linked from the README of a repository that
has not been announced anywhere.

---

## 2. The real-value readiness memo

This is the week's most valuable deliverable and the one least dependent on
anyone else.

**Recommendation: do not move to real value in the next quarter.** The reasoning
is the part worth reading, because it inverts what the programme assumed at the
start.

**The blocker is no longer regulatory.** A year ago "regulatory uncertainty" was
the honest answer. Today the GENIUS Act is US federal law, MiCA is in force with
a July 2026 authorization deadline, and Japan and Brazil have frameworks. It has
become a licensing and counsel question with written rules to read against —
bounded work.

**The blocker is security.** Three 2026 papers document real attacks on x402
implementations, the protocol has no application-layer nonce, and an independent
assessment found violations in **every facilitator it evaluated**, Coinbase's
included. On top of that, our own build produced three findings about autonomous
spending controls, all of which sat inside a system whose author believed the
controls worked.

The memo carries:

- our non-custodial posture written out for counsel — we never hold funds or
  keys, and transfers move buyer-to-seller via a third party, which is a
  materially smaller surface than "we process payments";
- the line that would change that: running our own facilitator, which is
  technically trivial and legally significant, and should not be decided on
  engineering grounds;
- four pricing models with the custody trade made explicit — prepaid balances are
  the obvious efficiency win and are exactly the change that makes us a
  custodian;
- a four-phase path with go/no-go gates, where Phase 1 is six fixes we already
  know we need;
- **twelve numbered questions for counsel.** Question 5 is the one I would ask
  first: what AML obligations attach to accepting payment from an anonymous
  wallet with no account. Everything commercially interesting about this product
  follows from that property, and it is the property AML review is most likely to
  challenge.

---

## 3. Post #3 — the numbers post

Drafted, and it opens with the zero:

> **189 payments, 0 customers: five weeks of building an API for machines**

Every figure is measured rather than estimated. The post's spine is the four bugs
and the pattern they share — all four looked like working software, none threw,
and one test passed for the wrong reason for a week.

Leading with 189 would read better. It would also be the exact overclaiming this
project has spent five weeks catching in itself, so the draft leads with the
zero and explains why it is zero.

---

## 4. Channel #2 decision

The task branches on channel #1's interest score. The maths:

```
score = 3×0 + 2×0 + 5×0 + 8×0 + 20×0 − 10×0 = 0
```

**That zero is the absence of a channel, not the failure of one.** Channel #1
never went live: it depends on five book posts with verified checkout links,
requested twice in Week 2 and never received. Five weeks on, that single missing
input has hollowed out four downstream deliverables.

**Proposal: no paid micro-test.** Gate 2 requires Gate 1 organic signal and
working attribution. Attribution now exists; organic signal does not, because
nothing has been posted. Spending $10–25/day to acquire traffic for an untried
funnel buys the answer to a question nobody asked.

Instead: run channel #1 organically with the PoC's own assets, which are written
and cost nothing. One useful redefinition — Gate 1's "1 purchase" has a literal
reading here: **one settlement from a wallet we do not own**, measured
automatically and impossible to fake.

---

## 5. Self-review

Five things I would change, written out in `docs/week7/SELF-REVIEW.md`. The one
that matters:

**The order was wrong.** I built the test suite last instead of first, and four
bugs shipped in five weeks — every one of them invisible to the tests I had, one
of them passing for the wrong reason. And more structurally: I would move the
stranger test and the first publication into Week 3, before the second resource
and before the funnel.

At Week 7 there are two products, five error layers, instrumentation, an email
capture mechanism and a research board — and **zero external humans and zero
external agents** have touched any of it. The technical work compounded well. The
distribution work compounded not at all, because it never started.

I marked those deliverables complete each week, correctly, because they were.
Complete and useful are not the same thing, and the plan measured the first.

---

## Carried limitations

Unchanged from Week 6, with one now urgent:

1. Write-after-settle window on the replay key.
2. Paid-but-undelivered on device failure; no refund path. **The memo elevates
   this**: it is a rounding error on testnet and a customer who paid for nothing
   with real value.
3. Daily cap is a UTC calendar-day counter, not rolling.
4. Agent Card unsigned.
5. **No automated test suite — due Week 8, and now four bugs overdue.**
6. Rate limiting not atomic under concurrency.
7. Single device, single buyer.
8. Graceful `Ctrl+C` unproven on Windows.
9. Inference input not validated before payment.
10. Metrics are a floor: non-atomic KV increments and eventually-consistent reads.

---

## What I need

1. **The publish decision.** Seventh week of asking. Milestone 4 is unreachable
   by any honest route without it, and Week 8's impact memo will otherwise be a
   memo about a launch that did not happen.
2. **One person, fifteen minutes** — the stranger test, open since Week 4.
3. **Counsel review of the memo**, or a decision not to seek one. It is cheap
   now and the answer expires slowly.

Week 8 does not depend on any of these: v1.0, negotiation, mandate hardening and
the test suite are all mine to build. I will get on with those.
