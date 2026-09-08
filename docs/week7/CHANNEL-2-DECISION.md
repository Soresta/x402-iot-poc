# Channel #2 — decision proposal

**W7 REV ⚑ GATE** · DoD: written proposal with the score maths
**Date:** 2026-09-08

---

## The decision rule, and why it cannot be applied

The gate ladder says:

> **Gate 2 — Micro-test.** Tracking exists (UTM + attribution). $10–25/day, 2–3
> days, one channel, one asset — manager-approved.
>
> **Gate 3 — Keep/kill.** Interest score ≥15 and no moderator warnings →
> continue; else iterate or stop.

And the W7 task says: *if channel #1 reached interest ≥15, propose a paid
micro-test; if not, propose the next organic channel with what you would do
differently, based on the scores.*

**Channel #1 has no score, because channel #1 never went live.**

```
score = 3×replies + 2×saves + 5×signups + 8×checkout starts + 20×purchases − 10×warnings
      = 3×0 + 2×0 + 5×0 + 8×0 + 20×0 − 10×0
      = 0
```

That zero is not a measurement of a channel that underperformed. It is the
absence of a channel. The distinction matters, because "we posted and scored 0"
and "we never posted" lead to opposite decisions.

### Why it never went live

The W2 task *"Channel #1 goes live — first value-posts"* depends on an input from
the manager: drafted launch posts for five promotable books, with checkout links
verified. Those were requested twice and not received. Without them there was
nothing to post, and the dependency has been carried forward every week since.

Five weeks later that single missing input has propagated: no channel → no
interest scores → no Gate 3 evidence → no basis for a Gate 2 paid test. Recorded
here so the chain is visible in one place.

---

## The proposal

**Do not propose a paid micro-test.** Spending $10–25/day to acquire traffic for
a funnel whose organic version has never been tried would be buying an answer to
a question we have not asked. Gate 2 explicitly requires attribution to exist and
Gate 1 to have produced organic signal. Neither has happened.

**Proposal: run channel #1 organically first, with the assets already written.**

Everything needed is drafted and waiting:

| Asset | Where | Status |
|---|---|---|
| Post #1 — build in public | `docs/content/post-1-build-in-public.md` | ready |
| Post #2 — architecture | `docs/content/post-2-architecture.md` | ready |
| Post #3 — the numbers | `docs/content/post-3-the-numbers.md` | ready |
| Show HN + first comment | `docs/content/launch-week.md` | ready |
| Two subreddit posts, rewritten per community | `docs/content/launch-week.md` | ready |
| X threads | `docs/content/publish-wave-1.md` | ready |
| UTM scheme | `docs/content/funnel-map-and-utm.md` | ready |
| Instrumentation | live at `/api/metrics/daily` | tested |

Cost: **zero.** Time: the writing is done; what remains is posting and answering
comments for a day.

### What I would do differently — and this is a real answer, not a placeholder

The task asks for "what you'd do differently, based on the scores". I have no
scores, but I do have five weeks of building the funnel, and three things I would
change before anything goes out:

1. **Lead with the zero.** Post #3 opens with "189 payments, 0 customers". The
   instinct is to lead with 189. Everything this project has learned says the
   opposite lands better, and the Show HN comment is written the same way —
   limitations first. If that reads badly to a reviewer, better to find out
   before posting than after.

2. **Pick one channel and stay in it all day**, rather than posting to four and
   answering none properly. The distribution playbook says answer every reply
   within ~2 hours; that is only possible on one channel at a time. My
   recommendation is **Hacker News first, alone**, because it is the audience
   most likely to engage with the security findings, which are the strongest
   thing we have.

3. **Instrument before posting, not after.** Already done this week — but it was
   nearly not. The visit beacon and the daily metrics endpoint went live in W6,
   which by luck is before any launch. Posting first and instrumenting after
   would have thrown away the only run of first-touch attribution we get.

### Success criteria for the organic run

Applying Gate 1 as written:

> **Gate 1 — Organic signal.** An asset earns 3+ substantive replies, 5+ signups,
> 3+ checkout starts, or 1 purchase.

For this project, "1 purchase" has a literal reading available to us that the
playbook did not anticipate: **one settlement from a wallet we do not own**. That
is Week 7's Milestone 4, it is measured automatically at `/api/payers`, and it
cannot be faked because own-wallets are excluded in code rather than by eye.

So: **Gate 1 is met if any of** 3+ substantive replies · 5+ email signups · 1
external wallet settling a payment.

If Gate 1 is met, propose the paid micro-test then, with real score maths behind
it. If it is not, the honest conclusion is that this audience does not want this
yet — which is a result worth having and considerably cheaper than $25/day to
learn the same thing.

---

## What I need from the manager

Only one of these, whichever is easier:

1. **The five book posts and verified checkout links**, so channel #1 runs as
   originally specified; or
2. **Approval to run channel #1 with the PoC's own assets instead** — which are
   written, reviewed-ready, and cost nothing.

Option 2 requires no new writing from anyone and can start the day it is
approved.
