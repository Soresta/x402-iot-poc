# docs/ — what is where

This folder holds two kinds of document: **records of the build** (what was done,
what was checked, what is still open) and **programme deliverables** (memos,
drafts and plans produced for the Machine-Payments Revenue Sprint). The code does
not depend on anything here.

Start with **[VERIFICATION.md](./VERIFICATION.md)** for what works and
**[OPEN-ITEMS.md](./OPEN-ITEMS.md)** for what does not.

---

## 1. State of the project

| File | What it answers |
|---|---|
| [`VERIFICATION.md`](./VERIFICATION.md) | What was checked, how, and the result, row by row. Also the mutation list and every defect found |
| [`OPEN-ITEMS.md`](./OPEN-ITEMS.md) | Everything wrong, missing, unverified or blocked, each with what "done" looks like |
| [`PENDING-HUMAN-TESTS.md`](./PENDING-HUMAN-TESTS.md) | Checks a script cannot run, with exact steps and what the evidence must show |

## 2. Evidence

| Path | Contents |
|---|---|
| [`evidence/`](./evidence/) | Screenshots from human-run checks (signed card, `Ctrl+C`, Basescan, demo page), plus the Week 2 raw `402` response |
| [`soak-runs/`](./soak-runs/) | Unattended runs: raw log and a reconciled write-up per run |
| `week3/soak-run.log` | The 1-hour unattended run of 2026-08-14: 111 settlements, 98.2 % success |

## 3. Week by week

Each week has a **BUILD-LOG** (what was done, with the commands run and what they
printed) and a **WEEK-REPORT** (tasks against their definition of done). There
are no folders for Weeks 1–2. That work is recorded in `CHANGELOG.md` (0.1.0,
0.2.0) and in `evidence/week2-402-transcript.txt`.

| Week | Folder | Focus | Extra documents |
|---|---|---|---|
| 3 | [`week3/`](./week3/) | DeviceTwin, receipts, replay protection, buyer agent, demo page; the header-name defect | `soak-run.log` |
| 4 | [`week4/`](./week4/) | Midpoint "ship it": hardening pass, seller-side mandate verification (401/403) | — |
| 5 | [`week5/`](./week5/) | PoC into a funnel: second resource (inference), shared payment gate, email capture | — |
| 6 | [`week6/`](./week6/) | Launch week: funnel instrumentation, launch assets (unpublished) | — |
| 7 | [`week7/`](./week7/) | External adoption and real-value readiness: external-payer accounting, quickstart, readiness memo | `CHANNEL-2-DECISION.md`, `SELF-REVIEW.md` |
| 8 | [`week8/`](./week8/) | Consolidate: revenue-impact memo, regression suite, price negotiation, v1.0.0 | — |
| 9 | [`week9/`](./week9/) | Demo Day, handoff and decision | `HANDOFF.md` (runbooks), `DEMO-DAY-DECK.md`, `DISTRIBUTION-CALENDAR.md`, `ROLE-PROPOSAL.md`, `CLEAN-EXIT-CHECKLIST.md` |

Weekly reports are snapshots. When a later check proved one wrong, the report was
corrected in place with a dated note rather than silently rewritten. The current
state is always in `VERIFICATION.md` and `OPEN-ITEMS.md`.

## 4. Programme deliverables

| Path | Contents | Status |
|---|---|---|
| [`memos/REAL-VALUE-READINESS.md`](./memos/REAL-VALUE-READINESS.md) | What moving to real value would take; 12 questions for counsel | Delivered; counsel review not done |
| [`memos/REVENUE-IMPACT.md`](./memos/REVENUE-IMPACT.md) | KPI baseline against now, cost against value, months 3–6 targets | Delivered |
| [`memos/FUNNEL-FIXES.md`](./memos/FUNNEL-FIXES.md) | Funnel leaks and fixes | Delivered |
| [`metrics/BASELINE.md`](./metrics/BASELINE.md) | The KPI baseline the programme is measured against | Reference |
| [`research-board/AGENTIC-PAYMENTS-BOARD.md`](./research-board/AGENTIC-PAYMENTS-BOARD.md) | Readiness scores for 11 technologies, with dated, sourced signals | Drafted; not loaded |

## 5. Content drafts — none published

Everything here waits on a publish decision. Nothing has been posted.

| File | What it is |
|---|---|
| `content/post-1-build-in-public.md` | Post #1 |
| `content/post-2-architecture.md` | Post #2, architecture deep-dive |
| `content/post-3-the-numbers.md` | Post #3, the numbers post. Re-measure before publishing |
| `content/publish-wave-1.md` | Two X threads, directory submission |
| `content/launch-week.md` | Show HN with first comment, two subreddit posts |
| `content/tutorial-machine-customers.md` | Flagship tutorial |
| `content/demo-video-script.md` | 90-second video script and shot list |
| `content/readiness-deck.md` | 10-slide readiness deck |
| `content/outreach-wave-1.md` | Outreach template and targeting rubric |
| `content/cfp-and-podcast-pitches.md` | CFP abstracts, podcast pitch |
| `content/funnel-map-and-utm.md` | Funnel map and UTM naming sheet |
