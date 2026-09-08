# Clean-exit checklist

**W9 OPS** · DoD: nothing half-open; credentials transferred or archived per the
decision.
**Date:** 2026-09-08

Both outcomes are professional. This checklist is written so that the quality of
the exit does not depend on which one it is.

---

## Everything half-open, and its state

| # | Item | State | Blocked on |
|---|---|---|---|
| 1 | Ten publishable assets | written, unpublished | publish decision |
| 2 | Research board | drafted, not loaded | manager loads it |
| 3 | Real-value memo | delivered | counsel review |
| 4 | Six human-dependent tests | not run | one hour of a person |
| 5 | Six correctness items (A1–A6) | open | engineering time |
| 6 | Channel #1 | never went live | five book posts, requested W2 |
| 7 | B2B outreach | 0 sent | target list + sign-off |
| 8 | Demo Day deck | written, not rehearsed; no fallback video | an hour |
| 9 | CFP submissions | drafted, targets unselected | live deadlines + sign-off |
| 10 | Tutorial | complete, not clean-machine tested | an afternoon |

**Nothing on this list is waiting on work I could have done and did not**, with
one exception: items 5 and 8 are mine and are open because the week ran out. They
are in `docs/OPEN-ITEMS.md` with what "done" looks like.

---

## If the programme continues

- [ ] Publish decision made; `DISTRIBUTION-CALENDAR.md` week 1 starts the
      following Monday
- [ ] `EXPORT_TOKEN` rotated if anyone new gains access
- [ ] Weekly KV backup added to somebody's calendar —
      `node scripts/backup-kv.mjs`
- [ ] Buyer wallet kept funded from the faucet, or the demo goes quiet
- [ ] A1–A6 scheduled before any real-value conversation
- [ ] The six human tests run as one batch —
      `docs/PENDING-HUMAN-TESTS.md`
- [ ] Counsel review commissioned from `REAL-VALUE-READINESS.md` §5

## If the programme ends

- [ ] **Repo stays public and MIT.** It is the deliverable, and it is more useful
      to the ecosystem than to anyone's balance sheet
- [ ] Final KV backup taken and handed over — **contains subscriber emails**
- [ ] `EXPORT_TOKEN` rotated by whoever keeps the Worker, or the Worker deleted
- [ ] Subscriber list handed over as CSV, or deleted if nobody will honour the
      consent it was collected under
- [ ] Buyer `.env` deleted locally. **The private key is not transferred** — a
      new wallet is thirty seconds and moving keys by message is a habit worth
      not having
- [ ] Cloudflare account either transferred or the Worker deleted, deliberately,
      not left orphaned
- [ ] `HANDOFF.md` walked through with whoever inherits it, live, once

### The subscriber list deserves a decision, not a default

Zero subscribers today, so this is currently theoretical — and it will not stay
theoretical if the assets are published.

Those addresses were collected under an explicit consent checkbox promising
machine-payments readiness notes and an unsubscribe. If nobody is going to send
those notes, **the list should be deleted rather than archived.** Keeping a
consented list that nobody honours is worse than not having collected it.

---

## What I would want the last commit to say

The repository ends in a state where:

- every claim in the README can be reproduced from a clean clone;
- the four defects that reached production are documented with their failing
  output, in the versions where they were fixed;
- the one metric that would flatter us is computed in code that excludes our own
  wallets, and reads zero;
- every gap is in one list with what "done" looks like;
- and nothing is marked complete that has not been observed working.

That is not a finished product. It is an honest one, which for a nine-week
proof-of-concept is the more useful thing to hand over.

---

## Final state, verified 2026-09-08

```text
repo            github.com/Soresta/x402-iot-poc — public, MIT, v1.0.0
worker          https://x402-iot-poc.akifk-x402-26.workers.dev — live
deployed        a39edbbc-e0ae-4c77-9dd2-bc62bf5fd3ef
tests           26 passed, 4/4 mutations caught
typecheck       clean
secrets in repo none — 38 history matches, all transaction hashes
KV backup       backups/kv-2026-09-08.json, 3 keys, 0 unreadable
settlements     189, volume $0.191 testnet
external payers 0
open items      27, tracked
```
