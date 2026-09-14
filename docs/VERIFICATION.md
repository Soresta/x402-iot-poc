# Verification

Everything this project claims works, how each claim was checked, and what the
check showed. The README keeps a short summary; this file holds the full record.

**Rule:** a row reads PASS only when the behaviour was observed working. PARTIAL
and NOT VERIFIED rows stay here with their real state. Status as of
**2026-09-14**, deploy `57efe9ed`.

---

## 1. Automated

```bash
npm test                          # vitest — 81 tests: 52 regression, 29 over HTTP
node scripts/mutation-check.mjs   # reintroduce each known defect; the suite must go red
npx tsc --noEmit                  # typecheck
```

- `test/regressions.spec.ts` tests pure functions. There is one group per defect
  that was found: header name, mandate verification and binding, payment screen
  codes, classifier label, external-payer accounting, rolling cap and spend
  accounting, inference input, rate-limit arithmetic, card signing, and the
  live-feed cursor.
- `test/http.spec.ts` goes through `SELF.fetch`, so the real routing, the real
  middleware and the real Durable Objects are in the path. No facilitator or chain
  call is made, so the run is deterministic and moves no funds.

### Mutation check: does the suite catch the bugs it claims to?

`scripts/mutation-check.mjs` puts each defect back into the source, one at a time,
and expects the suite to fail. **Last run: 11 of 11 caught.**

| # | Mutation | Defect it reintroduces |
|---|---|---|
| 1 | Seller reads only `X-PAYMENT` | W3: replay protection and rate limiting silently off |
| 2 | Holder-is-payer check removed | W4: a mandate works as a bearer token |
| 3 | Classifier takes the first class | W5: reports the least likely label |
| 4 | Underpayment check removed from the screen | W3: documented error code never emitted |
| 5 | Cap counted by UTC calendar day | Spending up to 2× the cap across midnight |
| 6 | Inference input validation removed | Buyer asked to pay for an empty request |
| 7 | Failed settlements recorded | Failed payments counted as sales |
| 8 | Buyer accepts any card signature | Signed Agent Card worthless |
| 9 | Lost-response payments uncounted, `cap_reached` counted | Cap undercounts real spend |
| 10 | Live feed replays the latest settlement | One payment shown 31 times |
| 11 | Rate limiter switched off | Quota not enforced |

The mutation check once caught its own test. Its first run reported mutation 9 as
**MISSED**: the fixture's amounts happened to sum to the same total with and
without the bug. The fixture was fixed before the result was reported.

---

## 2. Manual scripts: against a real facilitator and chain

```bash
node buyer/test_replay.mjs              # pay, then replay the same proof   → 402   (spends)
node buyer/test_fresh_after_replay.mjs  # replay protection must not block honest buyers (spends)
node buyer/test_inference.mjs           # both resources, one card, scope enforced (spends)
node buyer/test_mandate.mjs             # identity 401 / mandate 403, seven cases (spends 1)
node buyer/test_negative.mjs            # underpayment, wrong asset         → 402 + code
node buyer/test_ratelimit.mjs --recover # quota breach → 429, then recovery
node buyer/test_ratelimit_burst.mjs     # 30 concurrent → exactly 10 pass
node buyer/test_failclosed.mjs          # facilitator unreachable           → 503
node buyer/soak.mjs                     # timed unattended run
```

Set `SELLER_URL=https://x402-iot-poc.akifk-x402-26.workers.dev` to run any of them
against the deployed Worker; without it they target `127.0.0.1:8787`. **Wait 60 s
between runs of `test_mandate.mjs`**, or it trips the seller's own rate limiter.

---

## 3. Results

### Payment path

| Check | Result |
|---|---|
| Paid request returns data; replayed proof rejected | **PASS**, local and deployed |
| Underpayment / wrong asset / wrong recipient | **PASS**: `402` with a distinct code each |
| Failed paid request is not charged | **PASS**: two paid requests against a broken device, buyer USDC balance `40757000` before and after, on-chain |
| A failed settlement is not counted as a sale | **PASS since 2026-09-11**: deployed Worker went from 100 settlements / $0.101 to the true 97 / $0.098 |
| Facilitator unreachable | **PASS**: `503` + `Retry-After: 5`, no data served |
| Forced `DeviceTwin` failure | **PASS**: structured `503`, no stack trace |
| Settlement verifiable on the explorer by a person | **PASS 2026-09-14**, [screenshot](./evidence/2026-09-14-basescan-tx.png) |

### Controls

| Check | Result |
|---|---|
| Rate-limit breach and recovery | **PASS**: `429` + `Retry-After`, releases after the window |
| Rate limit under a concurrent burst | **PASS since 2026-09-11**: 30 simultaneous requests, exactly 10 pass on the deployed Worker, 3 runs of 3. Before the fix, 30 of 30 passed |
| Expired mandate · scope exceeded · malformed · bad caps | **PASS**: `403`, seller-side |
| Tampered or foreign mandate signature | **PASS**: `401 identity_unverified` |
| Mandate presented by a different payer | **PASS**: `401 identity_mismatch` |
| Mandate addressed to a different seller | **PASS**: `403 mandate_wrong_seller` |
| Cheap mandate cannot buy the expensive resource | **PASS**, local and deployed |
| Empty inference input refused before the `402` | **PASS**: `400 inference_input_required`, no payment terms issued |
| Consent required · export fails closed | **PASS**: `400` without consent; `503` without the secret, `401` with a wrong token |

### Buyer agent

| Check | Result |
|---|---|
| Budget cap, kill switch, price above mandate | **PASS**: refused before any payment |
| Cap is a rolling 24 h window | **PASS since 2026-09-11** (regression test 5) |
| Payment whose response is lost still counts against the cap | **PASS since 2026-09-13**. Found by reconciling the 2026-09-11 run: 147 on-chain transfers against 146 ledger entries |
| Graceful `Ctrl+C` exit | **PASS 2026-09-14**: console line plus ledger `agent_stopped`, [screenshot](./evidence/2026-09-14-agent-signed-card-ctrlc.png) |
| Agent Card signed, buyer verifies against a pinned key | **PASS 2026-09-14**: two purchases with the key pinned. Off-chain: an edited price, a different key and a stripped signature are all refused |
| Price negotiation: counter-offer accepted / declined | **PASS**, local and deployed |
| Unattended run | **PARTIAL.** Longest continuous run 1 h: 111 settlements, 98.2 % success. On 2026-09-11: 8 h 50 m wall clock, ≈ 2 h 37 m buying, 146 purchases, cap never exceeded. [Write-up](./soak-runs/SOAK-2026-09-11.md). **24 h not achieved** |

### Demo page

| Check | Result |
|---|---|
| Receipts table and "who is paying" panel | **PASS**, [screenshot](./evidence/2026-09-14-demo-page-receipts.png) |
| Stat cards describe what they count | **PASS since 2026-09-14**. They said "today" and counted the last 20 |
| Live feed shows each settlement once | **PASS since 2026-09-14**: 145 s observed on the deployed Worker, one payment shown once, status "Live" throughout. Before: one payment shown 31 times |
| Live feed works with an ad blocker installed | **PASS 2026-09-14**, confirmed in the affected browser after moving the feed to `/api/feed/settlements` |
| Understood by a stranger in 30 s | **PASS with a finding, 2026-09-14**: "we make a payment in exchange for data read from a sensor". The purpose was understood; that the payer is software was missed |
| Quickstart followed by a first-time user | **PASS with one hint, 2026-09-14**: no wallet to a settled payment in ≈ 15 min on macOS. The hint was for a doc defect, since fixed |
| README "run your own seller" reproduced by a stranger | **PASS with guidance, 2026-09-14**: 14 min, own seller address, both products bought from a local seller. Two stops at step 5, both doc defects, since fixed |
| An external wallet settles | **PASS 2026-09-14**: recruited tester, verified on-chain. Organic external payers: 0 |
| Tutorial run from an empty directory | **PASS 2026-09-14**, run on a separate computer (reported by the intern) |

The NOT VERIFIED rows need a person. The steps are in
[`PENDING-HUMAN-TESTS.md`](./PENDING-HUMAN-TESTS.md).

---

## 4. What was found, and when

The defects in order of discovery. Each has its failing output in the build log or
the CHANGELOG entry for the version that fixed it.

| Found | Defect | Visible? |
|---|---|---|
| W3 | Seller read `X-PAYMENT`; the client sends `payment-signature` | No. Payments settled while replay protection and rate limiting never ran |
| W3 | Documented error codes were never emitted | No. Underpayment returned `{}` |
| W4 | Mandate verified on the buyer only | No. A compromised agent skips its own check |
| W4 | A valid mandate worked for whoever held it | No. Nothing bound holder to payer |
| W5 | Classifier reported the least likely label | No. Well-formed JSON, wrong answer |
| W8 | A mandate for one seller was spendable at another | No |
| 09-11 | Spending cap reset at UTC midnight | No |
| 09-11 | KV rate limiter let 30 of 30 concurrent requests through | No. Every sequential test passed |
| 09-11 | Failed settlements counted as sales | No. 3 of 100 receipts |
| 09-11 | Inference input silently replaced before payment | No |
| 09-11 | Two stated limitations were wrong in the docs ("paid but undelivered", "write-after-settle") | Found by testing the claims against the chain |
| 09-11 | Two research-board citations did not contain the claim | Found by reading the primary sources |
| 09-13 | Cap missed a payment whose response was lost; counted refusals as spend | Found by reconciling ledger against chain |
| 09-14 | Demo stats said "today" and meant "last 20" | Visible in a screenshot |
| 09-14 | Live feed replayed one settlement every 25 s | Visible once watched |
| 09-14 | Live feed blocked by an ad blocker | Visible only in a browser with one |
| 09-14 | Quickstart step 4 could not work as written (`pay.mjs` ignored `SELLER_URL`) | Found by the first stranger to follow it |
| 09-14 | No wallet guidance; MetaMask keys exported without `0x` were rejected | Found by the same stranger |
| 09-14 | README never said `wrangler login`; the AI binding makes `wrangler dev` need it | Found by the same stranger |
| 09-14 | A new Cloudflare account needs a `workers.dev` subdomain before `wrangler dev` | Found by the same stranger |

What they have in common: **almost none of them produced an error.** Each
response was well-formed and each check passed. The ones found late were found by
checking a number against an independent source (the chain, a concurrent burst,
a screenshot), not by re-running a test that already passed.
