# Handoff pack

**W9 OPS** · DoD: the manager can run everything without me.
**Date:** 2026-09-08 · **updated for submission 2026-09-14 (v1.1.0)**

Every command here was run on the machine this project was built on, and the
output is what it actually printed. Where something was not run, it says so.

---

## 1 · What exists, in one table

| Thing | Where | Who owns it after handover |
|---|---|---|
| Source | `github.com/Soresta/x402-iot-poc` — public, MIT, tagged `v1.1.0` | company |
| Live seller | `https://x402-iot-poc.akifk-x402-26.workers.dev` | Cloudflare account holder |
| KV namespace `IOT_KV` | id `4ef9455bb906422f984e2eab491236c9` | same |
| Durable Objects `DeviceTwin`, `RateLimiter` | same Worker | same |
| Workers AI binding | same Worker | same |
| Seller wallet (receives payment) | `0x219ba53AC52D99668a5c20737D1dEd60f435d99E` | see §5 |
| Buyer wallet (spends) | `0x936F147d5489Fa2236827bd5bc98C6b104718945` | see §5 |
| `EXPORT_TOKEN` secret | Cloudflare secret store | held by one person; see §5 |
| `AGENT_CARD_SIGNING_KEY` secret | Cloudflare secret store; public half at `/.well-known/jwks.json` | see §5 |

---

## 2 · Runbooks

### 2.1 Deploy

```powershell
cd x402-iot-poc
npm install
npx tsc --noEmit          # must exit 0
npx vitest run            # must report 0 failed — the count grows, the zero does not
npx wrangler deploy
```

Wrangler prints a `Current Version ID` on every deploy. **This document does not
record one** — a version number written here is wrong after the next deploy, and
two documents disagreeing about it is how a handover goes stale. The deployed
version history lives in the Cloudflare dashboard, and what changed between
versions lives in `CHANGELOG.md`.

**Never deploy on a red suite.** The suite exists because defect after defect reached
production while every check was green; a red one is the only warning this
project has ever had in advance.

### 2.2 Smoke test after a deploy

```powershell
curl.exe -sS -o /dev/null -w "%{http_code}`n" https://x402-iot-poc.akifk-x402-26.workers.dev/api/readings    # expect 402
curl.exe -sS -o /dev/null -w "%{http_code}`n" "https://x402-iot-poc.akifk-x402-26.workers.dev/api/inference?text=hi"  # expect 402
curl.exe -sS https://x402-iot-poc.akifk-x402-26.workers.dev/api/inference     # expect 400 inference_input_required — refused before the 402, by design
curl.exe -sS -o /dev/null -w "%{http_code}`n" https://x402-iot-poc.akifk-x402-26.workers.dev/reading         # expect 402
curl.exe -sS https://x402-iot-poc.akifk-x402-26.workers.dev/.well-known/agent-card.json                      # expect 2 skills
curl.exe -sS https://x402-iot-poc.akifk-x402-26.workers.dev/api/payers                                       # expect milestone_w7_met
curl.exe -sS https://x402-iot-poc.akifk-x402-26.workers.dev/.well-known/jwks.json                           # expect one key, not card_signing_not_configured
curl.exe -sS -N -m 4 https://x402-iot-poc.akifk-x402-26.workers.dev/api/feed/settlements                    # expect "event: connected" within a second
```

`402` is the healthy answer on all three paid routes. A `200` there means the
gate is open and is a **stop-everything** event.

For a full end-to-end check that actually spends testnet USDC:

```powershell
$env:SELLER_URL="https://x402-iot-poc.akifk-x402-26.workers.dev"
node buyer/test_replay.mjs      # 200 then 402 payment_already_used
node buyer/test_mandate.mjs     # 7/7 — wait 60s between runs, see §6
node buyer/test_ratelimit_burst.mjs   # 30 concurrent → exactly 10 pass (no funds move)
```

### 2.3 Back up KV

The receipt log and the subscriber list live only in KV. Nothing backs them up
automatically.

```powershell
node scripts/backup-kv.mjs
```

Last run 2026-09-08:

```text
Listing keys in 4ef9455bb906422f984e2eab491236c9…
3 keys.
Wrote C:\Users\akifk\x402-iot-poc\backups\kv-2026-09-08.json
  keys: 3, unreadable: 0
```

**The backup file contains subscriber email addresses.** `backups/` is
gitignored. Handle a backup exactly as you would handle the list, because it is
the list.

Short-TTL keys (idempotency, the SSE event) are usually absent. That is correct —
they are cache, not records.

**Cadence:** weekly, and before any deploy that touches KV key shapes.

### 2.4 Export the subscriber list

```powershell
curl.exe -sS -o "$env:USERPROFILEDownloadssubscribers.csv" "https://x402-iot-poc.akifk-x402-26.workers.dev/api/subscribers.csv?token=THE_TOKEN"
```

**Write it outside the repository.** An earlier run of this command saved into the
repo root, and the file — an error response, as it happened — was committed. With
a valid token it would have been the subscriber list.

Without the token: `401`. Without the secret configured at all: `503` and
nothing is exported. That fail-closed behaviour is deliberate — an open export
endpoint on a public Worker is an email list published to the internet.

**Verified 2026-09-14:** the token holder ran the export with the real token. The
file landed in Downloads, outside the repo, as the header
`email,timestamp,source,consent` and no rows. That matches 0 subscribers. The token
was never shared with the agent session that checked the file, which is the
arrangement that keeps it a secret.

### 2.5 Pull metrics

```powershell
curl.exe -sS "https://x402-iot-poc.akifk-x402-26.workers.dev/api/metrics/daily"
curl.exe -sS "https://x402-iot-poc.akifk-x402-26.workers.dev/api/metrics/daily?date=2026-09-06"
curl.exe -sS "https://x402-iot-poc.akifk-x402-26.workers.dev/api/payers"
```

**Pull once, after the day is over.** KV reads are eventually consistent (a real
beacon took ~10 s to appear) and KV has no atomic increment. Both undercount, so
these figures are a **floor**. The response says so itself.

### 2.6 Rotate or replace the test wallets

Both wallets are throwaway testnet accounts. Neither has ever held real value.

To replace the **buyer**:

1. Create a new account in any EVM wallet.
2. Fund it with test USDC — [faucet.circle.com](https://faucet.circle.com/),
   Base Sepolia. No test ETH needed; the facilitator pays gas.
3. Put the new private key in `.env` as `BUYER_PRIVATE_KEY`.
4. **Add the new address to `OWN_WALLETS` in `wrangler.jsonc`** and redeploy —
   otherwise it counts as an external payer and corrupts the one KPI that is
   hard to fake.

To replace the **seller**:

1. Update `PAY_TO` in `wrangler.jsonc`, add the new address to `OWN_WALLETS`,
   redeploy.
2. Old receipts keep the old address. That is correct; the log is a record.

### 2.7 Kill switches

| To stop | Do |
|---|---|
| The buyer agent | `$env:BUYER_ENABLED="false"` — stops within one iteration |
| All paid access | Set `REQUIRE_MANDATE="true"` and deploy — everything without a mandate gets `403` |
| Everything | `npx wrangler delete` (removes the Worker), or disable the route in the Cloudflare dashboard |

### 2.8 Local development

```powershell
npx wrangler dev
```

**Only run one instance.** Two `wrangler dev` processes against the same local
Durable Object database produce `NOSENTRY database is locked: SQLITE_BUSY`, which
does not mention the real problem. Kill all node processes running wrangler and
start one.

---

## 3 · CRM state

**Empty. Zero contacts, zero messages sent, zero briefings booked.**

| Company | Segment | Person | Sent | Replied | Booked | Next action |
|---|---|---|---|---|---|---|
| *(none)* | | | | | | |

**Why it is empty:** the outreach template requires ≥70% of each message to be
custom, with a hook written after reading that company's own work. The house rule
is public business information only, no personal-data scraping. Assembling a list
of named individuals from an agent session is the activity that rule exists to
prevent, so the rubric was written and the names were not.

**Next action for whoever takes this on:** pick 15 targets using the rubric in
`docs/content/outreach-wave-1.md` §"Targeting rubric", prioritising anyone who
engages with the launch.

---

## 4 · Content calendar and draft assets

Everything written and unpublished, in one place:

| Asset | File | Owed since |
|---|---|---|
| Post #1 — build in public | `docs/content/post-1-build-in-public.md` | W2 |
| Post #2 — architecture deep-dive | `docs/content/post-2-architecture.md` | W3 |
| Post #3 — the numbers post | `docs/content/post-3-the-numbers.md` | W7 |
| X threads (2) | `docs/content/publish-wave-1.md` | W4 |
| Ecosystem directory submission | `docs/content/publish-wave-1.md` | W4 |
| Show HN + first comment | `docs/content/launch-week.md` | W6 |
| Two subreddit posts, rewritten per community | `docs/content/launch-week.md` | W6 |
| soft.house flagship tutorial | `docs/content/tutorial-machine-customers.md` | W5 |
| 90-second video script + shot list | `docs/content/demo-video-script.md` | W5 |
| 10-slide readiness deck | `docs/content/readiness-deck.md` | W7 |
| Outreach template + rubric | `docs/content/outreach-wave-1.md` | W6 |
| CFP abstracts + podcast pitch | `docs/content/cfp-and-podcast-pitches.md` | W8 |
| Research board package | `docs/research-board/AGENTIC-PAYMENTS-BOARD.md` | W4 |
| UTM naming sheet + funnel map | `docs/content/funnel-map-and-utm.md` | W5 |

Scheduling for the next four weeks: `docs/week9/DISTRIBUTION-CALENDAR.md`.

---

## 5 · Credentials inventory

Everything I hold, where it lives, and how it transfers.

| Credential | Where it lives | Sensitivity | Transfer |
|---|---|---|---|
| `BUYER_PRIVATE_KEY` | `.env`, local machine only. Gitignored, never committed — verified by scanning the full history | Testnet only. Has never held real value | **Do not transfer.** Generate a new wallet (§2.6). Moving a private key by message is a worse habit than regenerating one |
| Seller address `PAY_TO` | `wrangler.jsonc`, public | Public by design | Nothing to transfer — it is an address, not a key |
| `AGENT_CARD_SIGNING_KEY` | Cloudflare secret store. Generated by its holder with `scripts/generate-card-key.mjs`, never displayed | Anyone holding it can sign a card buyers will trust | **Do not transfer.** Re-run the script to rotate, then give buyers the new public key (`SELLER_CARD_PUBLIC_JWK`). Rotation breaks every pinned buyer until it updates, which is the point |
| `SELLER_CARD_PUBLIC_JWK` | buyer `.env`; also served at `/.well-known/jwks.json` | Public | Nothing to protect; buyers must get it from a trusted channel, not from the seller's own domain |
| `EXPORT_TOKEN` | Cloudflare secret store | Guards the subscriber list | Rotate on handover: `npx wrangler secret put EXPORT_TOKEN` with a new value. The old one stops working immediately |
| Cloudflare account | `akifk-x402-26` | Owns the Worker, KV, DO, AI binding | Account-level transfer, or redeploy under a company account and repoint DNS |
| GitHub `Soresta/x402-iot-poc` | public repo | Public, MIT | Transfer ownership or fork to a company org |

**Secrets hygiene, verified:**

```powershell
git log -p --all | Select-String -Pattern '0x[a-fA-F0-9]{64}'
# re-run 2026-09-14: 312 matches, 270 distinct values. Every one is a
# Base Sepolia transaction hash — 260 appear in the buyer ledger, and the other
# 10 were confirmed with eth_getTransactionByHash

git log --all --name-only --format="" | Select-String -Pattern '^\.env$'
# (no output — .env has never been tracked)
```

**No private key exists in the repository or its history.**

---

## 6 · Things that will confuse the next person

Written down because each one cost time here.

1. **`402` is the healthy response** on paid routes. A `200` without payment is
   the emergency.
2. **Running `test_mandate.mjs` twice inside a minute** trips our own rate limit.
   One case waits it out; another can still flake. Wait 60 s between runs.
3. **`DAILY_CAP` is compared to the last 24 hours of `buyer/ledger.jsonl`**, not
   to zero and not to the calendar day. A cap below recent spend stops the agent
   before it buys anything. That is the cap working. Move the ledger aside before a
   live demo.
4. **Two `wrangler dev` instances** → `SQLITE_BUSY`, with an error that does not
   say so.
5. **The payment proof header is `payment-signature`**, not `X-PAYMENT`. Both are
   accepted; keying on the old one alone silently disables replay protection and
   rate limiting. This is the single most expensive thing anyone has learned here.
6. **Receipts written before Week 5 show "Sensor reading*".** The resource field
   did not exist then; readings were the only product, and the asterisk says the
   label is inferred. Not backfilled, because the log is a record.
7. **The block explorer serves a bot challenge** to automated browsers. Verify
   settlements via RPC (`eth_getTransactionReceipt` at `https://sepolia.base.org`)
   or open the link in a normal browser.
8. **The ERC-20 `Transfer` event is the second log** in a settlement receipt. The
   first is `AuthorizationUsed`, whose second topic is a nonce, not an address.
   Decoding log 0 as a transfer gives a wrong recipient.
9. **The live feed is `/api/feed/settlements`.** `/api/events` still works, but ad
   blockers block that name and the page then shows "Polling". Check the demo
   in the browser you will present from.
10. **An unattended run on a laptop is not unattended.** Sleep pauses it and the
    agent resumes on wake. Disable sleep, or report wall-clock and buying time
    separately, as `docs/soak-runs/SOAK-2026-09-11.md` does.

---

## 7 · What is unfinished

`docs/OPEN-ITEMS.md` is the full list. As of 2026-09-14:

- **Section A (correctness) is closed**, the signed Agent Card included.
- **Open checks needing a person:** the stranger tests (B1, B2), a clean-machine
  tutorial run (B5), two rehearsals (B7) and the fallback video (B8). B6, the 24 h
  run, is PARTIAL with real numbers. Steps: `docs/PENDING-HUMAN-TESTS.md`.
- **E1–E6**: decisions, not work.

Nothing in this handoff is blocked on me. Every runbook above was executed on the
day it was written.
