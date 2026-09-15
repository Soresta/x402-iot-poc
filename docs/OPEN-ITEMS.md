# Open items — what is left

**Last updated: 2026-09-15.** This file lists only what is still open, and ends with
a one-page done / not-done summary for the manager.

Closed items are no longer listed here: A1–A10, B1–B5, C1–C4, D1–D7, E3 and 41 of
the 56 programme tasks. Each is recorded with its evidence in
[`VERIFICATION.md`](./VERIFICATION.md) (what was checked and the result) and
[`../CHANGELOG.md`](../CHANGELOG.md) (what was fixed, when). The full list as it
stood with every closed item and its write-up is kept at release **v1.2.0**:
[docs/OPEN-ITEMS.md @ v1.2.0](https://github.com/Soresta/x402-iot-poc/blob/v1.2.0/docs/OPEN-ITEMS.md).

Item IDs are unchanged, so older documents that cite them still resolve.

---

## 1 · Still open

### Mine: work only I can do

| # | Item | State | Done when |
|---|---|---|---|
| 🔴 B7 | **Demo Day deck rehearsed twice** | The slide file is ready: [`week9/demo-day-deck.pptx`](./week9/demo-day-deck.pptx), 15 slides with speaker notes. Not rehearsed yet | Two timed run-throughs, with the live demo on slides 3–6 actually run |
| 🔴 B8 | **90-second fallback demo video** | Script and shot list ready: [`content/demo-video-script.md`](./content/demo-video-script.md). Not recorded | A video file sent to the manager for review |

### Waiting on the manager

| # | Item | Blocks | Open since |
|---|---|---|---|
| 🔴 E1 | **Publish decision.** Ten assets written, none posted | Channel #1, publish wave #1, the launch, the tutorial going live, cross-links, and every GTM/REV metric, which is zero by construction | W4 |
| 🔴 E2 | **Channel #1 inputs**: five book posts with verified checkout links | Channel #1 posts and follow-through | W2 |
| 🔴 E4 | **Research board loading** onto pragma.vision (manager action) | The board going live | W4 |
| 🔴 E5 | **Counsel review** of the real-value readiness memo | Any real-value decision | W7 |
| 🔴 E6 | **Analytics and sales access** | The KPI rows this project cannot measure itself | W4 |
| 🔴 B6 | **Accept the 24 h run as partial, or not.** 1 h continuous, plus 8 h 50 m wall clock (≈ 2 h 37 m buying) on 2026-09-11; the cap was never exceeded. Decision 2026-09-14: not re-run, reported with real numbers. [Write-up](./soak-runs/SOAK-2026-09-11.md) | W3 buyer DoD | W3 |
| 🔴 — | **Outreach sign-off**: target list and messages | B2B waves #1 and #2, briefings, CFP and podcast submissions, first paid engagement | W6 |
| 🔴 — | **Sign-offs on delivered work**: IoT one-pager, baselines, audience map, posts #1–#3, funnel map, readiness memo walkthrough, channel #2 proposal, role proposal | The ⚑ gates on those tasks | W1–W9 |
| 🔴 — | **Demo Day** and the decision that follows | Milestone 5 | W9 |

### Not done, and nothing blocking it

| # | Item | Note |
|---|---|---|
| 🔴 — | **W1 distribution scouting notes** (Gate 0) | No written record in the repo or the internship folder. Deprioritised |

---

## 2 · Remaining programme tasks, by week

These are the 15 boxes still empty in the ticked handbook
(`machine-payments-revenue-sprint-INTERN-status-2026-09-14.html`).

| Week | Task | Why it is open |
|---|---|---|
| W1 | Distribution scouting | No record (see above) |
| W2 | Channel #1 goes live | E2, E1 |
| W3 | Buyer: 24 h unattended run | B6, partial |
| W3 | Channel #1 follow-through | No channel live |
| W4 | Publish wave #1 ⚑ | E1 |
| W4 | Channel #1 maintenance | No channel live |
| W5 | 90-second demo video ⚑ | B8 |
| W6 | Coordinated launch | E1 |
| W6 | Tutorial live + cross-link triangle ⚑ | E1 (tutorial itself passed its clean run) |
| W6 | B2B outreach wave #1 ⚑ | Outreach sign-off |
| W7 | B2B wave #2 + follow-ups | Outreach sign-off (the 10-slide deck is ready) |
| W8 | CFPs + podcast pitch submitted | Outreach sign-off (drafts ready) |
| W8 | B2B follow-ups → first paid engagement ⚑ | No leads to follow up |
| W9 | Demo Day prep | B7, B8 (deck ready) |
| W9 | Demo Day ⚑ | Manager |

---

## 3 · Summary for the manager — done ✅ / not done ❌

**Programme tasks: 41 of 56 done, 261 of 360 hours (73 %).** Most of what is not
done waits on a decision or a meeting, not on work.

### ✅ Done

**The proof of concept**, live on testnet, release v1.2.0
- A seller that sells sensor readings and AI inferences through HTTP 402, and an autonomous buyer that pays for them on Base Sepolia
- Signed Agent Card, spending mandates checked by both sides, replay protection, rate limiting that holds under load, price negotiation, fail-closed errors
- Live demo page with a live settlement feed and a "who is paying" panel

**Quality**
- 81 automated tests; 11 of 11 known bugs are caught when put back into the code
- 20 defects found and documented, each with the output that exposed it; all fixed or withdrawn
- A secrets scan of the full git history: no private keys

**Weekly rhythm**
- Friday demos #1–#8 and the midpoint review, held as online meetings with a weekly report each week, and the manager reviewing the repo

**Tested by real people**
- A first-time user set everything up from the README in 14 minutes, and paid from their own wallet through the quickstart in about 15. The 4 documentation problems they hit were fixed the same day
- A 30-second test with someone who had never seen the demo page: they understood it. The one thing they missed is now stated at the top of the page
- The tutorial was run on a separate computer: about 40 minutes, no problems
- Clean shutdown and a block-explorer check, with screenshots
- The first payment from a wallet that is not ours. It came from that recruited tester, so it is not a customer

**Deliverables**
- W1: questions, friction audit, baselines, landscape note
- W2: IoT one-pager, first 402 payment, audience map, post #1 draft
- W3–W5: post #2 draft, research board (checked against primary sources), flagship tutorial, funnel map, email capture with the first export
- W6–W7: funnel instrumentation, demo fixes, real-value readiness memo, post #3 draft, channel #2 decision, self-review
- W8: Revenue Impact Memo, funnel fixes, v1.0.0 and later releases
- W9: handoff pack, 4-week distribution calendar, months 3–6 role proposal, clean-exit checklist, **Demo Day deck (15 slides)**

### ❌ Not done

**Waiting on your decision or presence**
- Publish decision: posts, launch, channel #1, tutorial going live
- Outreach sign-off: B2B messages, briefings, CFP submissions, first paid engagement
- Loading the research board, counsel review, analytics access
- Sign-offs on the delivered drafts and memos
- Demo Day
- Whether the 24 h run, which reached 8 h 50 m, is accepted as partial

**Still mine to do**
- Rehearse the Demo Day deck twice
- Record the 90-second fallback video

**Not achieved**
- An organic external payer: 0, because nothing has been published
- W1 distribution scouting notes: not recorded
