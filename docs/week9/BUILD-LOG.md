# Week 9 Build Log — `x402-iot-poc`

> Append only. Executed 2026-09-08.

**Deployed:** `a39edbbc-e0ae-4c77-9dd2-bc62bf5fd3ef` · **Tagged:** `v1.0.0`

---

## Audit summary

- **Checks run:** 11
- **PASS:** 11
- **Built this week:** one script that did not exist and should have (Block 2)

Week 9 is handover, so most of it is writing. This log covers the one piece of
code and the verification of every runbook claim.

---

## Block 1 — Every runbook command actually executed

A handoff document full of untested commands is not a handoff. Each command in
`docs/week9/HANDOFF.md` was run before it was written down.

### Deploy chain

```powershell
npx tsc --noEmit     # exit 0
npx vitest run       # 26 passed (26)
npx wrangler deploy  # a39edbbc-e0ae-4c77-9dd2-bc62bf5fd3ef
```

### Smoke test

```text
GET /api/readings                      402
GET /api/inference                     402
GET /reading                           402
GET /.well-known/agent-card.json       200, 2 skills
GET /api/payers                        200, milestone_w7_met: false
GET /api/negotiate?resource=readings&offer=0.001    accepted
GET /api/negotiate?resource=inference&offer=0.001   declined, counter 0.002
```

**PASS** — `402` on all three paid routes is the healthy answer.

### KV inspection

```powershell
npx wrangler kv namespace list
[ { "id": "4ef9455bb906422f984e2eab491236c9", "title": "IOT_KV", "supports_url_encoding": true } ]

npx wrangler kv key list --namespace-id 4ef9455bb906422f984e2eab491236c9 --remote
total keys: 3
Counter({'visits': 2, 'receipt_log': 1})
```

**Finding, recorded so the next person is not alarmed:** only three keys remain
remotely. Idempotency keys (24 h TTL) and the SSE event (1 h TTL) have expired
since the last settlements on 2026-09-06. Correct behaviour — they are cache, not
records — but a first backup showing three keys looks like data loss if you do
not know that.

### Secret state

```powershell
npx wrangler secret list
[ { "name": "EXPORT_TOKEN", "type": "secret_text" } ]
```

**PASS** — configured. A `200` with the correct token is still not claimed
anywhere: the token was never shared with this session, which is the arrangement
that makes it a secret.

---

## Block 2 — The backup that did not exist

**The gap.** The receipt log is the only record of settlements we hold outside
the chain, and the subscriber list is the only copy of the email list. Both live
in one KV namespace, and **nothing backed either of them up**. Writing the
handoff runbook is what surfaced it.

**Built:** `scripts/backup-kv.mjs` — lists every key, reads each value, writes a
timestamped JSON dump. `backups/` added to `.gitignore`, because the dump
contains subscriber email addresses and is therefore the list itself.

### FAIL → FIXED: `npx.cmd` cannot be execFile'd on Windows

**INITIAL FAIL.**

```text
Listing keys in 4ef9455bb906422f984e2eab491236c9…
Error: spawnSync npx.cmd EINVAL
    at wrangler (file:///C:/Users/akifk/x402-iot-poc/scripts/backup-kv.mjs:29:10)
```

Node will not `execFileSync` a `.cmd` directly. The fix is `shell: true` — which
means every argument is concatenated into a command line rather than passed
safely.

**FIX, and the part worth keeping:** KV key names are now validated against
`/^[A-Za-z0-9:_\-.]{1,512}$/` before they reach the shell, and a name outside
that set is skipped and counted rather than executed.

The keys are ours. "Our own data is safe to interpolate" is precisely the
assumption that produces injection bugs, and this project has already shipped
four defects that each rested on an assumption that looked reasonable.

**FIXED — evidence:**

```text
Listing keys in 4ef9455bb906422f984e2eab491236c9…
3 keys.

Wrote C:\Users\akifk\x402-iot-poc\backups\kv-2026-09-08.json
  keys: 3, unreadable: 0
```

Backup verified by reading it back:

```text
file: backups\kv-2026-09-08.json | keys: 3 | unreadable: 0
names: ['receipt_log', 'visits:2026-09-06:github:evergreen', 'visits:2026-09-06:hn:w6-launch']
receipt_log entries: 100
```

**PASS** — 100 settlement receipts preserved off the platform for the first time.

The script also tolerates a key expiring between the list and the read: it
records the gap and continues, rather than aborting a backup that is otherwise
complete.

---

## Block 3 — Secrets hygiene, final check

```powershell
git log -p --all | Select-String -Pattern '0x[a-fA-F0-9]{64}'
# 38 matches, every one an on-chain transaction hash

git log --all --name-only --format="" | Select-String -Pattern '^\.env$'
# (no output)
```

**PASS** — no private key in the repository or its history; `.env` never tracked.

---

## Block 4 — Written deliverables

| Deliverable | File | State |
|---|---|---|
| Demo Day deck, 14 slides | `docs/week9/DEMO-DAY-DECK.md` | written; **not rehearsed, no fallback video** |
| Handoff pack | `docs/week9/HANDOFF.md` | every runbook executed |
| Distribution calendar, 4 weeks | `docs/week9/DISTRIBUTION-CALENDAR.md` | no action needs new writing |
| Months 3–6 role proposal | `docs/week9/ROLE-PROPOSAL.md` | one pick, argued |
| Clean-exit checklist | `docs/week9/CLEAN-EXIT-CHECKLIST.md` | 10 open threads, blockers named |

---

## Final state

```text
tests            26 passed
mutations caught 4 / 4
typecheck        clean
deployed         a39edbbc-e0ae-4c77-9dd2-bc62bf5fd3ef
tag              v1.0.0
settlements      189   volume $0.191 testnet
external payers  0
subscribers      0
open items       27
KV backup        backups/kv-2026-09-08.json — 3 keys, 100 receipts
```
