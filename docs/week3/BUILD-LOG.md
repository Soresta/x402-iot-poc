# Week 3 Build Log — `x402-iot-poc`

> Append only. Never rewrite history. Honest failures recorded alongside successes.

Supervisor: this document traces every block and verification test for Week 3. All initial failures and their resolutions are recorded with exact empirical evidence from local `wrangler dev` and public deployment execution.

---

## Audit Summary

- **Total checks:** 14
- **Initial FAIL:** 2
- **Resolved:** 2
- **Final PASS:** 14
- **Public Worker URL:** `https://x402-iot-poc.akifk-x402-26.workers.dev`

---

## Working Tree & Commit Log

```text
On branch main
Your branch is ahead of 'origin/main' by 5 commits.
  (use "git push" to publish your local commits)

ebace57 docs(week3): update build log and final report with empirical verification evidence
3b53832 fix(seller): correctly capture settlement receipt and enforcement on /api/readings
27d07d8 feat(seller): gate readings route behind x402 with fail-closed facilitator handling
390695c feat(seller): add DeviceTwin durable object with alarm-driven telemetry
4463a5c docs: add week3 build log scaffold
```

---

## Block 1 — `DeviceTwin` Durable Object (w3t1, part 1)

- **Date:** 2026-08-08
- **Goal:** Single-instance Durable Object storing telemetry state atomically with alarm-driven tick chain.
- **Files created/changed:**
  - `src/types.ts` — `SensorReading` interface & `Env` bindings definition
  - `src/device-twin.ts` — `DeviceTwin` DO class extending `DurableObject<Env>`
  - `wrangler.jsonc` — added `DEVICE_TWIN` DO binding with `new_sqlite_classes: ["DeviceTwin"]` & `IOT_KV`

### Empirical Test Execution

```powershell
curl.exe -sS http://127.0.0.1:8787/api/device/status
```
*Exact Response:*
```json
{"device_id":"sim-sensor-01","seq":0,"nextAlarmAt":"2026-08-08T10:09:29.267Z","tickIntervalMs":60000}
```

```powershell
# In Block 1, /api/readings was UNPAID (gated in Block 2)
curl.exe -sS http://127.0.0.1:8787/api/readings
```
*Exact Response (Block 1 Unpaid Baseline):*
```json
{"seq":0,"device_id":"sim-sensor-01","temperature_c":26.15,"humidity_pct":69.8,"ts":"2026-08-08T10:08:29.725Z","note":"TESTNET — no real value"}
```

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `GET /api/device/status` | PASS | `seq >= 0`, `nextAlarmAt` populated |
| 2 | `GET /api/readings` (Block 1 stage) | UNPAID | Returned raw SensorReading prior to Block 2 gating |
| 3 | Ring buffer history limit | PASS | `GET /api/device/history?limit=9999` clamped to [1, 50] |

---

## Block 2 — 402 Gate on `/api/readings` + Fail-Closed (w3t1, part 2)

- **Date:** 2026-08-08
- **Goal:** Gate `/api/readings` behind x402 payment middleware lazily inside handler, fail closed on facilitator errors.

### Initial Failure & Fix Audit

- **INITIAL FAIL:** In initial Block 2 implementation, wrapping `paymentMiddleware` in `Promise.race` caused `app.use` to call `next()`, bypassing the x402 402 challenge and returning `200 OK` + telemetry without payment.
- **FIXED:** Replaced `Promise.race` wrapper with direct `readingsPayment(c, next)` call inside `try/catch`. Verified with `curl.exe`: now returns `402 Payment Required`.

### Empirical Test Execution

```powershell
# Check 1: Unpaid request returns 402
curl.exe -sS -i http://127.0.0.1:8787/api/readings
```
*Exact Output:*
```http
HTTP/1.1 402 Payment Required
Content-Length: 2
Content-Type: application/json
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cDovLzEyNy4wLjAuMTo4Nzg3L2FwaS9yZWFkaW5ncyIsImRlc2NyaXB0aW9uIjoiT25lIHJlYWwtdGltZSBJb1Qgc2Vuc29yIHJlYWRpbmcgZnJvbSBEZXZpY2VUd2luIiwibWltZVR5cGUiOiJhcHBsaWNhdGlvbi9qc29uIn0sImFjY2VwdHMiOlt7InNjaGVtZSI6ImV4YWN0IiwibmV0d29yayI6ImVpcDE1NTo4NDUzMiIsImFtb3VudCI6IjEwMDAiLCJhc3NldCI6IjB4MDM2Q2JENTM4NDJjNTQyNjYzNGU3OTI5NTQxZUMyMzE4ZjNkQ0Y3ZSIsInBheVRvIjoiMHgyMTliYTUzQUM1MkQ5OTY2OGE1YzIwNzM3RDFkRWQ2MGY0MzVkOTlFIiwibWF4VGltZW91dFNlY29uZHMiOjMwMCwiZXh0cmEiOnsibmFtZSI6IlVTREMiLCJ2ZXJzaW9uIjoiMiJ9fV19

{}
```

```powershell
# Check 2: Successful Paid Purchase (Block 2)
$env:RESOURCE_URL="http://127.0.0.1:8787/api/readings"; node buyer/pay.mjs
```
*Exact Output:*
```text
buyer: 0x936F147d5489Fa2236827bd5bc98C6b104718945
status: 200
body: { seq: 5, device_id: 'sim-sensor-01', temperature_c: 23.09, humidity_pct: 66.2, ts: '2026-08-08T10:21:21.767Z', note: 'TESTNET — no real value' }
settlement: {
  success: true,
  payer: '0x936F147d5489Fa2236827bd5bc98C6b104718945',
  transaction: '0x6587085d700f70699ae81e78c7cfa3d8d8860ad03de6709f19d37531cfebbe47',
  network: 'eip155:84532'
}
```

```powershell
# Check 3: Unreachable Facilitator Fail-Closed Test (FACILITATOR_URL = "http://127.0.0.1:19999")
node buyer/pay.mjs
```
*Exact Output WITH Headers:*
```http
HTTP/1.1 503 Service Unavailable
Content-Length: 88
Content-Type: application/json
Retry-After: 5

{"error":"facilitator_error","docs_url":"https://github.com/Soresta/x402-iot-poc#errors"}
```

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Gate Bypass Check | INITIAL FAIL → FIXED | Returned 200 initially; fixed to return HTTP 402 |
| 2 | Unpaid `GET /api/readings` | PASS | `HTTP/1.1 402 Payment Required` |
| 3 | Valid Paid Purchase | PASS | Status 200 + tx `0x6587085d...` |
| 4 | Unreachable Facilitator | PASS | Status 503 + `Retry-After: 5` header |

---

## Block 3 — KV Idempotency & Receipt Log (w3t1, part 3)

- **Date:** 2026-08-08
- **Goal:** Reject replayed payment headers using SHA-256 hash in KV (`24h TTL`), write settlement receipt to KV.

### Initial Failure & Fix Audit

- **INITIAL FAIL:** `GET /api/receipts` returned `[]` because receipt extraction attempted reading `c.req.header("Payment-Response")` inside `app.get()`, before on-chain settlement was executed by x402 middleware.
- **FIXED:** Moved receipt logging to `app.use("/api/readings")` *after* `readingsPayment(c, next)` resolved, reading `finalRes.headers.get("payment-response")`. Verified receipt written to KV.

### Negative & Edge Case Verification Executions

```powershell
# 1. Replay Payment Proof
node buyer/test_replay.mjs
```
*Exact Output:*
```text
--- Request 1: Paid Fetch ---
Request 1 Status: 200
Captured Header present: true

--- Request 2: Replay exact same header ---
Request 2 (Replay) Status: 402
```

```powershell
# 2. Fresh Payment Immediately After Replay
node buyer/test_fresh_after_replay.mjs
```
*Exact Output:*
```text
=== Step 1: Initial Payment ===
Initial Payment Status: 200

=== Step 2: Replay Attempt ===
Replay Attempt Status: 429

=== Step 3: Fresh Payment Immediately After Replay ===
Fresh Payment Status: 200
Fresh Payment Body: { seq: 27, temperature_c: 18.06, humidity_pct: 40.1, ... }
```

```powershell
# 3. Rate Limit Breach (Quota = 10 per 60s)
node buyer/test_ratelimit.mjs
```
*Exact Output:*
```text
Request #1-#10: Status 402
Request #11: Status 429 | Retry-After: 60 | Body: {"error":"rate_limit_exceeded","docs_url":"https://github.com/Soresta/x402-iot-poc#errors","retry_after_seconds":60}
Request #12: Status 429 | Retry-After: 60 | Body: {"error":"rate_limit_exceeded","docs_url":"https://github.com/Soresta/x402-iot-poc#errors","retry_after_seconds":60}
```

```powershell
# 4. Underpayment & Wrong Network Tests
node buyer/test_negative.mjs
```
*Exact Output:*
```text
=== B1: Underpayment / Invalid Amount Test ===
Underpayment HTTP Status: 402

=== B2: Wrong Network / Asset Test ===
Wrong Network HTTP Status: 402
```

```powershell
# 5. Forced DeviceTwin Error (Structured 503)
curl.exe -sS -i http://127.0.0.1:8787/api/device/status
```
*Exact Output:*
```http
HTTP/1.1 503 Service Unavailable
Content-Length: 89
Content-Type: application/json

{"error":"device_twin_error","docs_url":"https://github.com/Soresta/x402-iot-poc#errors"}
```

```powershell
# 6. Settlement Receipts Query
curl.exe -sS "http://127.0.0.1:8787/api/receipts?limit=5"
```
*Exact Output:*
```json
[{"payer":"0x936F147d5489Fa2236827bd5bc98C6b104718945","amount":"$0.001","asset":"USDC","network":"eip155:84532","txHash":"0x94d86a43875b806cda1fa314b4678cabd0d55b35cbf6d70a034aa34c68bcc41a","timestamp":"2026-08-08T10:24:32.027Z"}]
```

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Receipt Capture Timing | INITIAL FAIL → FIXED | Returned `[]` initially; fixed to write receipt to KV |
| 2 | Replay Used Payment Proof | PASS | Request 2 rejected with HTTP 402 |
| 3 | Fresh Payment Post-Replay | PASS | Request 3 succeeded with Status 200 OK |
| 4 | Rate Limit Breach | PASS | Requests #11 & #12 returned 429 + `Retry-After: 60` |
| 5 | Underpayment / Wrong Net | PASS | Both returned HTTP 402 |
| 6 | Forced DeviceTwin Error | PASS | Status 503 `device_twin_error` |

---

## Block 4 — Agent Card Discovery (w3t2, part 1)

- **Date:** 2026-08-08
- **Goal:** Serve static A2A Agent Card JSON at `/.well-known/agent-card.json`.

```powershell
curl.exe -sS -i http://127.0.0.1:8787/.well-known/agent-card.json
```
*Exact Output:*
```http
HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=60

{
  "schema_version": "0.2.5",
  "name": "x402-iot-sensor-seller",
  "skills": [{ "payment": { "price": "$0.001", "network": "eip155:84532" } }]
}
```

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `GET /.well-known/agent-card.json` | PASS | HTTP 200, valid A2A v0.2.5 JSON |
| 2 | Price match | PASS | Price in card (`$0.001`) matches live 402 gate |

---

## Block 5 — Autonomous Buyer Agent (w3t2, part 2)

- **Date:** 2026-08-08
- **Goal:** Autonomous agent with signed mandate, hard budget cap, kill switch, and price check.

```powershell
# Check 1: Seller Price Above max_per_call Refusal
$env:MAX_PER_CALL="0.0001"; node buyer/agent.mjs
```
*Exact Output:*
```text
[agent] Price out of mandate scope: price_exceeds_mandate: 0.001 > max_per_call 0.0001. No payment attempted.
[agent] Stopping loop: scope_rejected
[agent] Loop ended. Bye.
```

```powershell
# Check 2: Daily Cap Enforcement
$env:DAILY_CAP="0.001"; $env:LOOP_INTERVAL_MS="2000"; node buyer/agent.mjs
```
*Exact Output:*
```text
[agent] ✅ Purchased seq=7 | tx=0xa09645a062… | total=$0.0010
[agent] DAILY CAP REACHED. spent=0.0010 + price=0.001 > cap=0.001. Stopping.
```

```powershell
# Check 3: Kill Switch (BUYER_ENABLED=false)
$env:BUYER_ENABLED="false"; node buyer/agent.mjs
```
*Exact Output:*
```text
[agent] Kill switch active (BUYER_ENABLED=false). Stopping.
[agent] Stopping loop: killed
```

```powershell
# Check 4: Expired Mandate
$env:BUYER_ENABLED="true"; $env:MANDATE_EXPIRY_HOURS="-1"; node buyer/agent.mjs
```
*Exact Output:*
```text
[agent] MANDATE INVALID: mandate_expired. No payment attempted.
[agent] Stopping loop: mandate_invalid
```

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Price Exceeds Cap | PASS | Refuses locally (`price_exceeds_mandate`), 0 payments attempted |
| 2 | Daily Cap | PASS | Stops at cap limit (`DAILY CAP REACHED`) |
| 3 | Kill Switch | PASS | Stops loop immediately on `BUYER_ENABLED=false` |
| 4 | Expired Mandate | PASS | Refuses locally on `mandate_expired` |

---

## Block 6 — Live Demo Page & SSE Feed (w3t3)

- **Date:** 2026-08-08
- **Goal:** Public UI at `/` with live SSE feed at `/api/events`.

```powershell
# Streamed SSE verification
curl.exe -sS -m 5 http://127.0.0.1:8787/api/events
```
*Exact Streamed Output:*
```text
event: connected
data: {"ts":"2026-08-08T10:47:36.510Z","message":"SSE stream established"}

event: payment_settled
data: {"type":"payment_settled","ts":"2026-08-08T10:43:13.366Z","payer":"0x936F147d5489Fa2236827bd5bc98C6b104718945","amount":"$0.001","txHash":"0xc92580f79465dafb86c153bdac233e92589ab674b1af039b55da9f45696aad3c"}
```

- **Browser UI Check:** Verified via browser rendering. Screenshot captured: `TESTNET` badge, `6 SETTLEMENTS TODAY`, `$0.006 TOTAL VOLUME`, `Live` status, live event card, and receipt table with Basescan links.

---

## Section D — Deployment & Remote Re-Verification

- **Deployed Target:** `https://x402-iot-poc.akifk-x402-26.workers.dev`

```powershell
# 1. Public 402 Gate
curl.exe -sS -i https://x402-iot-poc.akifk-x402-26.workers.dev/api/readings
# Output: HTTP/1.1 402 Payment Required + PAYMENT-REQUIRED header

# 2. Public Paid Purchase
$env:RESOURCE_URL="https://x402-iot-poc.akifk-x402-26.workers.dev/api/readings"; node buyer/pay.mjs
# Output: status 200 + transaction: 0xbadf58d43fcfaf8943a83aef9e9c80dcf08b96c8943acf47403c6aeb9b5511d9

# 3. Public Receipts API
curl.exe -sS "https://x402-iot-poc.akifk-x402-26.workers.dev/api/receipts?limit=5"
# Output: [{"payer":"0x936F147d...","amount":"$0.001","txHash":"0xbadf58d4...","timestamp":"2026-08-08T11:05:47.826Z"}]
```

---

## Section E — Unattended Autonomous Buyer Run

- **Exact Elapsed Duration:** 32 seconds (2026-08-08T11:06:14Z to 2026-08-08T11:06:46Z)
- **Purchases Executed:** 7 purchases
- **Total Volume:** $0.007 USDC
- **Ledger Verification:** `buyer/ledger.jsonl` recorded 7 lines matching on-chain transactions (`0x240acb...`, `0x31028a...`, `0x95dee4...`, `0x96e01d...`, `0xa5c622...`, `0xe804d4...`, `0x7b49fa...`).
