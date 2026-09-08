# Week 9 Report — Demo Day, handoff & decision

**Date:** 2026-09-08 · **Deployed:** `a39edbbc-e0ae-4c77-9dd2-bc62bf5fd3ef` · **Tagged:** `v1.0.0`
**Evidence:** `docs/week9/BUILD-LOG.md`

The last week. Everything that could be written was written; everything that
needed another person was not done, and is listed rather than rounded up.

---

## Definition of done

| Task | DoD | Status |
|---|---|---|
| Demo Day prep | 12–15 slide deck, rehearsed twice, recorded fallback | **PARTIAL** — 14 slides written; not rehearsed, no fallback recorded |
| DEMO DAY (Thu) | Present; decision follows | **NOT HELD** — manager unavailable |
| Handoff pack | Manager can run everything without me | **PASS** — every runbook executed on the day it was written |
| Keep-the-lights-on calendar | 4 weeks queued with ready-to-send drafts | **PASS** — no action needs new writing |
| Joint retro + months 3–6 proposal | Written proposal with targets | **PROPOSAL DELIVERED** — retro not held |
| Buffer — carryover + clean-exit | Nothing half-open | **PASS as a list** — 10 open threads, each with its blocker named |

Four of six needed a second person. That is the shape of the whole programme's
last three weeks, and the reports have said so each time.

---

## 1 · The handoff is the real deliverable this week

The DoD is *"the manager can run everything without me"*, which is testable, so I
tested it: **every runbook in `HANDOFF.md` was executed on the day it was
written**, and the output pasted is what it printed.

That included writing one thing that did not exist: `scripts/backup-kv.mjs`. The
receipt log and the subscriber list live in a single KV namespace with **nothing
backing them up**. Discovering that while writing a handoff is a good outcome;
discovering it after a namespace is deleted is not.

Building it turned up two things worth having:

- **`npx.cmd` cannot be `execFile`d on Windows** — `EINVAL`. Going through a
  shell fixes it and means every argument is interpolated, so KV key names are
  now validated against a character set before they reach it. Our own key names,
  which is exactly the assumption that produces injection bugs.
- **Remote KV holds 3 keys**, not the dozens I expected. Idempotency keys and the
  SSE event had expired on their TTLs. Correct behaviour — they are cache, not
  records — but it would have looked alarming to whoever ran the first backup
  without knowing.

The credentials inventory has one deliberate refusal: **the buyer private key is
not transferred.** It is a throwaway testnet key that has never held value, and
generating a new wallet takes thirty seconds. Moving keys by message is a habit
worth not having, even when the key is worthless.

---

## 2 · Demo Day deck — written, and honest about slide 7

Fourteen slides: use-case, four live slides, funnel numbers, impact, what broke,
ecosystem readiness, months 3–6, the ask.

**Slide 7 is the funnel table and it reads zero.** 189 settlements, 1 wallet, 0
external payers, 0 signups, 0 backlinks. The delivery note says to state the
number plainly and move on, because defending it makes it worse.

**Slide 11 is the one I would keep** if the talk were cut to five minutes: the
regression suite catching the Week 3 header bug by accident, ninety seconds after
a crashed script reintroduced it, when the same defect had survived a week of
manual testing.

**Not rehearsed, no fallback video.** The DoD asks for two rehearsals and a
recording. Both are an hour and neither happened. In `OPEN-ITEMS`.

---

## 3 · Distribution calendar — four weeks, nothing new to write

Week 1 is one channel done properly, because answering every reply within two
hours is impossible across four. Week 2 widens only if Gate 1 was met. Week 3 is
the tutorial and outreach. Week 4 is CFPs and the keep/kill decision.

Two rules I would defend:

- **The tutorial does not publish before its clean-machine run.** A
  "copy-paste runnable" tutorial that was never run from an empty directory is
  the one failure that costs credibility rather than traffic.
- **Post #3's numbers get re-measured**, not adjusted. Publishing week-8 figures
  with a week-11 date would be the same overclaiming this project spent nine
  weeks catching in itself.

The week-4 decision has three outcomes and the third — *"this audience does not
want this yet"* — is written as a legitimate result, not a failure to report
around.

---

## 4 · Months 3–6 — one pick, argued

**Own the agentic-payments research vertical**: the board, the briefings, the PoC
as evidence.

The argument is that it is the only option where nine weeks of building is a moat
rather than a head start. The board's lowest-scoring row is justified by three
defects from this repo — nobody writing that board from press releases can
produce them.

Turned down explicitly: the soft.house starter kit (differentiation is writing
quality, which copies) and the growth loop (a machine whose input I do not
control — the position I have been in for seven weeks).

Targets include two measured by infrastructure that excludes our own wallets, on
purpose: they are the ones I cannot flatter. **No revenue target**, because I
control neither pricing nor the publish decision, and a target I cannot influence
is a number to explain away.

The proposal ends with the case against me — nine weeks with zero external
readers, and the test suite built last. Both are on the record.

---

## 5 · Clean exit

Ten open threads, each with its blocker named. Nothing waiting on work I could
have done, except the two Week 9 items that ran out of week.

One decision flagged rather than defaulted: **if the programme ends and nobody
will send the readiness notes, the subscriber list should be deleted rather than
archived.** Zero subscribers today, so it is theoretical — and it stops being
theoretical the moment anything is published. Keeping a consented list nobody
honours is worse than never collecting it.

---

## The programme in one table

| Week | Built | External humans reached |
|---|---|---:|
| 2 | First settlement on Base Sepolia | 0 |
| 3 | DeviceTwin, x402 gate, replay protection, demo page, buyer agent | 0 |
| 4 | Seller-side mandate verification (401/403), research board | 0 |
| 5 | Second product, shared gate, email capture | 0 |
| 6 | Funnel instrumentation, launch copy | 0 |
| 7 | External-payer accounting, quickstart, real-value memo | 0 |
| 8 | Negotiation, seller-bound mandates, 26-test suite, v1.0.0 | 0 |
| 9 | Handoff, calendar, deck, role proposal | 0 |

**The right-hand column is the finding.** Everything on the left works and is
reproducible from a clean clone. The column on the right never moved, and it is
the column the programme was measured on.

Two causes, and I would not let either stand alone: an input requested in Week 2
that never arrived and a decision open since Week 4 — and my own choice to report
that weekly instead of escalating it once, hard, in Week 3, while I kept building
because building is what I am comfortable doing.

---

## What is true at the end

- Every claim in the README reproduces from a clean clone.
- Four defects that reached production are documented with their failing output,
  in the versions where they were fixed.
- 26 tests, mutation-verified against those four defects.
- The metric that would flatter us is computed in code that excludes our own
  wallets. It reads **0**.
- 27 open items in one list, each with what "done" looks like.
- No secret in the repository or its history — 38 history matches, all
  transaction hashes.
- Nothing is marked complete that was not observed working.
