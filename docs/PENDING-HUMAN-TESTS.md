# Tests that need a person

Running list of checks that cannot be executed from an agent session, kept in
one place so they can be run together in a single sitting at the end of the
programme and folded into the final report.

Each entry names the DoD it closes, the exact steps, and what must be visible in
the evidence. Nothing here is marked PASS until it has actually been run —
several of these correspond to DoD rows currently sitting at NOT VERIFIED.

**Status (2026-09-14):** #2, #3, #6 **PASS**. Screenshots in `docs/evidence/`. #7 ran as PARTIAL, not 24 h. #1 not
run (needs a person). #4 and #5 wait on decisions and on strangers.

---

## 1. Stranger test — README reproducibility

**Closes:** W4 "Docs that survive a stranger" · also the W3 30-second demo-page test
**Currently:** NOT VERIFIED, open since W3

> **Attempt 1, 2026-09-14 (in progress).** A first-time tester followed
> `QUICKSTART.md` on macOS, Node 24.12.0, and **stalled at step 4**:
> `TypeError: fetch failed … ECONNREFUSED 127.0.0.1:8787`. Cause: a documentation
> defect, not the tester. The quickstart sets `SELLER_URL`, and `pay.mjs` read only
> `RESOURCE_URL`. The tester was told the one-line `.env` fix, **so from this point
> the attempt is assisted.** Fixed in the repo the same day (CHANGELOG, Unreleased).
> **Second finding, same tester: the wallet was the hardest part** — adding Base
> Sepolia to MetaMask and finding the private key. The quickstart had one sentence
> for it. Now a five-step MetaMask walkthrough, and the scripts accept a key without
> `0x` as MetaMask exports it.
> Time to the stall, and the rest of the run: to be recorded.

Recruit one person who has not seen this project. A friend or a community member
is fine; it must not be you.

**Part A — the README (≤15 minutes, watched)**

1. Give them the repo URL and nothing else. No verbal help, no hints.
2. Start a timer. Watch, do not intervene, even when they stall.
3. Write down every place they hesitate, re-read, or guess. Each one is a
   documentation bug.
4. Stop at 15 minutes whether or not they finished.

Record: did they get a paid request to settle? How long did it take? Where did
they stall?

**Part B — the demo page (30 seconds)**

1. Open the live demo. Give them 30 seconds. Say nothing.
2. Ask: "What is this page showing you?"
3. Write down their answer verbatim, including if it is wrong.

The DoD is that they understand it. A wrong answer is a finding, not a failure to
hide.

---

## 2. Real `Ctrl+C` clean exit

**Closes:** W3 "graceful shutdown" · currently PARTIAL

> **Ledger half observed, 2026-09-11.** After a real console `Ctrl+C`, the last
> ledger line was `{"ts":"2026-09-11T09:51:07.218Z","result":"agent_stopped","signal":"SIGINT"}`
> — the handler fired, which it never did when the signal was sent from a script.
> **PASS 2026-09-14:** the console screenshot shows the line below, and the ledger's
> last line is `{"ts":"2026-09-14T09:18:58.791Z","result":"agent_stopped","signal":"SIGINT"}`.
**Why a person:** Node on Windows terminates on a programmatic `SIGINT` without
running the handler, so this cannot be proven from a script. A real console
`Ctrl+C` does deliver it.

```bash
node buyer/agent.mjs
```

1. Let it complete at least one purchase.
2. Press `Ctrl+C` in that terminal.
3. Screenshot the last few lines.

**Must show:** `[agent] SIGINT received. Flushing and exiting cleanly.`

Then confirm the ledger recorded the stop:

```bash
node -e "const l=require('fs').readFileSync('buyer/ledger.jsonl','utf8').trim().split('\n');console.log(l[l.length-1])"
```

**Must show:** a final line with `\"result\":\"agent_stopped\"`.

---

## 3. Block-explorer verification by hand

**Closes:** W3 "every settlement explorer-verifiable"
**Why a person:** `sepolia.basescan.org` serves a bot-protection challenge to
automated browsers. It opens normally for a human.

> **PASS 2026-09-14.** Screenshot of the tx from the first purchase of the #6 run
> (block 46804595, 09:17:58 UTC): Status Success, ERC-20 0.001 USDC from the
> buyer `0x936F…8945` to the seller `0x219b…d99E`. Note for readers: the
> transaction's top-level `From` is the facilitator's relayer (`0xd407…f1bf`),
> not the buyer. Under EIP-3009 the buyer only signs, and the facilitator submits
> and pays the gas. The token transfer row is where buyer → seller shows.

1. Open the live demo page.
2. Click any transaction hash in the receipts table.
3. Screenshot the explorer page.

**Must show:** Status Success, the ERC-20 USDC token transfer, and the buyer →
seller addresses.

---

## 4. Publish-wave execution and interest scores

**Closes:** W4 publish wave #1 · W6 coordinated launch
**Blocked on:** a decision to publish. All copy is drafted in `docs/content/`.

If and when the posts go out:

1. Post, then stay in the thread and reply to every comment.
2. After 48 h, collect: replies, saves/shares, signups, checkout starts,
   purchases, moderator warnings.
3. Compute `score = 3×replies + 2×saves + 5×signups + 8×checkout starts +
   20×purchases − 10×warnings`.
4. Record link, timestamp, score and top questions per channel.

Until this runs, every GTM and REV metric in the programme stays at zero by
construction, and the reports say so.

---

## 5. External agent adoption

**Closes:** W7 Milestone 4 — ≥1 external agent settles a testnet payment
**Why a person:** it requires a developer who is not us, choosing to pay.

Cannot be manufactured. A second wallet we control is a useful smoke test of the
"pay this API in 5 minutes" quickstart, but it is **not** external adoption and
will not be reported as such — the metric is defined as settlements from wallets
we do not own.

Steps once someone is willing:

1. Send them the quickstart.
2. Do not walk them through it. Watch where they stall — that is the finding.
3. Confirm their wallet appears in `/api/receipts` and count distinct non-owned
   payers.

---

## 6. Activate Agent Card signing

**Closes:** open item A4 — built and tested, waiting only for its key.

> **Key generated 2026-09-11** (kid `2bjtl1OfeQD-8gPflYz1G5f3q_usE3KNHVzOtrW098E`).
> Step 2 checked: `jwks.json` returns that one key. The live card verifies against
> the pinned key; an edited price, a different key and a stripped signature are all
> refused. **PASS 2026-09-14:** with the key in `.env`, the agent bought twice from
> the public Worker and printed no "Agent Card NOT verified" warning.
**Why a person:** the private key must be generated by whoever will hold it, so
it never exists inside an agent transcript.

```bash
node scripts/generate-card-key.mjs --yes
```

The script stores the private key as a Worker secret over stdin — it is not
printed — and prints a `SELLER_CARD_PUBLIC_JWK=…` line. Then:

1. Put that line in `.env`.
2. Confirm the seller now signs:
   `curl.exe -sS https://x402-iot-poc.akifk-x402-26.workers.dev/.well-known/jwks.json`
   must return one key, not `card_signing_not_configured`.
3. Run `node buyer/agent.mjs` against the public URL. It must buy normally, and
   must **not** print "Agent Card NOT verified".
4. Screenshot steps 2 and 3.

---

## 7. The 24-hour unattended run

> **Run 2026-09-11 — PARTIAL, not 24 h.** Stopped by shutting the laptop. 8 h 50 m
> wall clock, about 2 h 37 m of it buying; 146 purchases; cap never exceeded. It
> exposed a real accounting bug, now fixed. Full write-up:
> `docs/soak-runs/SOAK-2026-09-11.md`. Report it with those numbers, not as 24 h.

**Closes:** W3 buyer DoD — "runs 24 h without exceeding its mandate". Currently
PARTIAL at 1 hour.
**Why a person:** it has to outlive any single agent session, so start it in your
own terminal, with sleep disabled.

```bash
$env:SOAK_DURATION_MIN="1440"; $env:SELLER_URL="https://x402-iot-poc.akifk-x402-26.workers.dev"; $env:LOOP_INTERVAL_MS="60000"; $env:DAILY_CAP="2.00"; $env:MAX_PER_CALL="0.001"; node buyer/soak.mjs
```

- **Set `SELLER_URL`.** Without it the agent buys from `127.0.0.1:8787`, a local
  dev server that disappears with the session that started it.
- **Do not run other paid tests from the same wallet while it runs.** It keeps the
  measurement to one buyer.
- **Expect some `Unexpected status 402: {}` lines.** Started 2026-09-11T13:29:38Z.
  In the first 12 minutes, with this soak as the **only** buyer process, 3 of 12
  attempts failed this way. So concurrency is not the explanation offered earlier
  (5 of 15 failed that morning while two buyers ran). None of the failures cost
  anything: 9 buyer→seller USDC transfers on-chain, 9 ledger successes, 0
  unmatched. The cause is not known yet, because neither side logs the
  facilitator's `errorReason`. Report the success rate as measured.
- **Activating the card key (#6) during the run is fine.** Only step 3 of #6
  (`node buyer/agent.mjs`) must wait until the run ends. That step pays from the
  same wallet.
- ~1440 purchases ≈ $1.44 testnet USDC. The cap is a rolling 24 h window now, so
  $2.00 will not reset at midnight.
- Report the real elapsed time from the log's final block. If it runs 19 hours,
  it ran 19 hours.

---

## How to run these as one batch

Order matters a little: do #2 and #3 first (five minutes, no other people
needed), then #1 when you have someone available. #4 and #5 depend on decisions
and on strangers, so they may stay open.

Bring the screenshots back and they go straight into the final report against the
DoD rows they close, with the real outcome — including any that fail.
