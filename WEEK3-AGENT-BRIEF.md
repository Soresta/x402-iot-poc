# Week 3 Agent Brief — `x402-iot-poc`

> Paste this whole file as the opening instruction to your coding agent (Claude Code / Cursor / Cowork).
> The agent owns the implementation. You own verification, secrets, deploys, and anything published.

---

## 0. Role and mission

You are a senior engineer working inside the repository `x402-iot-poc`
(https://github.com/Soresta/x402-iot-poc — public, MIT).

**Mission:** turn the existing single-route x402 payment spike into a two-agent autonomous
system: a paid seller device-agent, an autonomous buyer agent, and a live public demo page.

Speak to the human in **Turkish**. Write all **code, comments, commit messages, and documents
in English** — they are deliverables for an English-language internship program.

**Working style:**
- Explain the plan before writing files. Wait for approval on architecture decisions only, not on every file.
- Small, reviewable commits. One block = one commit.
- Never invent APIs. If unsure about an x402 / Cloudflare API surface, read the installed package
  types under `node_modules/` or the official docs before writing code.
- If a step fails twice, stop and report — do not "work around" it silently.

---

## 1. Hard constraints — non-negotiable

These come from the internship handbook's engineering conventions. Violating any of them fails the deliverable.

| # | Rule |
|---|---|
| C1 | **Testnet only.** Base Sepolia (chain id 84532). Never wire mainnet, never suggest it in code or docs. |
| C2 | **Fail closed.** If the x402 facilitator is unreachable or ambiguous, return `503` with `Retry-After`. Never serve a paid resource without confirmed settlement. |
| C3 | **Idempotency everywhere money moves.** Payment signature is the key, 24 h TTL, replays rejected loudly. |
| C4 | **Every autonomous spender has a hard budget cap AND a kill switch.** No exceptions. |
| C5 | **Structured errors** on every failure path: `{ "error": "...", "docs_url": "..." }` with `401` identity / `402` payment / `403` mandate / `429` rate / `503` upstream. |
| C6 | **Secrets hygiene.** `.env` gitignored, `.env.example` committed with placeholder values. Never print, log, or commit a private key — not even a testnet one. |
| C7 | **No secrets in the repo history.** Before every commit, grep the staged diff for `0x` + 64 hex chars and abort if found. |
| C8 | **Docs are the product.** README stays accurate after every block. |
| C9 | **Do not publish anything.** No posts, no PRs to third-party repos, no social media. Drafts only. |
| C10 | Environment is **Windows + PowerShell** (Git Bash available for curl). Give PowerShell-native commands; if a command is bash-only, say so explicitly. |

---

## 2. Repository state you are starting from (verify, don't assume)

**First action: run a state audit and report it before writing any code.**

```powershell
Get-ChildItem -Recurse -File -Exclude node_modules | Select-Object FullName
Get-Content package.json
Get-Content wrangler.toml   # or wrangler.jsonc
Get-Content src/index.ts
git log --oneline -10
git status
```

Expected state from Week 2 (confirm each; report any mismatch):

- Cloudflare Worker with **Hono**, TypeScript, deployed at `x402-iot-poc.akifk-x402-26.workers.dev`
- Route `GET /reading` gated by x402 (`exact` scheme, EIP-3009 `transferWithAuthorization`)
- Node buyer script at `buyer/pay.mjs` that decodes payment requirements, signs, retries
- Two settlements already proven on Base Sepolia, linked in the README
- Two known gotchas already documented in the README:
  1. **Lazy middleware init** — x402 payment middleware must be constructed *inside* the request
     handler on Workers; global scope hits crypto API restrictions.
  2. **Package generation mismatch** — two incompatible x402 package generations coexist
     (`network: "base-sepolia"` vs CAIP-2 `eip155:84532`); mixing them fails **silently**.
     Pin whichever generation is already installed and do not mix.

**Do not break `GET /reading`.** It is the evidence artifact for Week 2. Keep it working, or if
you must refactor it, keep an identical-behaviour route and prove it still settles.

---

## 3. Mandatory build log — this is a graded deliverable

Create `docs/week3/BUILD-LOG.md` in the **first** commit and append to it after **every** block.
The human must be able to hand this straight to the program supervisor.

Entry template (append, never rewrite history):

```markdown
## Block <n> — <title>
- **Date / duration:** YYYY-MM-DD, ~Xh
- **Goal:** one sentence.
- **Files created/changed:** bulleted list with a one-line reason each.
- **Key design decisions:** decision → alternative rejected → why.
- **Problems hit and how they were resolved:** include the exact error text.
- **Commands run to verify:** copy-pasteable.
- **Test results:** the acceptance table for this block, each row marked PASS/FAIL with evidence.
- **Open questions / follow-ups:**
```

Rules for the log:
- Record failures and dead ends too. An honest failure entry is worth more than a clean fiction.
- Any number that appears in the log must be reproducible by re-running a listed command.
- Never paste private keys, wallet seed phrases, or full `.env` contents into the log.
- At the end, also produce `docs/week3/WEEK3-REPORT.md` (see §10).

---

## 4. Target architecture

```
BUYER SIDE (autonomous)                 SELLER SIDE (Cloudflare Worker)
─────────────────────────               ──────────────────────────────
1. Discover                             Hono router
   GET /.well-known/agent-card.json  ──►   ├─ x402 gate (402 → verify → settle)
2. Authorize                              ├─ DeviceTwin (Durable Object)
   signed AP2-style mandate               │    telemetry via storage + alarm
   { max_per_call, daily_cap, expiry }    ├─ KV: idempotency keys (24h TTL)
3. Pay and consume                     ◄──┤  KV: receipt log (last N)
   x402 payment → data → spend ledger     └─ SSE feed → live demo page
   hard cap + kill switch
```

Separation of responsibility is a graded design point:
- `DeviceTwin` knows **nothing** about money. It only produces and stores telemetry.
- The Worker layer owns pricing, payment verification, idempotency, receipts, rate limiting.
- The buyer owns its own mandate and ledger; the seller verifies but does not store buyer policy.

---

## 5. Work blocks

Complete in order. After each block: run its acceptance tests, append to `BUILD-LOG.md`, commit,
then report to the human and wait for a go-ahead before starting the next block.

---

### Block 1 — `DeviceTwin` Durable Object (w3t1, part 1)

**Files**

| Path | Purpose |
|---|---|
| `src/types.ts` | `SensorReading` interface + `Env` bindings interface. Single source of truth. |
| `src/device-twin.ts` | `DeviceTwin` class extending `DurableObject`. |
| `wrangler.toml` | Add DO binding, migration, KV namespace, vars. |
| `src/index.ts` | Export `DeviceTwin`; add `/api/readings`, `/api/device/status`, `/api/device/history`. |

**Implementation requirements**

- `compatibility_date >= 2024-04-03` and `compatibility_flags = ["nodejs_compat"]`.
- Migration must use `new_sqlite_classes = ["DeviceTwin"]` — `new_classes` is rejected on the free plan.
  Note this in the README gotchas section.
- DO state keys: `latest`, `seq`, `history`. Persist with a **single atomic `storage.put({...})`**, never three separate puts.
- `seq` is monotonic, starts at 1, never repeats or skips.
- `history` is a ring buffer, max 50 entries, oldest evicted.
- Alarm chain: in the constructor use `ctx.blockConcurrencyWhile` to set the first alarm if none exists.
  In `alarm()`, **schedule the next alarm before running any business logic** so one failure cannot
  permanently kill the device.
- `TICK_INTERVAL_MS` parsed defensively: non-finite or `< 1000` falls back to `60000`.
- Public RPC methods: `getLatestReading()`, `getHistory(limit)`, `getStatus()`.
  `getLatestReading()` must produce a reading on demand if storage is empty, so the demo never starts blank.
- `getHistory` clamps `limit` to `[1, 50]`.
- Worker resolves the stub via `env.DEVICE_TWIN.idFromName(env.DEVICE_ID)` — deterministic, one instance globally.
- `/api/readings` is **unpaid in this block only**; Block 2 puts it behind the gate.
- Any DO failure → `503` with the structured error body (C5).

**Acceptance tests** (`npx wrangler dev`, then Git Bash or PowerShell `curl.exe`)

| # | Check | Expected |
|---|---|---|
| 1 | `GET /api/device/status` | `seq >= 0`, `nextAlarmAt` non-null |
| 2 | `GET /api/readings` | valid `SensorReading`, temp 18–27 °C |
| 3 | Immediate repeat of #2 | **same `seq`** — correct: the twin ticks on its own clock, not on request |
| 4 | Set `TICK_INTERVAL_MS=5000`, wait 6 s, repeat #2 | `seq` incremented |
| 5 | `GET /api/device/history?limit=3` | newest first, exactly 3 items |
| 6 | `GET /api/device/history?limit=9999` | no crash, ≤ 50 items |
| 7 | Force a DO error (temporarily throw) | `503` with `{error, docs_url}`, not a 500 stack trace |

Restore `TICK_INTERVAL_MS=60000` and remove the forced error before committing.

Commit: `feat(seller): add DeviceTwin durable object with alarm-driven telemetry`

---

### Block 2 — 402 gate on `/api/readings` + fail-closed (w3t1, part 2)

**Requirements**

- Move `/api/readings` behind the x402 gate, reusing the working pattern from `GET /reading`.
- **Construct the payment middleware lazily inside the handler** (known Workers gotcha).
- Price from env (`PRICE_PER_READING`), never hardcoded in the handler.
- Do not mix x402 package generations — match whatever `GET /reading` already uses.
- Unpaid request → `402` with a complete payment-requirements payload (scheme, network, price,
  `payTo`, resource, description).
- Facilitator unreachable / timeout / non-deterministic answer → `503` + `Retry-After: 5`,
  and **the reading is not served**. Implement an explicit timeout (e.g. 8 s) rather than waiting forever.
- Wrong amount, wrong asset, or wrong network → `402` with a distinct machine-readable `error` code.
- Every error body carries `docs_url` pointing at the README error section.
- Add an `ERRORS.md` or a README `#errors` anchor listing every code, its HTTP status, and its meaning.

**Acceptance tests**

| # | Scenario | Expected |
|---|---|---|
| 1 | `GET /api/readings` with no payment header | `402` + full requirements payload |
| 2 | Buyer script pays correctly | `200` + reading + receipt header + tx hash |
| 3 | Payment with amount below price | `402`, error code distinguishes underpayment |
| 4 | Payment on wrong network/asset | `402`, distinct error code |
| 5 | Facilitator URL pointed at a black hole | `503` + `Retry-After`, **no data leaked** |
| 6 | `GET /reading` (Week 2 route) | still settles — regression check |

Commit: `feat(seller): gate readings route behind x402 with fail-closed facilitator handling`

---

### Block 3 — KV idempotency + receipt log (w3t1, part 3)

**Requirements**

- Idempotency key = the payment signature (hash it if long; document the choice). TTL 24 h in KV.
- Flow: check key → if present, reject with `402` and `error: "payment_already_used"` → if absent,
  verify+settle → **then** write the key. Document why the write happens after settlement, and what
  the residual risk is (crash between settle and write) in the log.
- Receipt log in KV: last N settlements with `{ payer, amount, asset, network, txHash, seq, timestamp }`.
  Do not store any buyer data beyond the payer address.
- Add `GET /api/receipts?limit=n` — public, read-only, no payment required. It is the verifiability surface.
- Per-buyer rate limit: KV sliding window, `429` with `Retry-After` on breach. Make the window and
  quota env-configurable.

**Acceptance tests**

| # | Scenario | Expected |
|---|---|---|
| 1 | Replay a previously used payment proof | `402` `payment_already_used`, **no data returned** |
| 2 | Fresh payment after a replay attempt | `200`, normal service |
| 3 | `GET /api/receipts?limit=5` | last 5 settlements, each with a resolvable tx hash |
| 4 | Every tx hash opened on the Base Sepolia explorer | resolves to a real transaction |
| 5 | Flood requests past the quota | `429` + `Retry-After`, recovers after the window |
| 6 | KV binding removed (simulate outage) | `503`, never a free reading |

Commit: `feat(seller): add KV idempotency, receipt log and per-buyer rate limiting`

This closes **w3t1**. DoD from the handbook: *paid request returns data; a replayed payment proof is rejected.*

---

### Block 4 — Agent Card discovery (w3t2, part 1)

**Files:** `src/agent-card.ts`, route `GET /.well-known/agent-card.json`

**Requirements**

- Serve a static-shaped JSON describing the seller agent: name, description, endpoint URL,
  capabilities, supported payment scheme/network/asset, price per resource, contact/repo link.
- Follow the A2A Agent Card shape. **Read the current a2a-protocol spec before inventing fields.**
  If a field's canonical name is uncertain, use the spec's name and note the uncertainty in the log.
- Values come from env/config, not hardcoded strings, so the card cannot drift from the actual gate price.
- `Cache-Control: public, max-age=60`. CORS enabled — other agents must be able to fetch it from a browser.

**Acceptance tests**

| # | Check | Expected |
|---|---|---|
| 1 | `GET /.well-known/agent-card.json` | `200`, valid JSON, `Content-Type: application/json` |
| 2 | Price in the card vs price in a live `402` payload | **identical** — no drift |
| 3 | Cross-origin fetch from a browser page | succeeds |

Commit: `feat(seller): publish A2A agent card for discovery`

---

### Block 5 — Autonomous buyer: mandate, loop, cap, kill switch (w3t2, part 2)

**Files:** `buyer/mandate.mjs`, `buyer/agent.mjs`, `buyer/ledger.json` (gitignored), `.env.example` updated

**Requirements**

- **Mandate**: a signed JSON document with `{ buyer, seller, max_per_call, daily_cap, currency, expiry, nonce }`.
  Sign with ECDSA using the buyer key. Provide `createMandate()` and `verifyMandate()` so the
  authorization layer is demonstrably separate from settlement.
- **Verification on every call**, not only the first: signature valid, not expired, scope matches the
  resource being bought, quoted price ≤ `max_per_call`. Failure → refuse locally with a `403`-class
  reason, log it, and **do not attempt payment**.
- **Loop**: discover (agent card) → check mandate → check budget → pay via x402 → consume → append to ledger.
  Configurable interval; sane default (e.g. 30 s).
- **Hard budget cap**: a running daily total in the ledger. When `spent + price > daily_cap`, stop buying
  and log the reason. The cap is enforced **before** the payment attempt, never after.
- **Kill switch**: env var (e.g. `BUYER_ENABLED=false`) checked at the top of **every** iteration, plus
  clean `SIGINT`/`SIGTERM` handling that flushes the ledger. Document both in the README.
- **Ledger**: append-only JSON lines — `{ ts, seq, price, txHash, runningTotal, result }`.
  Gitignored (it will contain real testnet activity, and it is machine state, not source).
- Structured console output so a Friday demo is readable live. No private key material in any log line.
- On seller `503` or `429`: exponential backoff with jitter, capped retries, then pause the loop.
  Never hammer.

**Acceptance tests**

| # | Scenario | Expected |
|---|---|---|
| 1 | Run the loop, let it complete several purchases | Each purchase has a distinct tx hash; ledger totals match `GET /api/receipts` |
| 2 | Set `daily_cap` just above one purchase | Buys once, then stops with an explicit cap-reached log line |
| 3 | Set `BUYER_ENABLED=false` mid-run | Loop stops within one iteration |
| 4 | `Ctrl+C` mid-run | Clean exit, ledger not corrupted |
| 5 | Expire the mandate | Buyer refuses locally, **no payment attempted** |
| 6 | Raise the seller price above `max_per_call` | Buyer refuses, logs the mismatch |
| 7 | Point the buyer at an unreachable seller | Backs off, does not spin, does not crash |
| 8 | Long unattended run (target: 24 h; report actual duration honestly) | No cap breach, no crash, ledger consistent |

For test 8, start the run and report elapsed duration truthfully in the log — do not claim 24 h if it ran 2 h.

Commit: `feat(buyer): autonomous purchase loop with signed mandate, budget cap and kill switch`

This closes **w3t2**. DoD: *unattended loop runs without exceeding its mandate.*

---

### Block 6 — Live demo page with SSE (w3t3)

**Files:** `src/demo.ts` (SSE endpoint + page), `public/` assets if needed

**Requirements**

- `GET /` serves a single self-contained page. A stranger must understand it in **30 seconds**.
- `GET /api/events` is an SSE stream emitting: `quote_requested`, `payment_settled`, `data_delivered`,
  `payment_rejected`. Include `retry:` and periodic heartbeat comments so proxies don't drop the stream.
- Live event feed rendered as: buyer asks → seller quotes → paid ✓ (tx link) → data delivered.
- Running totals: settlements today, total volume, distinct payers.
- **Every settlement links to the Base Sepolia block explorer.** Verifiability is the entire story.
- A visible, unmissable **`TESTNET — no real value`** badge.
- Works with JavaScript reconnection on drop. Degrades gracefully: if SSE fails, fall back to polling
  `GET /api/receipts` so the page is never empty on stage.
- No prices in any promotional framing on the page beyond the technical price field.
- Accessible: readable contrast, no reliance on colour alone, sensible heading order.

**Acceptance tests**

| # | Check | Expected |
|---|---|---|
| 1 | Open `/` with the buyer loop running | Events appear live within seconds |
| 2 | Click any tx link | Opens a real Base Sepolia transaction |
| 3 | Kill the network, restore it | Feed reconnects without a manual refresh |
| 4 | Disable JS / block SSE | Page still shows recent receipts via fallback |
| 5 | Show it to someone unfamiliar | They can explain what is happening in 30 s |
| 6 | Mobile viewport | Legible, no horizontal scroll |

Commit: `feat(demo): live SSE settlement feed with explorer-linked receipts`

---

## 6. Documentation updates (do not skip)

After Block 6, update the README:

- Architecture section: replace/extend the Mermaid diagram with the two-agent flow.
- New env table rows: `DEVICE_ID`, `TICK_INTERVAL_MS`, `PRICE_PER_READING`, rate-limit vars,
  `BUYER_ENABLED`, `MAX_PER_CALL`, `DAILY_CAP`, `MANDATE_EXPIRY`.
- Error contract table: code → HTTP status → meaning → remedy.
- Gotchas section: add `new_sqlite_classes` and anything else discovered this week, alongside the
  two Week 2 gotchas.
- Quickstart: a stranger must reproduce the full two-agent flow from the README alone in ≤ 15 minutes.
- Update `.env.example` with every new variable, placeholder values only.

---

## 7. Definition of done for Week 3

- [ ] Paid request returns data; **replayed payment proof is rejected** (w3t1)
- [ ] Unattended buyer loop runs without exceeding its mandate; kill switch works (w3t2)
- [ ] Demo page explains itself in 30 seconds, every settlement explorer-verifiable (w3t3)
- [ ] `GET /reading` from Week 2 still settles (no regression)
- [ ] All six blocks logged in `docs/week3/BUILD-LOG.md` with PASS/FAIL evidence
- [ ] README reproducible from scratch
- [ ] No secrets anywhere in the repo or its history
- [ ] `docs/week3/WEEK3-REPORT.md` produced (§10)

---

## 8. Commit convention

Conventional Commits, scoped: `feat(seller):`, `feat(buyer):`, `feat(demo):`, `fix:`, `docs:`, `chore:`.
One block per commit. Body lists what was verified. Do not push — the human pushes.

---

## 9. Stop-and-ask triggers

Stop and ask the human instead of proceeding if:

- A change would require touching mainnet, real funds, or a non-testnet key.
- The x402 package API differs materially from what `GET /reading` uses (generation mismatch risk).
- A fix would mean removing or weakening idempotency, the fail-closed path, the budget cap, or the kill switch.
- Anything needs to be published externally.
- The same error recurs after two distinct fix attempts.
- You are about to delete or rewrite Week 2 evidence (routes, README settlement table, screenshots).

---

## 10. Final report to generate

Produce `docs/week3/WEEK3-REPORT.md`, written for a supervisor who did not watch the work:

1. **What was built** — 3 sentences, no hype adjectives.
2. **Architecture** — one Mermaid diagram plus a short walkthrough of the three layers
   (identity → mandate → settlement).
3. **Evidence table** — each DoD item, the command that proves it, and the observed result.
4. **Settlements table** — timestamp, amount, payer, tx hash with explorer link.
5. **What broke and what was learned** — the honest section. Include the errors and the reasoning
   that resolved them. This is the most valuable part of the report; do not sanitise it.
6. **Known limitations** — what a reviewer would find if they attacked this. Be specific.
7. **Next week's inputs** — what Week 4 hardening should start from.

Tone: specific over clever. Numbers, dates, links, code. No "revolutionary", no "seamless",
no guarantees, no claims beyond what the evidence supports. An honest small number beats an
embellished big one.
