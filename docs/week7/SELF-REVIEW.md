# Mid-programme self-review

**W7 OPS** · *"What would you change about your own plan?"*
**Date:** 2026-09-08 · Weeks 1–7 of 9

The brief says this is a strength signal, not a confession. I have tried to write
it as neither — just the things I would do differently if I started again on
Monday, with the reasoning that produced them.

---

## 1. I built the test suite last instead of first

Four bugs in five weeks. Every one of them shipped, ran in production, and looked
correct:

| Bug | What it looked like | What it was |
|---|---|---|
| Wrong payment header | Payments settling perfectly | Replay protection and rate limiting never ran, for a week |
| Buyer-side mandate | Every mandate test passing | An honour system a compromised agent walks through |
| Mandate as bearer token | Valid signature, valid expiry | Usable by anyone with a request log |
| Classifier label | Status 200, well-formed JSON | The least likely class, every time |

None of them threw. None of them appeared in a log. The tests I had passed
throughout — one of them passed for the *wrong reason*, which is worse than
failing, because it bought false confidence.

The automated test suite is scheduled for Week 8. It should have been Week 3.
Not because tests would have caught all four — the header bug would have passed a
naive test too — but because building tests forces the question *"how would I
know if this were not running?"*, and I never asked it until something made me.

**The rule I would take forward:** assert that each control *fires*, not that the
request succeeds. Those are different assertions and I was only ever writing the
second.

## 2. I trusted an inherited report instead of the code

I took over a repository whose Week 3 report was marked complete, with a build
log summarising "14 PASS / 0 FAIL". Re-running the payment path from scratch
found two real defects in code carrying passing marks — and four test scripts
that the report cited as evidence but which had never existed in the repository
or in its git history.

I did re-verify, and that was right. What I would change is the framing I started
with: I initially treated the inherited PASS marks as a baseline to confirm
rather than as claims to test. The difference sounds academic and is not — it is
the difference between looking for problems and looking for reassurance.

**Forward:** an inherited green check is a hypothesis, not a starting position.

## 3. I under-weighted the blocked lane for too long

The REV lane has been blocked since Week 2 on one missing input — five book
posts with verified checkout links. I noted it each week and kept building.

The plan's own instruction is explicit: *"If a week slips: the REV lane survives
first... Say it Monday, not Friday."* I said it in weekly reports, which is
Friday. I should have escalated it as a standalone blocker in Week 3, once, hard,
rather than carrying it as a line item for five weeks.

The cost compounds: no channel → no interest scores → no Gate 3 evidence → no
basis for the Week 7 paid-test decision → and the Week 8 impact memo now has
almost nothing to measure. One missing input in Week 2 has hollowed out four
later deliverables.

**Forward:** a dependency that blocks a whole lane gets escalated on its own, on
the day it blocks, not summarised in a weekly report alongside things that went
well.

## 4. I have been building for a reviewer, not a stranger

Two DoDs have been open for four weeks: the README stranger test and the
30-second demo comprehension test. Both need one person and fifteen minutes.
Neither has happened, and I let both slide because they are not code.

That is backwards. Both tests exist precisely because *I* cannot evaluate them —
I know what the thing does, so I cannot see what is missing from the explanation.
Every week I spent improving the README without watching someone use it was a
week of guessing.

**Forward:** the tests I cannot run myself should be scheduled first, because
they have a dependency on a human's calendar. Code has a dependency on my time,
which I control.

## 5. What I would keep

Three things I would do the same way:

**Recording failures as failures.** The build logs carry FAIL → FIXED entries
with the failing output pasted in. It is uncomfortable in the moment and it is
the reason the Week 4 hardening pass could be trusted — the gap it closed was one
the Week 3 report had already named as a limitation, rather than one discovered
by an outsider.

**Refusing to fabricate.** The external payer count is computed by excluding
configured own-wallets in code, not filtered by eye afterwards. It reads zero. It
would have been trivially easy to fund a second wallet, call it adoption, and
report a 1. Every metric in this project can be traced to the thing that produced
it, and I would rather defend a zero than explain a one.

**Refactoring before duplicating.** Adding the second product started by moving
ninety lines of payment logic into a shared middleware. Copying it would have
been faster that afternoon and would have created exactly the failure mode this
project has already hit twice — a control present on one path, silently absent on
another.

## 6. The plan change I would actually make

If I could rewrite the nine-week plan with what I know now, one structural
change:

**Move the stranger test and the first publication into Week 3, before the second
resource and before the funnel.**

The technical work has compounded well — each week's code made the next week's
cheaper. The distribution work has compounded not at all, because it never
started. At Week 7 I have two products, five error layers, instrumentation, an
email list mechanism and a research board, and **zero external humans and zero
external agents** have touched any of it.

The order was wrong. Building more into an unvalidated funnel is the expensive
mistake, and I made it for four weeks while marking the deliverables complete —
correctly, because they were complete. Complete and useful are not the same
thing, and the plan measured the first.

---

## In one line

I built the thing well and showed it to nobody, and the parts of that I control
are: escalating the blocker harder, scheduling the human-dependent tests first,
and writing tests that prove controls fire rather than that requests succeed.
