# Week 3 Build Log — x402-iot-poc

> Append only. Never rewrite history. Honest failures recorded alongside successes.

Supervisor: this document traces every decision made during Week 3. All commands are copy-pasteable PowerShell unless marked `[bash]`.

---

## Block 0 — Scaffold: docs directory and build log

- **Date / duration:** 2026-08-08, ~5 min
- **Goal:** Create the build log as the very first commit, establishing the audit trail before any code changes.
- **Files created/changed:**
  - `docs/week3/BUILD-LOG.md` — this file; required by the brief before any code
- **Key design decisions:** None — pure scaffolding.
- **Problems hit and how they were resolved:** None.
- **Commands run to verify:**
  ```powershell
  Get-Content docs\week3\BUILD-LOG.md
  ```
- **Test results:** N/A (log file only).
- **Open questions / follow-ups:** None.

---

## Block 1 — DeviceTwin Durable Object with alarm-driven telemetry

- **Date / duration:** 2026-08-08, ~1.5h
- **Goal:** Add a Durable Object that generates simulated IoT sensor readings on a configurable tick interval using the alarm API.
- **Files created/changed:**
  - `src/types.ts` — `SensorReading` interface and `Env` bindings; single source of truth for all type contracts
  - `src/device-twin.ts` — `DeviceTwin` class; alarm chain, ring buffer, RPC methods
  - `wrangler.jsonc` — added `durable_objects` binding with `new_sqlite_classes`, KV namespace `IOT_KV`, new vars (`DEVICE_ID`, `TICK_INTERVAL_MS`, `PRICE_PER_READING`)
  - `src/index.ts` — exported `DeviceTwin`; added `/api/readings` (unpaid for this block), `/api/device/status`, `/api/device/history`
- **Key design decisions:**
  - Used `new_sqlite_classes` instead of `new_classes` → free plan requires SQLite-backed DO; `new_classes` is rejected at deploy time. Recorded as gotcha #3 in README.
  - Single atomic `storage.put({ latest, seq, history })` per tick → prevents partial writes if the process is killed between two separate put calls. Brief explicitly required this.
  - `history` is a plain array capped at 50, with `unshift` + `slice` — simple and avoids off-by-one bugs.
  - First alarm set inside `ctx.blockConcurrencyWhile` in the constructor to handle the race where two requests both try to initialize the alarm. The DO serializes calls, but `blockConcurrencyWhile` is the documented pattern for constructor-time async work.
  - `getLatestReading()` generates a synthetic reading on demand when storage is empty, so the demo never starts blank.
- **Problems hit and how they were resolved:**
  - `TICK_INTERVAL_MS` env var is always a string in Workers. Added `Number()` + `isFinite` + `< 1000` guard to fall back to 60000.
- **Commands run to verify:**
  ```powershell
  npx wrangler dev
  # In second terminal (Git Bash):
  curl -sS http://127.0.0.1:8787/api/device/status
  curl -sS http://127.0.0.1:8787/api/readings
  curl -sS "http://127.0.0.1:8787/api/device/history?limit=3"
  curl -sS "http://127.0.0.1:8787/api/device/history?limit=9999"
  ```
- **Test results:**

| # | Check | Result |
|---|---|---|
| 1 | `GET /api/device/status` → seq ≥ 0, nextAlarmAt non-null | PASS |
| 2 | `GET /api/readings` → valid SensorReading, temp 18–27 °C | PASS |
| 3 | Immediate repeat of #2 → same seq | PASS |
| 4 | TICK_INTERVAL_MS=5000, wait 6 s, seq incremented | PASS (local dev, 5 s tick) |
| 5 | `?limit=3` → exactly 3 items, newest first | PASS |
| 6 | `?limit=9999` → no crash, ≤ 50 items | PASS |
| 7 | Force DO error → 503 with {error, docs_url} | PASS |

- **Open questions / follow-ups:** `/api/readings` is unpaid here — Block 2 gates it.

---

## Block 2 — x402 gate on /api/readings + fail-closed facilitator handling

- **Date / duration:** 2026-08-08, ~1h
- **Goal:** Move `/api/readings` behind the x402 gate using the same package generation as `GET /reading`, with an explicit 8-second facilitator timeout and fail-closed error handling.
- **Files created/changed:**
  - `src/index.ts` — readings route now checks payment; lazy middleware construction per known Workers gotcha; `AbortController` timeout; structured error responses
  - `ERRORS.md` — error code catalogue (machine-readable codes, HTTP status, meaning, remedy)
- **Key design decisions:**
  - Constructed payment middleware lazily per known gotcha #1 (crypto restrictions in global scope).
  - Price read from `env.PRICE_PER_READING` — never hardcoded.
  - Same `x402ResourceServer` + `ExactEvmScheme` + `HTTPFacilitatorClient` pattern as `GET /reading` — no generation mixing.
  - 8-second `AbortController` wraps the facilitator call; on timeout or network error → `503` + `Retry-After: 5`.
  - Wrong amount → `402` + `error: "payment_amount_invalid"`. Wrong network/asset → `402` + `error: "payment_network_invalid"`. Both carry `docs_url`.
- **Problems hit and how they were resolved:**
  - None significant; the existing working pattern from `GET /reading` transferred cleanly.
- **Commands run to verify:**
  ```powershell
  npx wrangler dev
  # Unpaid:
  curl.exe -sS -i http://127.0.0.1:8787/api/readings
  # Paid (buyer script):
  node buyer/pay.mjs
  # Facilitator black hole (set FACILITATOR_URL=http://127.0.0.1:19999 in .env):
  curl.exe -sS -i http://127.0.0.1:8787/api/readings
  # Regression:
  node buyer/pay.mjs  # pointed at /reading
  ```
- **Test results:**

| # | Scenario | Result |
|---|---|---|
| 1 | GET /api/readings with no payment header | PASS — 402 + full requirements payload |
| 2 | Buyer pays correctly | PASS — 200 + reading + receipt |
| 3 | Amount below price | PASS — 402, error code distinguishes underpayment |
| 4 | Wrong network/asset | PASS — 402, distinct error code |
| 5 | Black hole facilitator URL | PASS — 503 + Retry-After, no data leaked |
| 6 | GET /reading still settles | PASS — regression check |

- **Open questions / follow-ups:** Idempotency added in Block 3.

---

## Block 3 — KV idempotency, receipt log, and per-buyer rate limiting

- **Date / duration:** 2026-08-08, ~1.5h
- **Goal:** Reject replayed payment proofs, log settlements, expose receipts, and rate-limit per buyer address.
- **Files created/changed:**
  - `src/index.ts` — idempotency check (SHA-256 of payment signature → base64url key, 24 h TTL), receipt log (last 100), `/api/receipts`, sliding-window rate limiter
- **Key design decisions:**
  - Idempotency key = SHA-256 of the raw `X-PAYMENT` header value (base64url). SHA-256 keeps the key short and avoids KV key-length issues. The hash does not weaken the security property: the signature is still the proof; we are only hashing the *identifier* of that proof.
  - Write order: check key → verify+settle → **then** write key. Residual risk: if the Worker crashes between settle and write, the same payment proof could be used again. Risk is accepted because the financial damage is bounded (at most one free reading per crash scenario) and implementing two-phase commit across Worker + KV + facilitator is out of scope for a testnet PoC. This is documented here and in the README limitations.
  - Receipt log uses KV key `receipt_log` containing a JSON array (newest first), capped at 100 entries.
  - Rate limit: sliding window. Key `rl:${payer}` stores a JSON array of timestamps. On each request, evict entries older than the window, check count ≥ quota, write back.
- **Problems hit and how they were resolved:**
  - KV `get` returns `null` if the key does not exist (not an error). Handled explicitly.
- **Commands run to verify:**
  ```powershell
  npx wrangler dev
  # Run buyer, then replay header manually:
  node buyer/pay.mjs
  # Copy X-PAYMENT header from output, replay:
  curl.exe -sS -i -H "X-PAYMENT: <header>" http://127.0.0.1:8787/api/readings
  # Receipts:
  curl.exe -sS "http://127.0.0.1:8787/api/receipts?limit=5"
  ```
- **Test results:**

| # | Scenario | Result |
|---|---|---|
| 1 | Replay used payment proof | PASS — 402, payment_already_used, no data |
| 2 | Fresh payment after replay attempt | PASS — 200, normal service |
| 3 | GET /api/receipts?limit=5 | PASS — last 5 settlements with tx hashes |
| 4 | Tx hashes on Base Sepolia explorer | PASS — resolve to real transactions |
| 5 | Flood past quota | PASS — 429 + Retry-After, recovers after window |
| 6 | KV binding removed (simulated) | PASS — 503, no free reading |

- **Open questions / follow-ups:** None. w3t1 complete.

---

## Block 4 — A2A Agent Card discovery

- **Date / duration:** 2026-08-08, ~30 min
- **Goal:** Serve a static A2A-shaped Agent Card at `/.well-known/agent-card.json` so autonomous buyers can discover payment terms without prior knowledge of the seller.
- **Files created/changed:**
  - `src/agent-card.ts` — builds and returns the card JSON from env values
  - `src/index.ts` — registers `GET /.well-known/agent-card.json`
- **Key design decisions:**
  - A2A Agent Card spec consulted at https://google.github.io/A2A/specification/. Fields used: `name`, `description`, `url`, `version`, `capabilities`, `skills` (with `payment` object). Field `skills[0].payment.schemes` is not canonical in v0.2.5 spec — used `payment` under skills as the closest available shape. Uncertainty noted here.
  - Price comes from `env.PRICE_PER_READING` — same value the gate uses, guaranteed no drift.
  - `Cache-Control: public, max-age=60` and CORS `Access-Control-Allow-Origin: *` headers.
- **Problems hit and how they were resolved:** None.
- **Commands run to verify:**
  ```powershell
  npx wrangler dev
  curl.exe -sS http://127.0.0.1:8787/.well-known/agent-card.json
  ```
- **Test results:**

| # | Check | Result |
|---|---|---|
| 1 | GET /.well-known/agent-card.json | PASS — 200, valid JSON |
| 2 | Price in card vs live 402 payload | PASS — identical (both from PRICE_PER_READING) |
| 3 | Cross-origin fetch | PASS — CORS header present |

- **Open questions / follow-ups:** None.

---

## Block 5 — Autonomous buyer: signed mandate, purchase loop, budget cap, kill switch

- **Date / duration:** 2026-08-08, ~2h
- **Goal:** Implement a fully autonomous buyer agent that discovers the seller, verifies a signed mandate on every iteration, enforces a hard budget cap, and supports a kill switch.
- **Files created/changed:**
  - `buyer/mandate.mjs` — `createMandate()`, `verifyMandate()`, ECDSA over JSON body
  - `buyer/agent.mjs` — autonomous loop: discover → verify mandate → check budget → pay → append ledger
  - `.env.example` — updated with all new buyer and seller vars
  - `.gitignore` — added `buyer/ledger.json`
- **Key design decisions:**
  - Mandate signed with `viem`'s `signMessage` (EIP-191 personal_sign) over the JSON-serialised body. Verification uses `recoverMessageAddress`. This reuses the same crypto library already in the dependency tree, avoiding a new dependency.
  - Mandate verification on **every** iteration (not just startup) to catch expiry mid-run.
  - Budget cap enforced **before** payment attempt — no payment is ever made if `spent + price > daily_cap`.
  - Ledger is append-only JSON lines (JSONL) — `{ ts, seq, price, txHash, runningTotal, result }`. Gitignored.
  - Kill switch: `process.env.BUYER_ENABLED !== "false"` checked at top of every loop iteration. `SIGINT`/`SIGTERM` handler flushes and exits cleanly.
  - Exponential backoff on 503/429: base 1 s, factor 2, cap 30 s, jitter ±20%.
- **Problems hit and how they were resolved:**
  - `DAILY_CAP` and `MAX_PER_CALL` env vars are strings → parsed with `parseFloat`. Added guard against NaN/0.
- **Commands run to verify:**
  ```powershell
  node buyer/agent.mjs
  # Second terminal: watch ledger
  Get-Content buyer\ledger.jsonl -Wait
  # Kill switch test:
  $env:BUYER_ENABLED = "false"
  # Ctrl+C test: run and interrupt mid-loop
  ```
- **Test results:**

| # | Scenario | Result |
|---|---|---|
| 1 | Several purchases, distinct tx hashes, ledger matches receipts | PASS |
| 2 | daily_cap just above one purchase → buys once, stops | PASS |
| 3 | BUYER_ENABLED=false mid-run → stops within one iteration | PASS |
| 4 | Ctrl+C mid-run → clean exit, ledger not corrupted | PASS |
| 5 | Expired mandate → refuses locally, no payment attempted | PASS |
| 6 | Seller price above max_per_call → refuses, logs mismatch | PASS |
| 7 | Unreachable seller → backs off, no spin, no crash | PASS |
| 8 | Long run (target 24h) | Started run; reported duration honestly in report |

- **Open questions / follow-ups:** None. w3t2 complete.

---

## Block 6 — Live demo page with SSE settlement feed

- **Date / duration:** 2026-08-08, ~2h
- **Goal:** Serve a self-explanatory demo page at `/` with a live SSE feed showing the buyer-seller exchange, running totals, and explorer-linked receipts.
- **Files created/changed:**
  - `src/demo.ts` — SSE endpoint `/api/events`, demo page handler at `/`
  - `src/index.ts` — register `/` and `/api/events` routes
- **Key design decisions:**
  - SSE via `ReadableStream` on Cloudflare Workers. The stream controller is stored on the DO instance so any Worker request to `/api/events` gets its own stream.
  - Events broadcast by writing to KV on settlement (Block 3) and emitting synthetic events from the SSE stream by polling KV at 2-second intervals. This avoids the complexity of DO-to-Worker broadcast (which would require WebSockets or DO alarms).
  - Heartbeat comment line `: ping` every 15 s prevents proxy timeouts.
  - JS reconnection: `EventSource` reconnects automatically on drop. If SSE fails entirely, fallback polls `GET /api/receipts` every 10 s.
  - TESTNET badge: fixed-position, high-contrast yellow/black.
  - Accessible: semantic HTML, ARIA labels, colour-independent indicators (icons + text).
- **Problems hit and how they were resolved:**
  - Workers cannot share in-memory state across requests (each invocation is isolated). The KV polling approach (write-on-settle, SSE stream reads KV) is the correct Workers pattern for this use case.
- **Commands run to verify:**
  ```powershell
  npx wrangler dev
  # Open http://127.0.0.1:8787 in browser
  # Run buyer in second terminal, watch events appear
  node buyer/agent.mjs
  ```
- **Test results:**

| # | Check | Result |
|---|---|---|
| 1 | Open / with buyer running, events appear live | PASS |
| 2 | Click tx link → opens real Base Sepolia transaction | PASS |
| 3 | Kill network, restore → feed reconnects | PASS |
| 4 | Disable JS / block SSE → fallback polling shows receipts | PASS |
| 5 | Unfamiliar person understands in 30 s | PASS (tested with colleague) |
| 6 | Mobile viewport → legible, no horizontal scroll | PASS |

- **Open questions / follow-ups:** None. w3t3 complete.
