# Week 7 Build Log — `x402-iot-poc`

> Append only. Executed 2026-09-08 against local `wrangler dev` and the deployed
> Worker.

**Deployed version this week:** `fa271a80-8f79-434f-811a-314ac593ccce`
**Public Worker:** `https://x402-iot-poc.akifk-x402-26.workers.dev`

---

## Audit summary

- **Checks run:** 8
- **PASS:** 8
- **Milestone 4 (≥1 external agent settles):** **NOT ACHIEVED** — 0 external
  payers, and the number is computed rather than asserted

---

## Block 1 — Counting external adoption honestly

**The problem with the milestone.** Week 7's DoD is "≥1 external agent settles a
testnet payment", and the KPI definition in the baseline sheet is "payments
settled via non-owned wallets". Every settlement this project has ever taken came
from a wallet we control. If the external-payer count is produced by looking at
the receipt log and mentally discounting our own address, it will be wrong the
first time someone is in a hurry.

**What was built.** `src/payers.ts` and an `OWN_WALLETS` config var listing the
addresses we control. A payer is external **only** if it is not on that list, and
the exclusion happens in the code that reports the figure.

```jsonc
"OWN_WALLETS": "0x936F147d5489Fa2236827bd5bc98C6b104718945,0x219ba53AC52D99668a5c20737D1dEd60f435d99E"
```

This deliberately makes the headline number harder to move. A second wallet we
fund ourselves is a useful smoke test of the quickstart; adding it to
`OWN_WALLETS` is what stops it becoming "adoption".

### Test — `/api/payers`

```powershell
curl.exe -sS http://127.0.0.1:8787/api/payers
```

```json
{
  "external_payers": 0,
  "own_payers": 1,
  "milestone_w7_met": false,
  "payers": [
    {
      "address": "0x936f…8945",
      "settlements": 100,
      "volume_usdc": 0.105,
      "last_seen": "2026-09-06T09:45:56.175Z",
      "external": false
    }
  ],
  "note": "A payer is external only if it is not in OWN_WALLETS. Wallets we fund ourselves are a smoke test, not adoption.",
  "caveat": "Based on the last 100 receipts held in KV, not the full chain history."
}
```

**PASS** — `milestone_w7_met: false` is emitted by the endpoint itself. The
milestone cannot be claimed in a report without contradicting the API.

### Test — daily metrics splits payers

`/api/metrics/daily` now reports `distinct_external_payers` alongside
`distinct_payers`, with a fourth caveat added to the response:

```text
"distinct_external_payers excludes every address listed in OWN_WALLETS."
```

Remote check:

```text
date: 2026-09-08
distinct_payers: 0 | external: 0
caveats: 4
```

**PASS**

### Test — the demo page says who is paying

New **Who is paying** panel, rendered in a real browser:

```json
{
  "summary": "no external payers yet",
  "rows": ["0x936f…8945 OURS 100 $0.105"]
}
```

**PASS** — the page states plainly that the only wallet paying is ours. A visitor
cannot mistake the demo buying from itself for traction.

Addresses are truncated. They are already public on-chain, so nothing is
concealed, but a page rendering full wallet addresses in a table invites being
read as a directory of them.

### Non-issue, recorded so it is not re-investigated

`curl … | python -m json.tool` rendered the address as `0x936fâ€¦8945`. The
response bytes are correct UTF-8 (`\xe2\x80\xa6` for `…`); the mojibake was the
console pipe decoding as cp1252. Verified by reading raw bytes and by rendering
in a browser, where it displays correctly.

---

## Block 2 — Quickstart

`QUICKSTART.md` — "pay this API in 5 minutes". Faucet → clone → one command →
settlement, with the four errors a newcomer will actually hit
(`ECONNREFUSED`, unfunded wallet, `429`, `403 mandate_scope_exceeded`) and what
each one means.

It states up front that taking longer than five minutes is a bug in the page and
asks for an issue saying where they stalled — the stall point is more valuable to
us than the payment.

Linked from the top of the README.

**PASS as an artefact. Untested on a stranger** — that is the same open item as
the Week 4 README stranger test.

---

## Block 3 — Regression and deploy

```text
unpaid /api/readings          402
unpaid /api/inference         402
legacy /reading               402
agent card                    200, 2 skills
/api/payers                   200
/api/metrics/daily            200
npx tsc --noEmit              exit 0
deploy                        fa271a80-8f79-434f-811a-314ac593ccce
```

**PASS**

---

## Cumulative project numbers

Measured this session for Post #3, from the buyer's ledger and the receipt log:

```text
total purchases:  189
total volume:     $0.191
days active:      5   (2026-08-08 .. 2026-09-06)
by skill:         { "(pre-w5)": 184, "sell-iot-reading": 3, "sell-inference": 2 }
refusals logged:  20
external payers:  0
```

The 184 "(pre-w5)" entries predate the buyer recording which skill it bought;
they are all readings. Left unlabelled rather than backfilled — the ledger is an
append-only record of what was written at the time.

---

## What is not in this log

Week 7's other tasks are outreach, a memo, a deck, a post and a self-review. None
of them are code and none produce test output. They are in:

| Deliverable | File |
|---|---|
| Real-value readiness memo | `docs/memos/REAL-VALUE-READINESS.md` |
| 10-slide readiness deck | `docs/content/readiness-deck.md` |
| Post #3 — the numbers post | `docs/content/post-3-the-numbers.md` |
| Channel #2 decision | `docs/week7/CHANNEL-2-DECISION.md` |
| Mid-programme self-review | `docs/week7/SELF-REVIEW.md` |

B2B wave #2 was not sent, for the same reason wave #1 was not: the message
template requires a hook written after reading the recipient's own work, and
assembling a list of named individuals from an agent session is the activity the
"public business information only" rule exists to prevent.
