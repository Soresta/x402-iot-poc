# Keep-the-lights-on distribution calendar

**W9 REV** · DoD: next 4 weeks of distribution actions queued with ready-to-send
drafts — momentum survives the decision window either way.
**Date:** 2026-09-08

Everything below is written and waiting. **No action here needs new writing** —
only a decision and someone to press publish.

The sequencing assumes week 1 starts on the Monday after the publish decision. If
that decision lands later, the calendar shifts; it does not shrink.

---

## Why this exists

Whatever the contract decision is, the assets are written and the funnel is
instrumented. If they go out, the project keeps moving without me. If they do
not, nothing has been lost except the time already spent — but the honest version
is that a nine-week build with zero external readers ends where it started.

This calendar is the cheapest possible way to find out whether anyone wants it.

---

## Week 1 — one channel, done properly

The distribution playbook says answer every reply within ~2 hours. That is only
possible on one channel at a time, so week 1 is one channel.

| Day | Action | Asset | Owner |
|---|---|---|---|
| Tue AM (US) | **Show HN** + first comment immediately | `launch-week.md` §1 | whoever holds the account |
| Tue all day | Answer every comment. Thank critics. Fix and say "fixed, thanks" | — | same |
| Wed | dev.to post #2 (architecture) + X thread #2 | `post-2-architecture.md`, `publish-wave-1.md` | — |
| Thu | Log interest scores at 48 h | `launch-week.md` §4 | — |
| Fri | Pull `/api/metrics/daily`, record the week's row | §Metrics below | — |

**Pre-flight, every time:** demo live, links UTM-tagged and clicked once,
`/api/metrics/daily` returning sane numbers before traffic arrives.

**Gate 1 check at the end of week 1:** 3+ substantive replies, **or** 5+ email
signups, **or** 1 settlement from a wallet we do not own. Any one of the three.

---

## Week 2 — widen, only if week 1 earned it

| Day | Action | Asset |
|---|---|---|
| Tue | r/webdev — the traffic-problem angle, rewritten for that community | `launch-week.md` §2 |
| Wed | dev.to post #1 (build in public) + X thread #1 | `post-1-build-in-public.md` |
| Thu | r/selfhosted — the free-tier angle, rewritten again | `launch-week.md` §2 |
| Fri | Ecosystem directory + awesome-list PRs — first real backlinks | `publish-wave-1.md` §3 |
| Fri | Metrics row + interest scores |  |

**Never cross-post verbatim.** Each subreddit's rules get read that day, in full.

**If Gate 1 was not met in week 1:** do not widen. Post #1 goes out anyway (it is
the softest asset), and week 2 becomes a diagnosis week — read the Show HN thread
for what people actually asked, and fix the demo page accordingly using
`docs/memos/FUNNEL-FIXES.md`.

---

## Week 3 — the tutorial and the outreach wave

| Day | Action | Asset |
|---|---|---|
| Mon | Publish the flagship tutorial — **after** a clean-machine run | `tutorial-machine-customers.md` |
| Mon | Complete the cross-link triangle: demo ↔ tutorial ↔ research board | — |
| Tue–Thu | **B2B wave #1** — 15 messages, ≥70% custom, built from the rubric | `outreach-wave-1.md` |
| Thu | Post #3 (the numbers post) — re-measure the figures first | `post-3-the-numbers.md` |
| Fri | Metrics row; CRM updated same-day per message |  |

**The tutorial does not go out before its clean-machine run** (`OPEN-ITEMS` B5).
Publishing a "copy-paste runnable" tutorial that has not been run from an empty
directory is the one failure mode that costs credibility rather than traffic.

**Post #3 carries real numbers.** If they have changed by week 3 — and they
should have — re-measure. Do not publish week-8 figures with a week-11 date.

---

## Week 4 — CFPs, follow-ups, and the decision review

| Day | Action | Asset |
|---|---|---|
| Mon | Submit 3 CFP abstracts to conferences with live deadlines | `cfp-and-podcast-pitches.md` |
| Tue | Podcast pitch — after listening to an episode | same |
| Wed | Outreach follow-up #1 (max 3 touches total, then stop) | `outreach-wave-1.md` |
| Thu | Research board v2 — confirm the four secondary-source signals first | `AGENTIC-PAYMENTS-BOARD.md` |
| Fri | **Four-week review**: Gate 3 maths, keep/kill per channel | below |

---

## The metrics row — fill weekly

Pull once, after the week ends:

```powershell
curl.exe -sS "https://x402-iot-poc.akifk-x402-26.workers.dev/api/metrics/daily"
curl.exe -sS "https://x402-iot-poc.akifk-x402-26.workers.dev/api/payers"
```

| Week | Visits | Top source | Settlements | **External payers** | Subscribers | Backlinks | Briefings |
|---|---:|---|---:|---:|---:|---:|---:|
| baseline | 0 | — | 189 | **0** | 0 | 0 | 0 |
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |

Counts are a **floor** — KV has no atomic increment and its reads are eventually
consistent. Both undercount.

---

## The week-4 decision

Gate 3: `interest score ≥15 and no moderator warnings → continue; else iterate or
stop`.

```
score = 3×replies + 2×saves + 5×signups + 8×checkout starts + 20×purchases − 10×warnings
```

Three honest outcomes, and the third is a real one:

| Outcome | Read | Do |
|---|---|---|
| Score ≥15 on any channel | People want this | Propose the paid micro-test, now with real maths behind it |
| Score <15, but >0 external payers | The technical audience is small and real | Keep publishing organically; drop paid acquisition |
| Score ≈0 across four weeks | This audience does not want this yet | **Say so.** Cheaper than $25/day to learn the same thing |

**The third outcome is not a failure to report around.** A nine-week PoC that
concludes "the market is not here yet, and here is the evidence" is a useful
result — and considerably more useful than one that keeps posting into silence.

---

## If nobody picks this up

The Worker runs on a free tier and needs no maintenance to stay up. Left alone:

- the demo keeps serving and keeps refusing unpaid requests;
- the buyer stops when its ledger is not being run;
- KV keys with TTLs expire; the receipt log and subscriber list persist;
- **nothing accrues cost and nothing breaks.**

The only standing obligation is the **weekly KV backup** (`node
scripts/backup-kv.mjs`) — the receipt log and the subscriber list exist in one
place and nothing backs them up automatically.
